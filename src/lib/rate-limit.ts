import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/**
 * Sliding-window rate limiting — shared across every server instance when
 * Upstash Redis is configured, per-process otherwise.
 *
 * This app runs on Vercel, where each concurrent function instance has its
 * own memory. An in-memory counter there multiplies every limit by the number
 * of warm instances and resets on every cold start. With
 * UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN set, every instance
 * counts against the same Redis bucket. Without them — local dev, tests — the
 * in-memory implementation below is used, unchanged.
 *
 * Async because a shared store needs a network round trip, so every call site
 * awaits it.
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

function inMemoryRateLimit(name: string, key: string, max: number, windowSeconds: number): RateLimitResult {
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

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN
const redis = UPSTASH_URL && UPSTASH_TOKEN ? new Redis({ url: UPSTASH_URL, token: UPSTASH_TOKEN }) : null

// A Ratelimit instance fixes its window parameters, and every bucket in this
// codebase always uses the same parameters — so one instance per
// (bucket, max, window) keeps this map exactly as small as the bucket list.
const limiters = new Map<string, Ratelimit>()

function limiterFor(redisClient: Redis, name: string, max: number, windowSeconds: number): Ratelimit {
  const id = `${name}:${max}:${windowSeconds}`
  let limiter = limiters.get(id)
  if (!limiter) {
    const window: `${number} s` = `${windowSeconds} s`
    limiter = new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(max, window),
      prefix: `athlasx:rl:${name}`,
      analytics: false,
      // Short, because these checks sit in front of sign-in and signup. On
      // timeout Upstash allows the request rather than blocking real users.
      timeout: 1000,
    })
    limiters.set(id, limiter)
  }
  return limiter
}

export async function rateLimit(name: string, key: string, max: number, windowSeconds: number): Promise<RateLimitResult> {
  if (!redis) return inMemoryRateLimit(name, key, max, windowSeconds)

  try {
    const result = await limiterFor(redis, name, max, windowSeconds).limit(key)
    return { success: result.success, remaining: result.remaining, resetMs: Math.max(0, result.reset - Date.now()) }
  } catch (err) {
    // A Redis outage must neither take sign-in down with it nor silently
    // remove limiting: fall back to this instance's own counter, and say so.
    // eslint-disable-next-line no-console
    console.warn(
      JSON.stringify({
        event: 'rate_limit.redis_unavailable',
        bucket: name,
        error: err instanceof Error ? err.message : String(err),
        note: 'fell back to the per-instance in-memory limiter for this request',
      }),
    )
    return inMemoryRateLimit(name, key, max, windowSeconds)
  }
}
