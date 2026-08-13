/**
 * Unit tests — OTP primitives (src/lib/otp.ts)
 *
 * These guard the claim flow (Pivot Document W2), which is the gate on
 * guardian consent for minors. Weaknesses here are legal exposure, not
 * just bugs.
 */
import { describe, it, expect } from 'vitest'
import { generateOtp, hashOtp, otpExpiry, isOtpExpired, MAX_ATTEMPTS } from '@/lib/otp'

describe('generateOtp', () => {
  it('always returns exactly six digits', () => {
    for (let i = 0; i < 500; i++) {
      expect(generateOtp()).toMatch(/^\d{6}$/)
    }
  })

  it('never returns a value that would render with fewer than six characters', () => {
    // randomInt(100000, 999999) excludes the upper bound, so 999999 is
    // unreachable — but the invariant that matters is the length.
    for (let i = 0; i < 500; i++) {
      expect(generateOtp().length).toBe(6)
    }
  })

  it('produces varied output (not a constant or a weak cycle)', () => {
    const seen = new Set(Array.from({ length: 300 }, () => generateOtp()))
    // 300 draws from ~900k values should almost never collide heavily.
    expect(seen.size).toBeGreaterThan(280)
  })
})

describe('hashOtp', () => {
  it('is deterministic for the same code', () => {
    expect(hashOtp('123456')).toBe(hashOtp('123456'))
  })

  it('differs for different codes', () => {
    expect(hashOtp('123456')).not.toBe(hashOtp('123457'))
  })

  it('never stores the code in plaintext form', () => {
    const h = hashOtp('123456')
    expect(h).not.toContain('123456')
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('expiry', () => {
  it('issues an expiry in the future', () => {
    expect(otpExpiry().getTime()).toBeGreaterThan(Date.now())
  })

  it('expires within a short window (<= 15 minutes)', () => {
    const ms = otpExpiry().getTime() - Date.now()
    expect(ms).toBeLessThanOrEqual(15 * 60 * 1000)
  })

  it('treats a past timestamp as expired and a future one as valid', () => {
    expect(isOtpExpired(new Date(Date.now() - 1000))).toBe(true)
    expect(isOtpExpired(new Date(Date.now() + 60_000))).toBe(false)
  })
})

describe('attempt limiting', () => {
  it('caps attempts at a small number', () => {
    expect(MAX_ATTEMPTS).toBeGreaterThan(0)
    expect(MAX_ATTEMPTS).toBeLessThanOrEqual(10)
  })
})
