/**
 * Pluggable Aadhaar (eKYC) identity-verification adapter — mirrors
 * src/lib/ingest/registry.ts's shape exactly: one interface, a registry
 * keyed by provider, swappable implementations. No real UIDAI/eKYC vendor
 * integration exists anywhere in this codebase, and none is fabricated
 * here — the only registered provider is `dev_stub`, which behaves like
 * src/lib/otp.ts's existing phone-OTP flow (generate a code, verify it),
 * except the dev code is returned directly in the response rather than
 * only logged server-side.
 *
 * That's a deliberate difference from claim/start's OTP handling (which
 * never returns the code to the client, since a claim targets an existing
 * player pre-authentication and returning the code would be a takeover
 * primitive against someone else's profile). Aadhaar verification during
 * onboarding has no existing player record to take over — the profile is
 * only created on final submit — so there is no equivalent party at risk,
 * and the caller explicitly wants a "Dev mode — no eKYC vendor connected"
 * banner rather than a hidden server log.
 *
 * Never store or return the raw Aadhaar number after initiation — only
 * the last 4 digits (see PlayerProfile.aadhaar_last4 in schema.prisma) and
 * a verification-status enum, the same minimal-PII pattern PhoneOtp
 * already follows for phone numbers.
 */
import { randomInt } from 'crypto'
import { generateOtp, hashOtp, verifyOtpCode, otpExpiry, isOtpExpired } from '@/lib/otp'

export type AadhaarProviderKey = 'dev_stub'

export interface AadhaarInitiateResult {
  requestId: string
  last4: string
  /** Only ever populated by a dev/stub provider — a real vendor would
   *  never return this, and no real vendor is implemented here. */
  devCode?: string
  devNotice?: string
}

export interface AadhaarVerificationProvider {
  key: AadhaarProviderKey
  /** aadhaarNumber is the raw 12-digit number, accepted only at the
   *  moment of initiation — never persisted, never echoed back. */
  initiate(aadhaarNumber: string): Promise<AadhaarInitiateResult>
  verify(requestId: string, code: string): Promise<boolean>
}

interface PendingRequest {
  last4: string
  codeHash: string
  expiresAt: Date
}

// Module-singleton in-memory store — same convention as rate-limit.ts's
// own module-level Map, acceptable for a dev-only stub with no real
// persistence requirement (a real provider would call out to a vendor
// instead of storing anything here).
// globalThis-backed — see src/lib/rate-limit.ts's identical comment. A
// plain module-level Map here was getting silently reset by Next.js dev's
// route-module recompilation between initiate/verify/consume calls,
// producing intermittent verification failures unrelated to the real TTL.
const globalForAadhaar = globalThis as unknown as { __athlasxAadhaarPending?: Map<string, PendingRequest> }
const pending = globalForAadhaar.__athlasxAadhaarPending ?? new Map<string, PendingRequest>()
globalForAadhaar.__athlasxAadhaarPending = pending

// A verified requestId moves here (last4 only) so /api/player/onboard can
// confirm server-side that THIS requestId was actually verified, rather
// than trusting a client-supplied boolean outright. Single-use — consumed
// by consumeVerifiedAadhaar() at account-creation time, so the same
// verification can't be replayed onto a second account.
const globalForAadhaarVerified = globalThis as unknown as { __athlasxAadhaarVerified?: Map<string, { last4: string; verifiedAt: number }> }
const verified = globalForAadhaarVerified.__athlasxAadhaarVerified ?? new Map<string, { last4: string; verifiedAt: number }>()
globalForAadhaarVerified.__athlasxAadhaarVerified = verified
const VERIFIED_TTL_MS = 30 * 60 * 1000 // generous window to finish the rest of onboarding

/** Called by /api/player/onboard to confirm a requestId was really
 *  verified by this provider, and to consume it (one-time use). Returns
 *  the last4 to persist, or null if the requestId is unknown/expired/
 *  already consumed. */
export function consumeVerifiedAadhaar(requestId: string): string | null {
  const entry = verified.get(requestId)
  if (!entry) return null
  verified.delete(requestId)
  if (Date.now() - entry.verifiedAt > VERIFIED_TTL_MS) return null
  return entry.last4
}

const devStubProvider: AadhaarVerificationProvider = {
  key: 'dev_stub',
  async initiate(aadhaarNumber) {
    const digits = aadhaarNumber.replace(/\D/g, '')
    const last4 = digits.slice(-4)
    const requestId = randomInt(1e9, 2e9).toString(36) + Date.now().toString(36)
    const code = generateOtp()
    pending.set(requestId, {
      last4,
      codeHash: await hashOtp(code),
      expiresAt: otpExpiry(),
    })
    return {
      requestId,
      last4,
      devCode: code,
      devNotice: 'Dev mode — no eKYC vendor connected',
    }
  },
  async verify(requestId, code) {
    const entry = pending.get(requestId)
    if (!entry) return false
    if (isOtpExpired(entry.expiresAt)) {
      pending.delete(requestId)
      return false
    }
    const ok = await verifyOtpCode(code, entry.codeHash)
    if (ok) {
      pending.delete(requestId)
      verified.set(requestId, { last4: entry.last4, verifiedAt: Date.now() })
    }
    return ok
  },
}

const REGISTRY: Record<AadhaarProviderKey, AadhaarVerificationProvider> = {
  dev_stub: devStubProvider,
}

export function resolveAadhaarProvider(key: AadhaarProviderKey = 'dev_stub'): AadhaarVerificationProvider {
  const provider = REGISTRY[key]
  if (!provider) throw new Error(`Unknown Aadhaar verification provider: ${key}`)
  return provider
}
