/**
 * Tests for the password-reset flow:
 *   - src/lib/password-reset.ts (token creation/consumption)
 *   - POST /api/auth/forgot-password
 *   - POST /api/auth/reset-password
 *
 * PasswordResetToken is a DRAFT model (prisma/schema.prisma +
 * prisma/manual_migrations/password_reset_tokens.sql) — pushed only to the
 * isolated athlasx_test schema via `node scripts/setup-test-db.mjs`, never
 * to the live "athlasx" schema. These tests exercise the test schema only.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { testDb, resetDb, assertIsTestSchema } from '../helpers/test-db'
import { hashPassword } from '@/lib/password'
import { __resetRateLimitsForTests } from '@/lib/rate-limit'

vi.mock('@/lib/db', async () => ({
  db: (await import('../helpers/test-db')).testDb,
}))
vi.mock('@/lib/send-password-reset-email', () => ({
  sendPasswordResetEmail: vi.fn(),
  canDeliverPasswordResetEmail: () => true,
}))

const { createPasswordResetToken, consumePasswordResetToken } = await import('@/lib/password-reset')
const { sendPasswordResetEmail } = await import('@/lib/send-password-reset-email')
const { POST: forgotPassword } = await import('@/app/api/auth/forgot-password/route')
const { POST: resetPassword } = await import('@/app/api/auth/reset-password/route')

const ORIGIN_HEADERS = { origin: 'http://test.local', host: 'test.local' }

function jsonRequest(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...ORIGIN_HEADERS, ...headers },
  })
}

beforeAll(async () => {
  await assertIsTestSchema()
})
beforeEach(async () => {
  await resetDb()
  __resetRateLimitsForTests()
  vi.mocked(sendPasswordResetEmail).mockClear()
})
afterAll(async () => {
  await resetDb()
})

describe('password-reset.ts — token lifecycle', () => {
  it('a freshly created token is consumed exactly once', async () => {
    const user = await testDb.user.create({
      data: { email: 'reset-lifecycle@test.local', role: 'player', password_hash: await hashPassword('OldPassword123') },
    })

    const token = await createPasswordResetToken(user.id)

    const first = await consumePasswordResetToken(token)
    expect(first?.userId).toBe(user.id)

    // REUSE: the exact same token, presented again, must be rejected.
    const second = await consumePasswordResetToken(token)
    expect(second, 'a token must not be redeemable a second time').toBeNull()
  })

  it('an expired token is rejected', async () => {
    const user = await testDb.user.create({
      data: { email: 'reset-expired@test.local', role: 'player', password_hash: await hashPassword('OldPassword123') },
    })
    const token = await createPasswordResetToken(user.id)

    // Backdate expires_at directly — simulates the 30-minute TTL having
    // already elapsed, without an actual 30-minute wait in the test.
    const hash = (await import('crypto')).createHash('sha256').update(token, 'utf8').digest('hex')
    await testDb.passwordResetToken.update({
      where: { token_hash: hash },
      data: { expires_at: new Date(Date.now() - 1000) },
    })

    const result = await consumePasswordResetToken(token)
    expect(result, 'an expired token must never be consumable').toBeNull()
  })

  it('a nonexistent token is rejected without throwing', async () => {
    const result = await consumePasswordResetToken('0'.repeat(64))
    expect(result).toBeNull()
  })

  it('concurrent redemption of the same token succeeds exactly once (race-safe)', async () => {
    const user = await testDb.user.create({
      data: { email: 'reset-race@test.local', role: 'player', password_hash: await hashPassword('OldPassword123') },
    })
    const token = await createPasswordResetToken(user.id)

    const [a, b] = await Promise.all([consumePasswordResetToken(token), consumePasswordResetToken(token)])
    const successes = [a, b].filter((r) => r !== null)
    expect(successes, 'exactly one of two concurrent redemptions should win').toHaveLength(1)
  })
})

describe('POST /api/auth/forgot-password — identical response regardless of account existence', () => {
  it('existing account: response is the generic message, a token is created, the stub "email" fires', async () => {
    await testDb.user.create({
      data: { email: 'forgot-exists@test.local', role: 'player', password_hash: await hashPassword('Whatever123') },
    })

    const res = await forgotPassword(jsonRequest('http://test.local/api/auth/forgot-password', { email: 'forgot-exists@test.local' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, message: 'If an account exists for that email, a password reset link has been sent.' })
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1)
    expect(vi.mocked(sendPasswordResetEmail).mock.calls[0][0]).toBe('forgot-exists@test.local')

    const tokenCount = await testDb.passwordResetToken.count()
    expect(tokenCount).toBe(1)
  })

  it('nonexistent account: BYTE-IDENTICAL response, no token created, no "email" sent', async () => {
    const res = await forgotPassword(jsonRequest('http://test.local/api/auth/forgot-password', { email: 'forgot-nosuchaccount@test.local' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, message: 'If an account exists for that email, a password reset link has been sent.' })
    expect(sendPasswordResetEmail).not.toHaveBeenCalled()

    const tokenCount = await testDb.passwordResetToken.count()
    expect(tokenCount).toBe(0)
  })

  it('the two responses above are identical at the JSON level, not just "similar"', async () => {
    await testDb.user.create({
      data: { email: 'forgot-compare-exists@test.local', role: 'player', password_hash: await hashPassword('Whatever123') },
    })

    const existsRes = await forgotPassword(
      jsonRequest('http://test.local/api/auth/forgot-password', { email: 'forgot-compare-exists@test.local' }),
    )
    const missingRes = await forgotPassword(
      jsonRequest('http://test.local/api/auth/forgot-password', { email: 'forgot-compare-missing@test.local' }),
    )

    expect(existsRes.status).toBe(missingRes.status)
    expect(await existsRes.json()).toEqual(await missingRes.json())
  })
})

describe('POST /api/auth/reset-password — end to end', () => {
  it('a valid token sets the new password, which then authenticates', async () => {
    const { authenticateWithPassword } = await import('@/lib/auth')
    const user = await testDb.user.create({
      data: { email: 'reset-e2e@test.local', role: 'player', password_hash: await hashPassword('OldPassword123') },
    })
    const token = await createPasswordResetToken(user.id)

    const res = await resetPassword(
      jsonRequest('http://test.local/api/auth/reset-password', { token, password: 'BrandNewPassword456' }),
    )
    expect(res.status).toBe(200)

    const oldStillWorks = await authenticateWithPassword('reset-e2e@test.local', 'OldPassword123', '203.0.113.1')
    expect(oldStillWorks, 'the old password must no longer authenticate').toBeNull()

    const newWorks = await authenticateWithPassword('reset-e2e@test.local', 'BrandNewPassword456', '203.0.113.2')
    expect(newWorks?.email).toBe('reset-e2e@test.local')
  })

  it('reusing the same token a second time is rejected, and does not change the password again', async () => {
    const user = await testDb.user.create({
      data: { email: 'reset-noreuse@test.local', role: 'player', password_hash: await hashPassword('OldPassword123') },
    })
    const token = await createPasswordResetToken(user.id)

    const first = await resetPassword(jsonRequest('http://test.local/api/auth/reset-password', { token, password: 'FirstNewPassword1' }))
    expect(first.status).toBe(200)

    const second = await resetPassword(jsonRequest('http://test.local/api/auth/reset-password', { token, password: 'SecondNewPassword2' }))
    expect(second.status).toBe(400)
    expect((await second.json()).error).toMatch(/invalid or has expired/i)

    const { authenticateWithPassword } = await import('@/lib/auth')
    const firstStillWorks = await authenticateWithPassword('reset-noreuse@test.local', 'FirstNewPassword1', '203.0.113.3')
    expect(firstStillWorks?.email).toBe('reset-noreuse@test.local')
  })

  it('rejects a weak password without consuming the token (token still redeemable with a strong one)', async () => {
    const user = await testDb.user.create({
      data: { email: 'reset-weak@test.local', role: 'player', password_hash: await hashPassword('OldPassword123') },
    })
    const token = await createPasswordResetToken(user.id)

    const weak = await resetPassword(jsonRequest('http://test.local/api/auth/reset-password', { token, password: 'short1' }))
    expect(weak.status).toBe(400)

    const strong = await resetPassword(jsonRequest('http://test.local/api/auth/reset-password', { token, password: 'ActuallyStrong789' }))
    expect(strong.status, 'the token must still be valid after a failed weak-password attempt').toBe(200)
  })

  it('rejects an unknown/garbage token', async () => {
    const res = await resetPassword(
      jsonRequest('http://test.local/api/auth/reset-password', { token: 'not-a-real-token', password: 'GenuinelyStrong123' }),
    )
    expect(res.status).toBe(400)
  })
})
