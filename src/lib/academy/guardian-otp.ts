/**
 * Dev-only guardian-phone OTP stub for the public player self-registration
 * link (design/import/AthlasX Player Self-Registration.html's consent
 * section — required only when the registering player is a minor). Same
 * shape as src/lib/academy-onboarding-otp.ts (no real SMS gateway exists
 * anywhere in this codebase), kept as its own module rather than reused
 * because that one's requestId map is scoped to the academy-admin's own
 * account-creation phone, a different trust boundary than a guardian
 * verifying consent for a join request they haven't submitted yet.
 */
import { generateOtp, hashOtp, verifyOtpCode, otpExpiry, isOtpExpired } from '@/lib/otp'
import { randomInt } from 'crypto'

interface PendingOtp {
  phone: string
  codeHash: string
  expiresAt: Date
}

const pending = new Map<string, PendingOtp>()

export async function sendGuardianOtp(phone: string): Promise<{ requestId: string; devCode: string }> {
  const requestId = randomInt(1e9, 2e9).toString(36) + Date.now().toString(36)
  const code = generateOtp()
  pending.set(requestId, { phone, codeHash: await hashOtp(code), expiresAt: otpExpiry() })
  return { requestId, devCode: code }
}

export async function verifyGuardianOtp(requestId: string, phone: string, code: string): Promise<boolean> {
  const entry = pending.get(requestId)
  if (!entry || entry.phone !== phone) return false
  if (isOtpExpired(entry.expiresAt)) {
    pending.delete(requestId)
    return false
  }
  const ok = await verifyOtpCode(code, entry.codeHash)
  if (ok) pending.delete(requestId)
  return ok
}
