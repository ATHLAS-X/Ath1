import { randomInt } from 'crypto'
import bcrypt from 'bcryptjs'

const OTP_TTL_MS = 10 * 60 * 1000 // 10 minutes
const MAX_ATTEMPTS = 5
const SALT_ROUNDS = 10

export function generateOtp(): string {
  return String(randomInt(100000, 999999))
}

/**
 * Salted bcrypt hash — was unsalted SHA-256 (a fixed-time table/rainbow
 * lookup could brute-force any leaked code in milliseconds; bcrypt's
 * per-hash salt and cost factor make that infeasible). Async and
 * non-deterministic by design (two hashes of the same code differ) — the
 * old hashOtp()==hashOtp() equality-check pattern this replaces was itself
 * part of the problem, since a deterministic hash of a 6-digit space is
 * only ~900k possible outputs to precompute once.
 */
export async function hashOtp(code: string): Promise<string> {
  return bcrypt.hash(code, SALT_ROUNDS)
}

/** Verifies a code against its stored hash — replaces the old
 *  `hashOtp(code) !== stored` equality check, which stops working once
 *  hashOtp is salted (two hashes of the same code are never equal). */
export async function verifyOtpCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash)
}

export function otpExpiry(): Date {
  return new Date(Date.now() + OTP_TTL_MS)
}

export function isOtpExpired(expiresAt: Date): boolean {
  return Date.now() > expiresAt.getTime()
}

/** Masks all but the last 4 digits — e.g. "9876543210" -> "******3210".
 *  Never log a full phone number; this is what every OTP log call below
 *  actually logs. */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  if (phone.length <= 4) return '*'.repeat(phone.length)
  return '*'.repeat(phone.length - 4) + phone.slice(-4)
}

export { MAX_ATTEMPTS }
