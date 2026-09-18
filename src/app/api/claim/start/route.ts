import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateOtp, hashOtp, otpExpiry } from '@/lib/otp'
import { rateLimit } from '@/lib/rate-limit'
import { logOtpEvent } from '@/lib/otp-log'

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

  // Send-side throttle — without this, the MAX_ATTEMPTS cap on verify is
  // trivially bypassed by simply requesting a fresh code instead of
  // guessing against the same one. Keyed by phone, not claimId, since a
  // claim doesn't exist yet on the very first call.
  const limit = await rateLimit('claim-otp-send', phone, 5, 3600)
  if (!limit.success) {
    logOtpEvent({ flowType: 'claim_player', event: 'rate_limited', phone })
    return NextResponse.json({ error: 'Too many OTP requests for this number. Try again later.' }, { status: 429 })
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
  logOtpEvent({ flowType: 'claim_player', event: 'generated', phone: otpTargetPhone, claimId: claim.id })

  // Any previously-issued, still-active OTP for this claim is superseded —
  // consumed rather than deleted, preserving the audit trail (same
  // convention as the reference branch's guardian-otp fix), so only ever
  // one row can be the "active" one a verify call can match.
  await db.phoneOtp.updateMany({
    where: { claim_id: claim.id, consumed_at: null },
    data: { consumed_at: new Date() },
  })

  await db.phoneOtp.create({
    data: {
      claim_id: claim.id,
      phone: otpTargetPhone,
      code_hash: await hashOtp(code),
      purpose: minor ? 'guardian_otp' : 'phone_otp',
      expires_at: otpExpiry(),
    },
  })
  logOtpEvent({ flowType: 'claim_player', event: 'sent', phone: otpTargetPhone, claimId: claim.id })

  // devOtp is deliberately never returned in the response — a claim route
  // is reachable pre-authentication by design (that's the whole point of a
  // claim flow), so returning the code here would be a complete
  // profile-takeover primitive against any player, including minors,
  // regardless of whether SMS is wired up yet. No SMS gateway is wired yet
  // (SMS_GATEWAY_API_KEY is unset); until it is, the code is logged
  // server-side only (never at info/console level with the raw code — see
  // the redaction below) so it can still be retrieved for manual/local
  // testing without ever crossing the network boundary.
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[claim/start] dev-only: OTP for claim ${claim.id} is ${code} (server log only, never returned to the caller)`)
  }
  return NextResponse.json({
    claimId: claim.id,
    isMinor: minor,
    otpSentTo: minor ? `guardian (${guardianPhone})` : phone,
  })
}
