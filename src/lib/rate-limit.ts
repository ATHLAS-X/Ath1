/**
 * Sliding-window rate limiting. No UPSTASH_REDIS_REST_URL/TOKEN is
 * configured in this environment, so this is an in-memory-per-process
 * implementation only — fine for single-instance/local/test use, does NOT
 * share state across multiple server instances or survive a restart.
 * @upstash/ratelimit + @upstash/redis are already listed dependencies
 * (unused elsewhere in this codebase); wiring a real Redis-backed limiter
 * later means swapping this module's internals, not its call sites.
 */

// globalThis-backed, not a plain module-level const — Next.js dev mode can
// dispose and recompile a route handler's module after a period of
// inactivity (its on-demand-entries GC), which would silently reset a
// plain module-level Map and make rate limits (and previously, pending
// OTPs elsewhere) intermittently forget state that was set moments
// earlier. Attaching to globalThis survives that recompilation the same
// way src/lib/db.ts's Prisma singleton already does.
const globalForRateLimit = globalThis as unknown as { __athlasxRateLimitBuckets?: Map<string, number[]> }
const buckets = globalForRateLimit.__athlasxRateLimitBuckets ?? new Map<string, number[]>()
globalForRateLimit.__athlasxRateLimitBuckets = buckets

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetMs: number
}

/** Test-only escape hatch — the in-memory bucket map persists across every
 *  test in a file (it's a module-level singleton), so a suite exercising a
 *  rate-limited route many times with the same key needs a way to clear
 *  state between tests, the same way resetDb() clears the database. */
export function __resetRateLimitsForTests(): void {
  buckets.clear()
}

export function rateLimit(name: string, key: string, max: number, windowSeconds: number): RateLimitResult {
  const bucketKey = `${name}:${key}`
  const now = Date.now()
  const windowMs = windowSeconds * 1000
  const hits = (buckets.get(bucketKey) ?? []).filter((t) => now - t < windowMs)

  if (hits.length >= max) {
    const oldestInWindow = hits[0]
    return { success: false, remaining: 0, resetMs: oldestInWindow + windowMs - now }
  }

  hits.push(now)
  buckets.set(bucketKey, hits)
  return { success: true, remaining: max - hits.length, resetMs: windowMs }
}
