/**
 * Regression tests for two hardening fixes on the credentials auth path:
 *
 *   SEC-CSRF: POST /api/auth/signup now rejects any request whose
 *   Origin/Referer doesn't match the app's own origin (src/lib/same-origin.ts,
 *   wired into src/app/api/auth/signup/route.ts).
 *
 *   SEC-TIMING: src/lib/auth.ts#authenticateWithPassword now runs a dummy
 *   bcrypt.compare (src/lib/password.ts#compareDummyForTiming) on a
 *   nonexistent-user lookup, so that path isn't measurably faster than a
 *   real wrong-password attempt (which always ran bcrypt.compare).
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { testDb, resetDb, assertIsTestSchema } from '../helpers/test-db'
import { hashPassword } from '@/lib/password'
import { __resetRateLimitsForTests } from '@/lib/rate-limit'
import { createHash } from 'crypto'

vi.mock('@/lib/db', async () => ({
  db: (await import('../helpers/test-db')).testDb,
}))

const { POST: signup } = await import('@/app/api/auth/signup/route')
const { authenticateWithPassword } = await import('@/lib/auth')

const SIGNUP_URL = 'http://test.local/api/auth/signup'

function signupRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(SIGNUP_URL, {
    method: 'POST',
    body: JSON.stringify(body),
    // A real HTTP server always populates Host from the request line — a
    // hand-built NextRequest does not, so it's set explicitly here to
    // match SIGNUP_URL's own host (test.local), the same way isSameOriginRequest
    // (src/lib/same-origin.ts) reads it via req.headers.get('host') in production.
    headers: { 'content-type': 'application/json', host: 'test.local', ...headers },
  })
}

beforeAll(async () => {
  await assertIsTestSchema()
})
beforeEach(async () => {
  await resetDb()
  // Rate-limit buckets are a globalThis-backed singleton (rate-limit.ts),
  // shared across every test in this process — without clearing them,
  // whichever test happens to run first "spends" a real user's or IP's
  // budget for every test after it.
  __resetRateLimitsForTests()
})
afterAll(async () => {
  await resetDb()
})

describe('SEC-CSRF — /api/auth/signup rejects cross-origin requests', () => {
  it('a cross-origin Origin header is rejected with 403, no account created', async () => {
    const res = await signup(
      signupRequest(
        { role: 'player', email: 'csrf-cross-origin@test.local', password: 'GenuinelyStrong123' },
        { origin: 'https://evil.example.com' },
      ),
    )
    expect(res.status).toBe(403)
    expect((await res.json()).error).toMatch(/invalid request origin/i)

    const created = await testDb.user.findUnique({ where: { email: 'csrf-cross-origin@test.local' } })
    expect(created, 'a rejected cross-origin request must never create an account').toBeNull()
  })

  it('a cross-origin Referer (no Origin header) is also rejected', async () => {
    const res = await signup(
      signupRequest(
        { role: 'player', email: 'csrf-cross-referer@test.local', password: 'GenuinelyStrong123' },
        { referer: 'https://evil.example.com/attack-page' },
      ),
    )
    expect(res.status).toBe(403)
  })

  it('a request with neither Origin nor Referer is rejected (fail closed, not open)', async () => {
    const res = await signup(
      signupRequest({ role: 'player', email: 'csrf-no-header@test.local', password: 'GenuinelyStrong123' }),
    )
    expect(res.status).toBe(403)
  })

  it('a matching same-origin Origin header is accepted (the fix does not break real usage)', async () => {
    const res = await signup(
      signupRequest(
        { role: 'player', email: 'csrf-same-origin@test.local', password: 'GenuinelyStrong123' },
        { origin: 'http://test.local' },
      ),
    )
    expect(res.status).toBe(200)
    const created = await testDb.user.findUnique({ where: { email: 'csrf-same-origin@test.local' } })
    expect(created).not.toBeNull()
  })

  it('a matching same-origin Referer is accepted when Origin is absent', async () => {
    const res = await signup(
      signupRequest(
        { role: 'player', email: 'csrf-same-referer@test.local', password: 'GenuinelyStrong123' },
        { referer: 'http://test.local/auth' },
      ),
    )
    expect(res.status).toBe(200)
  })
})

describe('SEC-TIMING — nonexistent-user vs wrong-password response time', () => {
  it('stays within a generous tolerance of each other (was: near-instant vs a full bcrypt.compare)', async () => {
    await testDb.user.create({
      data: {
        email: 'timing-real-user@test.local',
        role: 'player',
        password_hash: await hashPassword('TheRealPassword123'),
      },
    })

    // Median of several samples, not a single call — bcrypt cost-10 timing
    // has natural jitter (GC, scheduler, CI noise). A single sample would
    // make this test flaky in either direction.
    async function median(fn: () => Promise<unknown>, samples = 5): Promise<number> {
      const times: number[] = []
      for (let i = 0; i < samples; i++) {
        const t0 = performance.now()
        await fn()
        times.push(performance.now() - t0)
      }
      times.sort((a, b) => a - b)
      return times[Math.floor(times.length / 2)]
    }

    const wrongPasswordMs = await median(() =>
      authenticateWithPassword('timing-real-user@test.local', 'DefinitelyWrongPassword123'),
    )
    const noSuchUserMs = await median(() =>
      authenticateWithPassword('no-such-user-at-all@test.local', 'WhateverPassword123'),
    )

    // Both paths now run exactly one bcrypt.compare (cost 10) — they should
    // land in the same ballpark. Before the fix, noSuchUserMs was a sub-
    // millisecond DB-miss return with no bcrypt at all, an order-of-
    // magnitude difference this ratio check would have caught easily.
    // Tolerance is deliberately generous (not the ~20% a single clean
    // sample might support) to avoid CI flakiness from system jitter,
    // while still failing hard on the kind of gap the old code had.
    const ratio = noSuchUserMs / wrongPasswordMs
    expect(
      ratio,
      `nonexistent-user (${noSuchUserMs.toFixed(1)}ms) vs wrong-password (${wrongPasswordMs.toFixed(1)}ms) ` +
        `timing ratio ${ratio.toFixed(2)} is outside the normalized range — timing-based user enumeration may be possible again`,
    ).toBeGreaterThan(0.5)
    expect(ratio).toBeLessThan(2.0)
  })
})

describe('SEC-IP-RATE-LIMIT — a spray attack across many emails from one IP still gets blocked', () => {
  it('30 failed attempts across 30 different emails from one IP blocks a 31st attempt, even with correct credentials', async () => {
    const ATTACKER_IP = '203.0.113.55' // TEST-NET-3 (RFC 5737) — not a real address
    const email = 'sec-ip-ratelimit-target@test.local'
    const password = 'TheRealPassword123'
    await testDb.user.create({
      data: { email, role: 'player', password_hash: await hashPassword(password) },
    })

    // 30 failed attempts, each against a DIFFERENT nonexistent email, all
    // from the same IP. None of these touch the per-email "login-password"
    // bucket for our real target account at all — a spray attack spread
    // across many identities is exactly the pattern the per-email bucket
    // alone cannot catch, since no single email's own count ever climbs.
    for (let i = 0; i < 30; i++) {
      const result = await authenticateWithPassword(`sec-ip-spray-${i}@test.local`, 'WhateverPassword123', ATTACKER_IP)
      expect(result, `attempt ${i} against an unrelated email should just fail normally, not be blocked yet`).toBeNull()
    }

    // The 31st request from the SAME ip, this time against the real
    // account with its CORRECT password. If only the per-email bucket
    // existed, this would succeed (that email has made zero prior
    // attempts of its own). The IP bucket must block it anyway.
    const result = await authenticateWithPassword(email, password, ATTACKER_IP)
    expect(
      result,
      "the IP's own bucket should now be exhausted (30/30), blocking even a correct login from that IP",
    ).toBeNull()

    // Sanity check: the SAME correct credentials from a DIFFERENT IP are
    // unaffected — proves this is genuinely IP-scoped, not a global lock.
    const fromDifferentIp = await authenticateWithPassword(email, password, '198.51.100.9')
    expect(fromDifferentIp).not.toBeNull()
    expect(fromDifferentIp?.email).toBe(email)
  })
})

describe('SEC-ALERT — repeated failed logins on one account log a structured alert line', () => {
  it('fires exactly once, at the 5th failure, not before and not again on the 6th', async () => {
    const email = 'sec-alert-target@test.local'
    await testDb.user.create({
      data: { email, role: 'player', password_hash: await hashPassword('TheRealPassword123') },
    })

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      for (let i = 1; i <= 4; i++) {
        await authenticateWithPassword(email, 'WrongPassword' + i, `10.0.0.${i}`)
      }
      expect(warnSpy, 'must not fire before the threshold').not.toHaveBeenCalled()

      await authenticateWithPassword(email, 'WrongPassword5', '10.0.0.5')
      expect(warnSpy, 'must fire exactly once at the 5th failure').toHaveBeenCalledTimes(1)
      const [line] = warnSpy.mock.calls[0]
      const parsed = JSON.parse(line as string)
      expect(parsed.event).toBe('auth.repeated_failed_logins')
      expect(parsed.email).toBe(email)
      expect(parsed.failureCount).toBe(5)
      // Explicitly NOT lockout — throttling/visibility only, per instruction.
      expect(parsed.note).toMatch(/no account lockout/i)

      await authenticateWithPassword(email, 'WrongPassword6', '10.0.0.6')
      expect(warnSpy, 'must not fire again on the 6th failure — once per threshold crossing, not every attempt after').toHaveBeenCalledTimes(1)
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('does not fire for a successful login, and does not fire for a nonexistent-user lookup below threshold', async () => {
    const email = 'sec-alert-success@test.local'
    const password = 'TheRealPassword123'
    await testDb.user.create({ data: { email, role: 'player', password_hash: await hashPassword(password) } })

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      await authenticateWithPassword(email, password, '10.0.1.1') // correct — no failure recorded
      await authenticateWithPassword('sec-alert-nosuch@test.local', 'whatever123', '10.0.1.2') // 1 of 5
      expect(warnSpy).not.toHaveBeenCalled()
    } finally {
      warnSpy.mockRestore()
    }
  })
})

describe('SEC-HIBP — Have I Been Pwned breach check on signup', () => {
  const SAME_ORIGIN_HEADERS = { origin: 'http://test.local' }
  let fetchSpy: ReturnType<typeof vi.spyOn>

  afterAll(() => {
    fetchSpy?.mockRestore()
  })

  it('a password flagged as breached by HIBP is rejected with the "too common" message', async () => {
    // A password that passes every LOCAL check (length, letter+digit mix,
    // not in the 19-entry hardcoded list) but gets flagged by a mocked HIBP
    // response — proving the breach check is a real additional gate, not
    // just re-testing the hardcoded list.
    const password = 'Sunshine98765'
    const sha1 = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase()
    const suffix = sha1.slice(5)

    fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(`${suffix}:3\r\nAAAA000000000000000000000000000000:1`, { status: 200 }),
    )

    const res = await signup(
      signupRequest(
        { role: 'player', email: 'hibp-breached@test.local', password },
        SAME_ORIGIN_HEADERS,
      ),
    )
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining(`https://api.pwnedpasswords.com/range/${sha1.slice(0, 5)}`),
      expect.anything(),
    )
    // The privacy point of k-anonymity: only the 5-char prefix is ever in
    // the request URL — the full hash and the plaintext password are not.
    const calledUrl = fetchSpy.mock.calls[0][0] as string
    expect(calledUrl).not.toContain(sha1)
    expect(calledUrl).not.toContain(password)

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('This password is too common — please choose a different one')

    const created = await testDb.user.findUnique({ where: { email: 'hibp-breached@test.local' } })
    expect(created, 'a breached password must never result in a created account').toBeNull()
  })

  it('HIBP unreachable/timing out fails OPEN — falls back to the hardcoded list, an uncommon password still succeeds', async () => {
    fetchSpy = vi.spyOn(global, 'fetch').mockRejectedValue(new Error('simulated network failure / timeout'))

    const res = await signup(
      signupRequest(
        { role: 'player', email: 'hibp-api-down@test.local', password: 'GenuinelyStrong123' },
        SAME_ORIGIN_HEADERS,
      ),
    )
    expect(res.status, 'signup must succeed despite the HIBP call failing — fail open, not fail closed').toBe(200)

    const created = await testDb.user.findUnique({ where: { email: 'hibp-api-down@test.local' } })
    expect(created).not.toBeNull()
  })
})
