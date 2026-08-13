import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashOtp, isOtpExpired, MAX_ATTEMPTS } from '@/lib/otp'

// Verifies the OTP and, on success, grants consent and marks the profile
// claimed. For a minor, this OTP was sent to the guardian's phone — the
// guardian entering it IS the consent action (DPDP guardian-consent gate).
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

  if (isOtpExpired(otp.expires_at)) {
    return NextResponse.json({ error: 'OTP expired. Request a new one.' }, { status: 410 })
  }
  if (otp.attempts >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: 'Too many attempts. Request a new OTP.' }, { status: 429 })
  }

  if (hashOtp(code) !== otp.code_hash) {
    await db.phoneOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } })
    return NextResponse.json({ error: 'Incorrect code' }, { status: 401 })
  }

  const claim = await db.playerClaim.update({
    where: { id: claimId },
    data: {
      verified_at: new Date(),
      consent_status: 'granted',
      consent_granted_at: new Date(),
    },
  })

  await db.phoneOtp.update({ where: { id: otp.id }, data: { consumed_at: new Date() } })

  await db.playerProfile.update({
    where: { id: claim.player_id },
    data: { claim_status: 'claimed', consent_status: 'granted' },
  })

  return NextResponse.json({ verified: true, playerId: claim.player_id })
}
