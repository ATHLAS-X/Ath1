/**
 * Dev-only phone-OTP stub for academy self-serve onboarding (Step 1 of
 * design/import/AthlasX Academy Onboarding v3.html). No real SMS gateway
 * exists anywhere in this codebase (same fact claim/start.ts documents) —
 * this reuses src/lib/otp.ts's generate/hash/verify primitives directly,
 * shown to the caller in dev mode the same way
 * src/lib/aadhaar-verification.ts's dev_stub is, for the same reason: no
 * existing academy account is at risk during onboarding (the account is
 * only created on final submit), unlike claim/start's OTP which targets an
 * existing player and is deliberately never returned to the caller.
 *
 * Not built as a full pluggable provider registry (unlike
 * aadhaar-verification.ts) — this prompt didn't ask for a swappable SMS
 * vendor abstraction, just a working stub.
 */
import { generateOtp, hashOtp, verifyOtpCode, otpExpiry, isOtpExpired } from '@/lib/otp'
import { randomInt } from 'crypto'

interface PendingOtp {
  mobile: string
  codeHash: string
  expiresAt: Date
}

const pending = new Map<string, PendingOtp>()

export async function sendAcademyOtp(mobile: string): Promise<{ requestId: string; devCode: string }> {
  const requestId = randomInt(1e9, 2e9).toString(36) + Date.now().toString(36)
  const code = generateOtp()
  pending.set(requestId, { mobile, codeHash: await hashOtp(code), expiresAt: otpExpiry() })
  return { requestId, devCode: code }
}

export async function verifyAcademyOtp(requestId: string, mobile: string, code: string): Promise<boolean> {
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
