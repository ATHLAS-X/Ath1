/**
 * Unit tests — OTP primitives (src/lib/otp.ts)
 *
 * These guard the claim flow (Pivot Document W2), which is the gate on
 * guardian consent for minors. Weaknesses here are legal exposure, not
 * just bugs.
 *
 * hashOtp/verifyOtpCode are bcrypt-based (was unsalted SHA-256) — hashOtp
 * is now async and, by design, non-deterministic (two hashes of the same
 * code differ, since each has its own salt). The old direct-equality
 * assertions on a fixed hex shape tested the OLD, weaker property; they're
 * replaced below with assertions on the actual security properties that
 * matter: the hash never contains the plaintext code, and verifyOtpCode
 * correctly accepts the right code and rejects the wrong one.
 */
import { describe, it, expect } from 'vitest'
import { generateOtp, hashOtp, verifyOtpCode, otpExpiry, isOtpExpired, maskPhone, MAX_ATTEMPTS } from '@/lib/otp'

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

describe('hashOtp / verifyOtpCode', () => {
  it('never stores the code in plaintext form', async () => {
    const h = await hashOtp('123456')
    expect(h).not.toContain('123456')
  })

  it('produces a bcrypt-shaped hash, not a raw SHA-256 hex digest', async () => {
    const h = await hashOtp('123456')
    expect(h).toMatch(/^\$2[aby]?\$\d{2}\$/)
  })

  it('is salted — two hashes of the same code are not equal', async () => {
    const a = await hashOtp('123456')
    const b = await hashOtp('123456')
    expect(a).not.toBe(b)
  })

  it('verifyOtpCode accepts the correct code against its own hash', async () => {
    const h = await hashOtp('123456')
    expect(await verifyOtpCode('123456', h)).toBe(true)
  })

  it('verifyOtpCode rejects an incorrect code', async () => {
    const h = await hashOtp('123456')
    expect(await verifyOtpCode('654321', h)).toBe(false)
  })

  it('verifyOtpCode rejects the correct code against a different hash', async () => {
    const h1 = await hashOtp('123456')
    const h2 = await hashOtp('654321')
    expect(await verifyOtpCode('123456', h2)).toBe(false)
    expect(await verifyOtpCode('654321', h1)).toBe(false)
  })
})

describe('maskPhone', () => {
  it('masks all but the last 4 digits', () => {
    expect(maskPhone('9876543210')).toBe('******3210')
  })

  it('fully masks a phone number of 4 characters or fewer', () => {
    expect(maskPhone('123')).toBe('***')
  })

  it('returns null for a missing phone number', () => {
    expect(maskPhone(null)).toBeNull()
    expect(maskPhone(undefined)).toBeNull()
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
