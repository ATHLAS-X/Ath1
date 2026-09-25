/**
 * Regression test: academy/coach/scout onboarding OTP and the academy-join
 * guardian OTP used to return `devCode` unconditionally, in every
 * environment — a full account-takeover / forged-guardian-consent
 * primitive for anyone who knows a target's phone number, pre-auth. Fixed
 * to only include devCode when NODE_ENV !== 'production', matching
 * claim/start.ts's existing dev-only OTP gate.
 *
 * These routes read process.env.NODE_ENV directly at request time (not a
 * module-load-time constant), so this test can flip it per-case without
 * needing to reset module state between assertions.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { __resetRateLimitsForTests } from '@/lib/rate-limit'

vi.mock('@/lib/academy/gate', () => ({ academyGate: () => null }))
vi.mock('@/lib/scout/gate', () => ({ scoutGate: () => null }))
vi.mock('@/lib/db', () => ({
  db: { academy: { findUnique: async () => ({ id: 'academy-1' }) } },
}))

const { POST: academyOnboardOtp } = await import('@/app/api/academy/onboard/send-otp/route')
const { POST: academyJoinOtp } = await import('@/app/api/academy/join/[academyId]/send-otp/route')
const { POST: coachOnboardOtp } = await import('@/app/api/coach/onboard/send-otp/route')
const { POST: scoutOnboardOtp } = await import('@/app/api/scout/onboard/send-otp/route')

function postJson(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

const originalNodeEnv = process.env.NODE_ENV

beforeEach(() => {
  __resetRateLimitsForTests()
})
afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv
})

describe('OTP send routes never expose devCode in production', () => {
  it('academy onboarding: omits devCode in production, includes it otherwise', async () => {
    process.env.NODE_ENV = 'production'
    const prodRes = await academyOnboardOtp(postJson('http://test.local/api/academy/onboard/send-otp', { mobile: '9876543210' }))
    const prodData = await prodRes.json()
    expect(prodData.devCode).toBeUndefined()
    expect(prodData.requestId).toBeDefined()

    process.env.NODE_ENV = 'test'
    const devRes = await academyOnboardOtp(postJson('http://test.local/api/academy/onboard/send-otp', { mobile: '9876543211' }))
    const devData = await devRes.json()
    expect(devData.devCode).toBeDefined()
  })

  it('academy join guardian OTP: omits devCode in production, includes it otherwise', async () => {
    process.env.NODE_ENV = 'production'
    const prodRes = await academyJoinOtp(
      postJson('http://test.local/api/academy/join/academy-1/send-otp', { phone: '9876543212' }),
      { params: { academyId: 'academy-1' } },
    )
    const prodData = await prodRes.json()
    expect(prodData.devCode).toBeUndefined()

    process.env.NODE_ENV = 'test'
    const devRes = await academyJoinOtp(
      postJson('http://test.local/api/academy/join/academy-1/send-otp', { phone: '9876543213' }),
      { params: { academyId: 'academy-1' } },
    )
    const devData = await devRes.json()
    expect(devData.devCode).toBeDefined()
  })

  it('coach onboarding: omits devCode in production, includes it otherwise', async () => {
    process.env.NODE_ENV = 'production'
    const prodRes = await coachOnboardOtp(postJson('http://test.local/api/coach/onboard/send-otp', { mobile: '9876543214' }))
    const prodData = await prodRes.json()
    expect(prodData.devCode).toBeUndefined()

    process.env.NODE_ENV = 'test'
    const devRes = await coachOnboardOtp(postJson('http://test.local/api/coach/onboard/send-otp', { mobile: '9876543215' }))
    const devData = await devRes.json()
    expect(devData.devCode).toBeDefined()
  })

  it('scout onboarding: omits devCode in production, includes it otherwise', async () => {
    process.env.NODE_ENV = 'production'
    const prodRes = await scoutOnboardOtp(postJson('http://test.local/api/scout/onboard/send-otp', { mobile: '9876543216' }))
    const prodData = await prodRes.json()
    expect(prodData.devCode).toBeUndefined()

    process.env.NODE_ENV = 'test'
    const devRes = await scoutOnboardOtp(postJson('http://test.local/api/scout/onboard/send-otp', { mobile: '9876543217' }))
    const devData = await devRes.json()
    expect(devData.devCode).toBeDefined()
  })
})
