/**
 * Security — same-origin protection on the routes that mint a session cookie
 * outside NextAuth's own CSRF-protected handler, per src/lib/same-origin.ts's
 * own criterion. signup/forgot-password/reset-password/change-password
 * already had the check; these six did not.
 *
 * The check is the first statement in each handler, so a rejected request
 * never reaches body parsing, feature-flag gates, OTP checks or the DB. The
 * positive control only proves a matching Origin is not refused by the
 * origin check itself — full same-origin success paths are covered by the
 * existing integration suites (onboard, claim-flow, association gate).
 */
import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', async () => ({
  db: (await import('../helpers/test-db')).testDb,
}))

const { POST: claimVerify } = await import('@/app/api/claim/verify/route')
const { POST: academyOnboard } = await import('@/app/api/academy/onboard/route')
const { POST: coachOnboard } = await import('@/app/api/coach/onboard/route')
const { POST: scoutOnboard } = await import('@/app/api/scout/onboard/route')
const { POST: associationSelfServe } = await import('@/app/api/associations/self-serve-onboard/route')
const { POST: playerOnboard } = await import('@/app/api/player/onboard/route')

const ROUTES: Array<[string, string, (req: NextRequest) => Promise<Response>]> = [
  ['claim/verify', 'http://test.local/api/claim/verify', claimVerify],
  ['academy/onboard', 'http://test.local/api/academy/onboard', academyOnboard],
  ['coach/onboard', 'http://test.local/api/coach/onboard', coachOnboard],
  ['scout/onboard', 'http://test.local/api/scout/onboard', scoutOnboard],
  ['associations/self-serve-onboard', 'http://test.local/api/associations/self-serve-onboard', associationSelfServe],
  ['player/onboard', 'http://test.local/api/player/onboard', playerOnboard],
]

function post(url: string, headers: Record<string, string>) {
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify({}),
    headers: { 'content-type': 'application/json', ...headers },
  })
}

describe.each(ROUTES)('same-origin — %s', (_name, url, handler) => {
  it('rejects a cross-origin POST with 403', async () => {
    const res = await handler(post(url, { origin: 'https://evil.example.com', host: 'test.local' }))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Invalid request origin' })
  })

  it('rejects a POST with neither Origin nor Referer (fails closed)', async () => {
    const res = await handler(post(url, { host: 'test.local' }))
    expect(res.status).toBe(403)
  })

  it('rejects a cross-origin Referer when Origin is absent', async () => {
    const res = await handler(post(url, { referer: 'https://evil.example.com/page', host: 'test.local' }))
    expect(res.status).toBe(403)
  })

  it('does not refuse a matching Origin on origin grounds', async () => {
    const res = await handler(post(url, { origin: 'http://test.local', host: 'test.local' }))
    const body = await res.json().catch(() => ({}))
    expect(body.error).not.toBe('Invalid request origin')
  })
})
