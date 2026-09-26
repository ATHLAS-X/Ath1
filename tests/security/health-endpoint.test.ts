/**
 * GET /api/health — public and unauthenticated (uptime monitors and load
 * balancers call it before any session exists). The body must be exactly two
 * fixed strings: never a connection string, env var name or value, driver
 * error text, stack trace or version.
 */
import { describe, it, expect, vi } from 'vitest'
import { testDb, assertIsTestSchema } from '../helpers/test-db'

vi.mock('@/lib/db', async () => ({
  db: (await import('../helpers/test-db')).testDb,
}))

const { GET: health } = await import('@/app/api/health/route')

describe('GET /api/health', () => {
  it('1. returns 200 {status:"ok", db:"ok"} when the database is reachable, with no auth', async () => {
    await assertIsTestSchema()
    const res = await health()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok', db: 'ok' })
  })

  it('2. the healthy body carries no connection string, env value, stack trace or version', async () => {
    const raw = JSON.stringify(await (await health()).json())
    expect(raw).not.toMatch(/postgres(ql)?:\/\//i)
    expect(raw).not.toMatch(/DATABASE_|NEXTAUTH|UPSTASH|SENTRY/i)
    expect(raw).not.toMatch(/at\s+\w+.*\(.*:\d+:\d+\)/)
    expect(raw).not.toMatch(/version/i)
  })

  it('3. returns 503 {status:"degraded", db:"down"} when the database is unreachable', async () => {
    const spy = vi.spyOn(testDb, '$queryRaw').mockRejectedValueOnce(new Error('connection to server at "db.internal.example.com" failed: password authentication failed'))
    try {
      const res = await health()
      expect(res.status).toBe(503)
      expect(await res.json()).toEqual({ status: 'degraded', db: 'down' })
    } finally {
      spy.mockRestore()
    }
  })

  it('4. never echoes the driver error when the database fails', async () => {
    const spy = vi.spyOn(testDb, '$queryRaw').mockRejectedValueOnce(new Error('FATAL: password authentication failed for user "postgres" at db.internal.example.com'))
    try {
      const raw = JSON.stringify(await (await health()).json())
      expect(raw).not.toMatch(/password authentication failed/)
      expect(raw).not.toMatch(/db\.internal\.example\.com/)
      expect(raw).not.toMatch(/postgres/)
    } finally {
      spy.mockRestore()
    }
  })

  it('5. is not cacheable', async () => {
    expect((await health()).headers.get('cache-control')).toBe('no-store')
  })
})
