/**
 * Sliding-window rate limiting. Uses Upstash Redis when configured
 * (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are set) so limits are
 * shared across serverless instances; otherwise falls back to an in-memory
 * window per process, which is fine for local dev / single-instance runs but
 * does NOT share state across multiple servers or restarts.
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // epoch ms
}

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

const limiters = new Map<string, Ratelimit>();

function getRedisLimiter(name: string, max: number, windowSeconds: number): Ratelimit {
  const key = `${name}:${max}:${windowSeconds}`;
  let limiter = limiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: redis!,
      limiter: Ratelimit.slidingWindow(max, `${windowSeconds} s`),
      prefix: `ratelimit:${name}`,
    });
    limiters.set(key, limiter);
  }
  return limiter;
}

/* In-memory fallback: per-key sliding window using a timestamp list.
   Single-process only — acceptable for local dev, not for multi-instance prod. */
const memoryHits = new Map<string, number[]>();

function memoryLimit(name: string, key: string, max: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const fullKey = `${name}:${key}`;
  const hits = (memoryHits.get(fullKey) ?? []).filter((t) => now - t < windowMs);

  if (hits.length >= max) {
    const reset = hits[0] + windowMs;
    memoryHits.set(fullKey, hits);
    return { success: false, limit: max, remaining: 0, reset };
  }

  hits.push(now);
  memoryHits.set(fullKey, hits);
  /* Opportunistic cleanup so the map doesn't grow unbounded over the process lifetime. */
  if (memoryHits.size > 5000) {
    for (const [k, v] of memoryHits) {
      if (v.every((t) => now - t >= windowMs)) memoryHits.delete(k);
    }
  }
  return { success: true, limit: max, remaining: max - hits.length, reset: now + windowMs };
}

/**
 * Check + consume one unit from the named sliding-window limiter for `key`.
 *
 *   await rateLimit("otp-send", phone, 5, 3600)   // 5 per hour
 */
export async function rateLimit(
  name: string,
  key: string,
  max: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  if (redis) {
    const limiter = getRedisLimiter(name, max, windowSeconds);
    const res = await limiter.limit(key);
    return { success: res.success, limit: res.limit, remaining: res.remaining, reset: res.reset };
  }
  return memoryLimit(name, key, max, windowSeconds);
}

/**
 * Failed-attempt lockout: unlike `rateLimit`, this only consumes a unit when
 * explicitly told to (on a failed attempt), and `isLockedOut` only reads the
 * current count. Used for login throttling where successful attempts must
 * not count against the window.
 *
 *   if (await isLockedOut("login-fail", email, 10, 900)) return null;
 *   ...
 *   if (!passwordOk) { await recordFailedAttempt("login-fail", email, 900); return null; }
 */
export async function isLockedOut(
  name: string,
  key: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  const fullKey = `lockout:${name}:${key}`;
  if (redis) {
    const count = await redis.get<number>(fullKey);
    return (count ?? 0) >= max;
  }
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const hits = (memoryHits.get(fullKey) ?? []).filter((t) => now - t < windowMs);
  memoryHits.set(fullKey, hits);
  return hits.length >= max;
}

export async function recordFailedAttempt(name: string, key: string, windowSeconds: number): Promise<void> {
  const fullKey = `lockout:${name}:${key}`;
  if (redis) {
    const count = await redis.incr(fullKey);
    if (count === 1) await redis.expire(fullKey, windowSeconds);
    return;
  }
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const hits = (memoryHits.get(fullKey) ?? []).filter((t) => now - t < windowMs);
  hits.push(now);
  memoryHits.set(fullKey, hits);
}

export function rateLimitResponse(result: RateLimitResult) {
  const retryAfterSec = Math.max(0, Math.ceil((result.reset - Date.now()) / 1000));
  return new Response(
    JSON.stringify({ success: false, error: "Too many requests — please try again later" }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSec),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
      },
    },
  );
}
