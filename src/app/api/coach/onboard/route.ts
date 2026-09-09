import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { applySessionCookie, encodeSessionToken } from '@/lib/auth'
import { hashPassword } from '@/lib/password'
import { verifyAcademyOtp } from '@/lib/academy-onboarding-otp'
import { rateLimit } from '@/lib/rate-limit'

// Creates a new coach User + CoachProfile, following the same
// encodeSessionToken/applySessionCookie session-minting pattern as
// player/onboard, associations/onboard, and academy/onboard.
//
// CoachProfile.association_id is required and non-nullable, but nothing
// in src/ actually reads CoachProfile for access control (confirmed —
// squad-access.ts derives coach squad access from real SquadCoach
// membership rows, not from this field) — so this is a declarative
// affiliation, not a membership grant, and is accepted here as
// self-serve/instant rather than gated behind that association's approval.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const mobile = String(body.mobile ?? '').replace(/\D/g, '')
  const requestId = String(body.requestId ?? '')
  const otp = String(body.otp ?? '')
  if (mobile.length !== 10 || !requestId || !otp) {
    return NextResponse.json({ error: 'Phone verification is required' }, { status: 400 })
  }
  // Final-submit OTP re-check had no guess-rate bound — send-otp does.
  const otpVerifyLimit = rateLimit('coach-onboard-otp-verify', mobile, 10, 3600)
  if (!otpVerifyLimit.success) {
    return NextResponse.json({ error: 'Too many verification attempts. Try again later.' }, { status: 429 })
  }
  const otpOk = await verifyAcademyOtp(requestId, mobile, otp)
  if (!otpOk) {
    return NextResponse.json({ error: 'Incorrect or expired OTP' }, { status: 400 })
  }

  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  const coachName = String(body.coach_name ?? '').trim()
  const associationId = String(body.associationId ?? '')

  if (!email || !password || !coachName || !associationId) {
    return NextResponse.json({ error: 'Account, name, and association are required' }, { status: 400 })
  }

  const association = await db.association.findUnique({ where: { id: associationId }, select: { id: true } })
  if (!association) {
    return NextResponse.json({ error: 'Selected association was not found' }, { status: 400 })
  }

  const passwordHash = await hashPassword(password)

  try {
    const { user, coachProfile } = await db.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          password_hash: passwordHash,
          phone: mobile,
          role: 'coach',
        },
      })
      const createdCoachProfile = await tx.coachProfile.create({
        data: {
          user_id: createdUser.id,
          full_name: coachName,
          association_id: associationId,
        },
      })
      return { user: createdUser, coachProfile: createdCoachProfile }
    })

    const res = NextResponse.json({ coachProfileId: coachProfile.id })
    const token = await encodeSessionToken({ id: user.id, email: user.email, role: user.role })
    return applySessionCookie(res, token)
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: 'An account with this email or phone number already exists' }, { status: 409 })
    }
    throw err
  }
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002'
}
