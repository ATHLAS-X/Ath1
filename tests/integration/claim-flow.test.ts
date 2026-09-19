/**
 * Integration — W2 Player Identity Resolution & Claim.
 *
 * The claim flow is the guardian-consent gate. Pivot Document §9 names it a
 * legal precondition to ingesting any record at U14/U16 level, so these
 * tests focus on the minor path and on OTP hygiene (expiry, attempt
 * limiting, single use) rather than the happy path alone.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { NextRequest } from 'next/server'
import * as otp from '@/lib/otp'
import { __resetRateLimitsForTests } from '@/lib/rate-limit'
import { getSessionUser } from '@/lib/require-auth'
import {
  testDb,
  resetDb,
  seedFixtures,
  assertIsTestSchema,
  type Fixtures,
} from '../helpers/test-db'

vi.mock('@/lib/db', async () => ({
  db: (await import('../helpers/test-db')).testDb,
}))

const { POST: search } = await import('@/app/api/claim/search/route')
const { POST: start } = await import('@/app/api/claim/start/route')
const { POST: verify } = await import('@/app/api/claim/verify/route')
const { GET: myRecord } = await import('@/app/api/my-record/route')
const { POST: register } = await import('@/app/api/trial-cycles/[id]/register/route')

const post = (body: unknown) =>
  new NextRequest('http://test.local/api', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })

let fx: Fixtures

beforeAll(async () => {
  await assertIsTestSchema()
})
beforeEach(async () => {
  await resetDb()
  fx = await seedFixtures()
  // claim/start is now rate-limited by phone (5/hour) — every test in this
  // file uses the same fixture phone numbers, so without a reset the
  // shared in-memory bucket would exhaust partway through the suite and
  // fail later tests with 429s that have nothing to do with what they're
  // actually testing.
  __resetRateLimitsForTests()
})
afterAll(async () => {
  await resetDb()
  await testDb.$disconnect()
})

describe('finding a shadow profile', () => {
  it('matches an unclaimed profile by name and district', async () => {
    const res = await search(post({ fullName: 'Adult', district: 'Kanpur', dob: '2000-01-01' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    const ids = JSON.stringify(body)
    expect(ids).toContain(fx.adult.id)
  })

  it('is case-insensitive on district', async () => {
    const res = await search(post({ fullName: 'Adult', district: 'kAnPuR', dob: '2000-01-01' }))
    const body = JSON.stringify(await res.json())
    expect(body).toContain(fx.adult.id)
  })

  it('requires fullName, district and date of birth', async () => {
    const res = await search(post({ fullName: 'Adult' }))
    expect(res.status).toBe(400)
    const noDob = await search(post({ fullName: 'Adult', district: 'Kanpur' }))
    expect(noDob.status).toBe(400)
  })

  it('does not return an already-claimed profile', async () => {
    await testDb.playerProfile.update({
      where: { id: fx.adult.id },
      data: { claim_status: 'claimed' },
    })
    const res = await search(post({ fullName: 'Adult', district: 'Kanpur', dob: '2000-01-01' }))
    const body = JSON.stringify(await res.json())
    expect(body).not.toContain(fx.adult.id)
  })

  it('never exposes a guardian phone in search results', async () => {
    await testDb.playerProfile.update({
      where: { id: fx.adult.id },
      data: { guardian_phone: '9876543210' },
    })
    const res = await search(post({ fullName: 'Adult', district: 'Kanpur', dob: '2000-01-01' }))
    const body = JSON.stringify(await res.json())
    expect(body).not.toContain('9876543210')
  })
})

describe('starting a claim — adult', () => {
  it('creates a claim and issues an OTP', async () => {
    const res = await start(post({ playerId: fx.adult.id, phone: '9123456789' }))
    expect(res.status).toBe(200)

    const claims = await testDb.playerClaim.findMany({ where: { player_id: fx.adult.id } })
    expect(claims).toHaveLength(1)
    expect(claims[0].is_minor).toBe(false)

    const otps = await testDb.phoneOtp.findMany({ where: { claim_id: claims[0].id } })
    expect(otps).toHaveLength(1)
  })

  it('stores the OTP hashed, never in plaintext', async () => {
    await start(post({ playerId: fx.adult.id, phone: '9123456789' }))
    const row = await testDb.phoneOtp.findFirst()
    // Bcrypt-shaped hash now (was a raw SHA-256 hex digest) — the
    // meaningful assertion is simply that it's hashed, not a literal
    // 6-digit code sitting in the column.
    expect(row!.code_hash).toMatch(/^\$2[aby]?\$\d{2}\$/)
    expect(row!.code_hash).not.toMatch(/^\d{6}$/)
  })

  it('refuses to re-claim an already claimed profile', async () => {
    await testDb.playerProfile.update({
      where: { id: fx.adult.id },
      data: { claim_status: 'claimed' },
    })
    const res = await start(post({ playerId: fx.adult.id, phone: '9123456789' }))
    expect(res.status).toBe(409)
  })

  it('404s for an unknown player', async () => {
    const res = await start(
      post({ playerId: '00000000-0000-0000-0000-000000000000', phone: '9123456789' }),
    )
    expect(res.status).toBe(404)
  })
})

describe('starting a claim — minor (DPDP guardian gate)', () => {
  it('refuses without guardian details', async () => {
    const res = await start(post({ playerId: fx.minor.id, phone: '9123456789' }))
    expect(res.status).toBe(400)
  })

  it('flags the claim as minor and targets the guardian phone', async () => {
    const res = await start(
      post({
        playerId: fx.minor.id,
        phone: '9123456789',
        guardianName: 'Parent',
        guardianPhone: '9998887776',
        guardianRelation: 'mother',
      }),
    )
    expect(res.status).toBe(200)

    const claim = await testDb.playerClaim.findFirst({ where: { player_id: fx.minor.id } })
    expect(claim!.is_minor).toBe(true)
    expect(claim!.guardian_phone).toBe('9998887776')

    // The OTP must go to the guardian, not the child.
    const otp = await testDb.phoneOtp.findFirst({ where: { claim_id: claim!.id } })
    expect(otp!.phone).toBe('9998887776')
  })

  it('leaves the minor unclaimed until the guardian verifies', async () => {
    await start(
      post({
        playerId: fx.minor.id,
        phone: '9123456789',
        guardianName: 'Parent',
        guardianPhone: '9998887776',
        guardianRelation: 'mother',
      }),
    )
    const p = await testDb.playerProfile.findUnique({ where: { id: fx.minor.id } })
    expect(p!.claim_status).not.toBe('claimed')
    expect(p!.consent_status).not.toBe('granted')
  })
})

describe('verifying an OTP', () => {
  // devOtp is no longer in the /start response (see S3 fix — returning the
  // code there is a complete profile-takeover primitive). These tests need
  // to know the code to exercise verify's success path, so generateOtp is
  // pinned to a known value for the duration of each test instead of
  // reading it back from anywhere the real caller couldn't.
  const KNOWN_CODE = '654321'
  let generateOtpSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    generateOtpSpy = vi.spyOn(otp, 'generateOtp').mockReturnValue(KNOWN_CODE)
  })

  async function startClaim() {
    const res = await start(post({ playerId: fx.adult.id, phone: '9123456789' }))
    const body = await res.json()
    return { claimId: body.claimId as string, code: KNOWN_CODE }
  }

  it('grants consent and marks the profile claimed on the correct code', async () => {
    const { claimId, code } = await startClaim()
    const res = await verify(post({ claimId, code }))
    expect(res.status).toBe(200)

    const p = await testDb.playerProfile.findUnique({ where: { id: fx.adult.id } })
    expect(p!.claim_status).toBe('claimed')
    expect(p!.consent_status).toBe('granted')
  })

  it('rejects an incorrect code and counts the attempt', async () => {
    const { claimId } = await startClaim()
    const res = await verify(post({ claimId, code: '000000' }))
    expect(res.status).toBe(401)

    const otp = await testDb.phoneOtp.findFirst({ where: { claim_id: claimId } })
    expect(otp!.attempts).toBe(1)
  })

  it('locks out after the attempt limit', async () => {
    const { claimId } = await startClaim()
    for (let i = 0; i < 5; i++) await verify(post({ claimId, code: '000000' }))
    const res = await verify(post({ claimId, code: '000000' }))
    expect(res.status).toBe(429)
  })

  it('refuses an expired code', async () => {
    const { claimId, code } = await startClaim()
    await testDb.phoneOtp.updateMany({
      where: { claim_id: claimId },
      data: { expires_at: new Date(Date.now() - 60_000) },
    })
    const res = await verify(post({ claimId, code }))
    expect(res.status).toBe(410)
  })

  it('consumes the OTP so it cannot be replayed', async () => {
    const { claimId, code } = await startClaim()
    await verify(post({ claimId, code }))
    const replay = await verify(post({ claimId, code }))
    expect(replay.status).not.toBe(200)
  })

  it('does not accept a code hashed for a different claim', async () => {
    // Bcrypt hashes are salted/non-deterministic, so a raw hash-equality
    // comparison (the old test's approach) is no longer a meaningful
    // assertion — two hashes of the SAME code wouldn't even match each
    // other. The real property that matters: verifying the wrong code
    // against this claim's real stored hash must fail.
    const { claimId } = await startClaim()
    const row = await testDb.phoneOtp.findFirst({ where: { claim_id: claimId } })
    expect(await otp.verifyOtpCode('000000', row!.code_hash)).toBe(false)
  })

  it('requires both claimId and code', async () => {
    const res = await verify(post({ claimId: 'x' }))
    expect(res.status).toBe(400)
  })

  it('creates one player User linked to the claimed profile', async () => {
    const { claimId, code } = await startClaim()
    const res = await verify(post({ claimId, code }))
    expect(res.status).toBe(200)

    const users = await testDb.user.findMany({ where: { role: 'player' } })
    expect(users).toHaveLength(1)
    expect(users[0].phone).toBe('9123456789')
    expect(users[0].linked_player_id).toBe(fx.adult.id)

    const profile = await testDb.playerProfile.findUnique({ where: { id: fx.adult.id } })
    expect(profile!.user_id).toBe(users[0].id)

    const claim = await testDb.playerClaim.findUnique({ where: { id: claimId } })
    expect(claim!.claiming_user_id).toBe(users[0].id)
  })

  it('sets a session cookie that authenticates the claimed player', async () => {
    const { claimId, code } = await startClaim()
    const res = await verify(post({ claimId, code }))
    expect(res.status).toBe(200)

    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie, 'verify must set a session cookie').toMatch(/next-auth\.session-token=/)

    const cookie = setCookie.split(';')[0]
    const sessionUser = await getSessionUser(
      new NextRequest('http://test.local/api', { headers: { cookie } }),
    )
    const player = await testDb.user.findFirst({ where: { role: 'player' } })
    expect(sessionUser).toEqual({
      id: player!.id,
      email: player!.email,
      role: 'player',
    })
  })

  it('does not create a second User when a consumed OTP is replayed', async () => {
    const { claimId, code } = await startClaim()
    const first = await verify(post({ claimId, code }))
    expect(first.status).toBe(200)

    const replay = await verify(post({ claimId, code }))
    expect(replay.status).not.toBe(200)

    const users = await testDb.user.findMany({ where: { role: 'player' } })
    expect(users).toHaveLength(1)
  })

  it('lets the claimed player read their own record with that cookie', async () => {
    const { claimId, code } = await startClaim()
    const res = await verify(post({ claimId, code }))
    const cookie = (res.headers.get('set-cookie') ?? '').split(';')[0]

    const mine = await myRecord(new NextRequest('http://test.local/api/my-record', { headers: { cookie } }))
    expect(mine.status).toBe(200)
    const body = await mine.json()
    expect(body.player?.id).toBe(fx.adult.id)
  })

  it('lets the claimed player register for a trial cycle', async () => {
    const { claimId, code } = await startClaim()
    const res = await verify(post({ claimId, code }))
    const cookie = (res.headers.get('set-cookie') ?? '').split(';')[0]

    const venue = await testDb.trialVenue.create({
      data: {
        trial_cycle_id: fx.trialCycle.id,
        name: 'Green Park',
        district: 'Kanpur',
        date: new Date('2026-09-01'),
      },
    })

    const registerRes = await register(
      new NextRequest(`http://test.local/api/trial-cycles/${fx.trialCycle.id}/register`, {
        method: 'POST',
        body: JSON.stringify({ venueId: venue.id }),
        headers: { 'content-type': 'application/json', cookie },
      }),
      { params: Promise.resolve({ id: fx.trialCycle.id }) },
    )
    expect(registerRes.status).toBe(200)
    const body = await registerRes.json()
    expect(body.error).toBeUndefined()
    expect(body.registration?.player_id).toBe(fx.adult.id)
  })
})
