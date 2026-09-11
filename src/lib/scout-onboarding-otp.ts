/**
 * Dev-only phone-OTP stub for scout self-serve onboarding. Mirrors
 * src/lib/academy-onboarding-otp.ts exactly (same globalThis-backed Map,
 * same reasoning: no SMS gateway exists anywhere in this codebase, and no
 * existing scout account is at risk during onboarding since the account
 * is only created on final submit).
 */
import { generateOtp, hashOtp, verifyOtpCode, otpExpiry, isOtpExpired } from '@/lib/otp'
import { randomInt } from 'crypto'

interface PendingOtp {
  mobile: string
  codeHash: string
  expiresAt: Date
}

const globalForScoutOtp = globalThis as unknown as { __athlasxScoutOtpPending?: Map<string, PendingOtp> }
const pending = globalForScoutOtp.__athlasxScoutOtpPending ?? new Map<string, PendingOtp>()
globalForScoutOtp.__athlasxScoutOtpPending = pending

export async function sendScoutOtp(mobile: string): Promise<{ requestId: string; devCode: string }> {
  const requestId = randomInt(1e9, 2e9).toString(36) + Date.now().toString(36)
  const code = generateOtp()
  pending.set(requestId, { mobile, codeHash: await hashOtp(code), expiresAt: otpExpiry() })
  return { requestId, devCode: code }
}

export async function verifyScoutOtp(requestId: string, mobile: string, code: string): Promise<boolean> {
  const entry = pending.get(requestId)
  if (!entry || entry.mobile !== mobile) return false
  if (isOtpExpired(entry.expiresAt)) {
    pending.delete(requestId)
    return false
  }
  const ok = await verifyOtpCode(code, entry.codeHash)
  if (ok) pending.delete(requestId)
  return ok
}
