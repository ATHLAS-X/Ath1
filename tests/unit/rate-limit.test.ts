/**
 * Unit tests — the rate-limit adapter (src/lib/rate-limit.ts).
 *
 * Covers both halves of the dual-mode design without depending on a live
 * Redis: with no UPSTASH_REDIS_REST_URL/TOKEN the in-memory sliding-window
 * limiter runs (the same path local dev uses), and with them set the
 * @upstash/* packages are mocked so the shared-limiter path, its per-bucket
 * limiter reuse, and the fall-back-to-memory-on-error behaviour are all
 * exercised deterministically.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { rateLimit, __resetRateLimitsForTests } from '@/lib/rate-limit'

beforeEach(() => {
  __resetRateLimitsForTests()
})

describe('rateLimit — in-memory fallback (no Upstash configured in test env)', () => {
  it('1. a request below the threshold succeeds', async () => {
    const result = await rateLimit('test-bucket', 'user-a', 5, 60)
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('2. exceeding the threshold returns success: false, remaining: 0', async () => {
    for (let i = 0; i < 3; i++) await rateLimit('test-bucket-2', 'user-a', 3, 60)
    const result = await rateLimit('test-bucket-2', 'user-a', 3, 60)
    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.resetMs).toBeGreaterThan(0)
  })

  it('3. the bucket resets after the window elapses', async () => {
    vi.useFakeTimers()
    try {
      for (let i = 0; i < 2; i++) await rateLimit('test-bucket-3', 'user-a', 2, 10)
      const blocked = await rateLimit('test-bucket-3', 'user-a', 2, 10)
      expect(blocked.success).toBe(false)

      vi.advanceTimersByTime(11_000)
      const afterWindow = await rateLimit('test-bucket-3', 'user-a', 2, 10)
      expect(afterWindow.success).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('4. two callers sharing the same bucket name AND key correctly share state (intended sharing, e.g. two routes protecting the same resource)', async () => {
    // Simulates "route A" and "route B" both rate-limiting the same login
    // identity under one shared bucket name — this is the pattern
    // login-password/login-password-ip and every OTP send/verify pair use.
    await rateLimit('shared-bucket', 'same-email@test.local', 2, 60)
    await rateLimit('shared-bucket', 'same-email@test.local', 2, 60)
    const thirdCall = await rateLimit('shared-bucket', 'same-email@test.local', 2, 60)
    expect(thirdCall.success).toBe(false)
  })

  it('5. different keys under the same bucket name are fully isolated (unrelated users never share a user-specific bucket)', async () => {
    await rateLimit('per-user-bucket', 'user-a@test.local', 1, 60)
    const userB = await rateLimit('per-user-bucket', 'user-b@test.local', 1, 60)
    expect(userB.success, "user-b's own first request must not be blocked by user-a's usage").toBe(true)
  })

  it('6. the bucket is determined solely by the key string passed in — a caller cannot bypass an IP-keyed bucket by varying unrelated data, since nothing but `key` is ever consulted', async () => {
    const ip = '203.0.113.7'
    // Two "requests" with wildly different bodies but the same resolved
    // IP key must share one bucket — proving body content can never
    // influence which bucket a call lands in.
    await rateLimit('ip-keyed-bucket', ip, 1, 60)
    const second = await rateLimit('ip-keyed-bucket', ip, 1, 60)
    expect(second.success).toBe(false)
  })

  it('__resetRateLimitsForTests clears all bucket state between tests', async () => {
    await rateLimit('reset-check', 'x', 1, 60)
    const blockedBeforeReset = await rateLimit('reset-check', 'x', 1, 60)
    expect(blockedBeforeReset.success).toBe(false)

    __resetRateLimitsForTests()
    const afterReset = await rateLimit('reset-check', 'x', 1, 60)
    expect(afterReset.success).toBe(true)
  })
})

type UpstashVerdict = { success: boolean; remaining: number; reset: number }

/** Loads a fresh copy of the adapter with Upstash env vars set and the
 *  @upstash/* packages replaced by mocks — no network, no real Redis. */
