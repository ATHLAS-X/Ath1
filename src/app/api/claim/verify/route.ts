import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { applySessionCookie, encodeSessionToken } from '@/lib/auth'
import { verifyOtpCode, isOtpExpired, MAX_ATTEMPTS } from '@/lib/otp'
import { logOtpEvent } from '@/lib/otp-log'

// Verifies the OTP and, on success, grants consent, marks the profile
// claimed, creates the player User, and signs them in via a session cookie.
export async function POST(req: NextRequest) {
  const { claimId, code } = await req.json()
  if (!claimId || !code) {
    return NextResponse.json({ error: 'claimId and code are required' }, { status: 400 })
  }

  const otp = await db.phoneOtp.findFirst({
    where: { claim_id: claimId, consumed_at: null },
    orderBy: { created_at: 'desc' },
  })
  if (!otp) return NextResponse.json({ error: 'No active OTP for this claim' }, { status: 404 })
  logOtpEvent({ flowType: 'claim_player', event: 'verify_attempt', phone: otp.phone, claimId })

  if (isOtpExpired(otp.expires_at)) {
    logOtpEvent({ flowType: 'claim_player', event: 'expired', phone: otp.phone, claimId })
    return NextResponse.json({ error: 'OTP expired. Request a new one.' }, { status: 410 })
  }
  if (otp.attempts >= MAX_ATTEMPTS) {
    logOtpEvent({ flowType: 'claim_player', event: 'verify_failed', phone: otp.phone, claimId, failureReason: 'max_attempts_exceeded' })
    return NextResponse.json({ error: 'Too many attempts. Request a new OTP.' }, { status: 429 })
  }

  if (!(await verifyOtpCode(code, otp.code_hash))) {
    await db.phoneOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } })
    logOtpEvent({ flowType: 'claim_player', event: 'verify_failed', phone: otp.phone, claimId, failureReason: 'wrong_code' })
    return NextResponse.json({ error: 'Incorrect code' }, { status: 401 })
  }

  // Consume-then-grant, atomically, in one transaction — this is the fix
  // for the double-call/TOCTOU race class that caused the original
  // guardian-consent bug on the reference branch: two concurrent verify
  // calls for the same OTP must not both succeed. The consume step is
  // guarded (`consumed_at: null` in the where clause of an updateMany, not
  // a plain update) so only the FIRST caller to reach it can ever
  // transition the row — a second, racing call sees 0 rows updated and is
  // rejected as a replay, never granting consent twice.
  const result = await db.$transaction(async (tx) => {
    const consumedCount = await tx.phoneOtp.updateMany({
      where: { id: otp.id, consumed_at: null },
      data: { consumed_at: new Date() },
    })
    if (consumedCount.count === 0) {
      return null // lost the race to another concurrent verify call
    }

    const pending = await tx.playerClaim.findUnique({ where: { id: claimId } })
    if (!pending) return null

    const user = await tx.user.create({
      data: {
        email: claimedPlayerEmail(pending.phone),
        phone: pending.phone,
        role: 'player',
        linked_player_id: pending.player_id,
      },
    })

    const claim = await tx.playerClaim.update({
      where: { id: claimId },
      data: {
        verified_at: new Date(),
        consent_status: 'granted',
        consent_granted_at: new Date(),
        claiming_user_id: user.id,
      },
    })

    await tx.playerProfile.update({
      where: { id: claim.player_id },
      data: { claim_status: 'claimed', consent_status: 'granted', user_id: user.id },
    })

    return { claim, user }
  })

  if (!result) {
    logOtpEvent({ flowType: 'claim_player', event: 'verify_failed', phone: otp.phone, claimId, failureReason: 'already_consumed' })
    return NextResponse.json({ error: 'This code was already used' }, { status: 409 })
  }

  logOtpEvent({ flowType: 'claim_player', event: 'verify_success', phone: otp.phone, claimId })
  logOtpEvent({ flowType: 'claim_player', event: 'consumed', phone: otp.phone, claimId })

  const res = NextResponse.json({ verified: true, playerId: result.claim.player_id })
  const token = await encodeSessionToken({
    id: result.user.id,
    email: result.user.email,
    role: result.user.role,
  })
  return applySessionCookie(res, token)
}

function claimedPlayerEmail(phone: string): string {
  return `${phone.replace(/\D/g, '')}@claimed.athlasx.local`
}
