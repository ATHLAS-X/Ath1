import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateOtp, hashOtp, otpExpiry } from '@/lib/otp'

function isMinor(dob: Date): boolean {
  const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000)
  return age < 18
}

// Starts (or restarts) a claim on a shadow profile and issues an OTP.
// Under-18 players cannot self-verify — the OTP goes to the guardian's phone
// and guardian details are required (DPDP Act guardian-consent gate).
export async function POST(req: NextRequest) {
  const { playerId, phone, guardianName, guardianPhone, guardianRelation } = await req.json()

  if (!playerId || !phone) {
    return NextResponse.json({ error: 'playerId and phone are required' }, { status: 400 })
  }

  const player = await db.playerProfile.findUnique({ where: { id: playerId } })
  if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 })
  if (player.claim_status === 'claimed') {
    return NextResponse.json({ error: 'This profile has already been claimed' }, { status: 409 })
  }

  const minor = isMinor(player.dob)
  if (minor && (!guardianName || !guardianPhone || !guardianRelation)) {
    return NextResponse.json({ error: 'Guardian name, phone, and relation are required for under-18 players' }, { status: 400 })
  }

  const claim = await db.playerClaim.upsert({
    where: { player_id: playerId },
    create: {
      player_id: playerId,
      method: minor ? 'guardian_otp' : 'phone_otp',
      phone,
      is_minor: minor,
      guardian_name: minor ? guardianName : undefined,
      guardian_phone: minor ? guardianPhone : undefined,
      guardian_relation: minor ? guardianRelation : undefined,
      consent_status: 'pending',
    },
    update: {
      method: minor ? 'guardian_otp' : 'phone_otp',
      phone,
      is_minor: minor,
      guardian_name: minor ? guardianName : undefined,
      guardian_phone: minor ? guardianPhone : undefined,
      guardian_relation: minor ? guardianRelation : undefined,
    },
  })

  const otpTargetPhone = minor ? guardianPhone : phone
  const code = generateOtp()

  await db.phoneOtp.create({
    data: {
      claim_id: claim.id,
      phone: otpTargetPhone,
      code_hash: hashOtp(code),
      purpose: minor ? 'guardian_otp' : 'phone_otp',
      expires_at: otpExpiry(),
    },
  })

  // No SMS gateway wired yet (SMS_GATEWAY_API_KEY is unset) — the code is
  // returned directly so the flow is testable end to end. Once MSG91 (or
  // similar) is connected, drop `devOtp` from the response and send instead.
  return NextResponse.json({
    claimId: claim.id,
    isMinor: minor,
    otpSentTo: minor ? `guardian (${guardianPhone})` : phone,
    devOtp: code,
  })
}