async function loadWithMockedUpstash(limitImpl: (key: string) => Promise<UpstashVerdict>, configured = true) {
  vi.stubEnv('UPSTASH_REDIS_REST_URL', configured ? 'https://mock-upstash.example.com' : '')
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', configured ? 'mock-token-not-a-secret' : '')
  vi.resetModules()
  const limit = vi.fn(limitImpl)
  const ctor = vi.fn()
  const slidingWindow = vi.fn((max: number, window: string) => ({ max, window }))
  class MockRatelimit {
    static slidingWindow = slidingWindow
    constructor(opts: unknown) { ctor(opts) }
    limit = limit
  }
  vi.doMock('@upstash/ratelimit', () => ({ Ratelimit: MockRatelimit }))
  vi.doMock('@upstash/redis', () => ({ Redis: class {} }))
  const mod = await import('@/lib/rate-limit')
  return { rateLimit: mod.rateLimit, limit, ctor, slidingWindow }
}

describe('rateLimit — Upstash-backed path (client mocked)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.doUnmock('@upstash/ratelimit')
    vi.doUnmock('@upstash/redis')
    vi.resetModules()
  })

  it('uses the shared limiter when configured and returns its verdict', async () => {
    const { rateLimit: rl, limit, ctor, slidingWindow } = await loadWithMockedUpstash(async () => ({ success: true, remaining: 4, reset: Date.now() + 30_000 }))
    const result = await rl('otp-send', 'user-key', 5, 60)
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(4)
    expect(result.resetMs).toBeGreaterThan(0)
    expect(result.resetMs).toBeLessThanOrEqual(30_000)
    expect(limit).toHaveBeenCalledWith('user-key')
    expect(slidingWindow).toHaveBeenCalledWith(5, '60 s')
    expect(ctor).toHaveBeenCalledWith(expect.objectContaining({ prefix: 'athlasx:rl:otp-send' }))
  })

  it('reports a blocked request when the shared limiter says so', async () => {
    const { rateLimit: rl } = await loadWithMockedUpstash(async () => ({ success: false, remaining: 0, reset: Date.now() + 10_000 }))
    const result = await rl('login', 'user-key', 5, 60)
    expect(result).toMatchObject({ success: false, remaining: 0 })
  })

  it('creates one limiter per bucket configuration, not one per call', async () => {
    const { rateLimit: rl, ctor } = await loadWithMockedUpstash(async () => ({ success: true, remaining: 1, reset: Date.now() + 1000 }))
    await rl('same-bucket', 'a', 5, 60)
    await rl('same-bucket', 'b', 5, 60)
    expect(ctor).toHaveBeenCalledTimes(1)
  })

  it('falls back to the in-memory limiter, still enforcing the limit, when Redis throws', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const { rateLimit: rl } = await loadWithMockedUpstash(async () => { throw new Error('redis down') })
      const first = await rl('fail-open', 'k', 1, 60)
      const second = await rl('fail-open', 'k', 1, 60)
      expect(first.success).toBe(true)
      expect(second.success).toBe(false)
      expect(warnSpy).toHaveBeenCalled()
      const logged = String(warnSpy.mock.calls[0][0])
      expect(logged).toContain('rate_limit.redis_unavailable')
      expect(logged).not.toContain('mock-token-not-a-secret')
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('never builds an Upstash limiter when the env vars are absent', async () => {
    const { rateLimit: rl, ctor, limit } = await loadWithMockedUpstash(async () => ({ success: true, remaining: 1, reset: Date.now() + 1000 }), false)
    const result = await rl('unconfigured', 'k', 5, 60)
    expect(result.success).toBe(true)
    expect(ctor).not.toHaveBeenCalled()
    expect(limit).not.toHaveBeenCalled()
  })
})
