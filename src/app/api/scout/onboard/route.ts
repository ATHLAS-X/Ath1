import { NextRequest, NextResponse } from 'next/server'
import { isSameOriginRequest } from '@/lib/same-origin'
import type { ScoutOrgType } from '@prisma/client'
import { db } from '@/lib/db'
import { applySessionCookie, encodeSessionToken } from '@/lib/auth'
import { hashPassword, validatePasswordStrength } from '@/lib/password'
import { verifyScoutOtp } from '@/lib/scout-onboarding-otp'
import { scoutGate } from '@/lib/scout/gate'
import { rateLimit } from '@/lib/rate-limit'

// Creates a new scout User + ScoutProfile in one action, same
// OTP-then-account-then-session shape as POST /api/academy/onboard.
//
// This route does NOT decide what a scout can see — that is entirely
// src/lib/player-visibility.ts's job (FRANCHISE_SCOUT_ENABLED gate +
// isAdult(player.dob) check, both already enforced independently of
// anything here). verification_status starts 'pending' on every row;
// nothing in this codebase currently reads that field to grant or
// withhold access — it exists so scout-organization legitimacy can be
// reviewed later without being a blocking dependency of this first cut.
const ORG_TYPES = new Set<ScoutOrgType>(['franchise', 'academy_recruiting_arm', 'independent'])

export async function POST(req: NextRequest) {
  // Mints a session cookie outside NextAuth's own CSRF-protected handler —
  // same-origin check, as on the auth routes (see src/lib/same-origin.ts).
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }

  const gate = scoutGate()
  if (gate) return gate

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
  const otpVerifyLimit = await rateLimit('scout-onboard-otp-verify', mobile, 10, 3600)
  if (!otpVerifyLimit.success) {
    return NextResponse.json({ error: 'Too many verification attempts. Try again later.' }, { status: 429 })
  }
  const otpOk = await verifyScoutOtp(requestId, mobile, otp)
  if (!otpOk) {
    return NextResponse.json({ error: 'Incorrect or expired OTP' }, { status: 400 })
  }

  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  const orgName = String(body.org_name ?? '').trim()
  const orgTypeRaw = String(body.org_type ?? '')
  const orgType = ORG_TYPES.has(orgTypeRaw as ScoutOrgType) ? (orgTypeRaw as ScoutOrgType) : undefined
  const contactName = String(body.contact_name ?? '').trim() || undefined
  const contactPhone = String(body.contact_phone ?? '').trim() || undefined

  if (!email || !password || !orgName || !orgType) {
    return NextResponse.json({ error: 'Account and organization details are required' }, { status: 400 })
  }

  const signupLimit = await rateLimit('scout-onboard-signup', email, 5, 3600)
  if (!signupLimit.success) {
    return NextResponse.json({ error: 'Too many signup attempts. Please try again later.' }, { status: 429 })
  }

  const passwordError = validatePasswordStrength(password)
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 })
  }

  const passwordHash = await hashPassword(password)

  try {
    const { user } = await db.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          password_hash: passwordHash,
          phone: mobile,
          role: 'scout',
        },
      })
      await tx.scoutProfile.create({
        data: {
          user_id: createdUser.id,
          org_name: orgName,
          org_type: orgType,
          contact_name: contactName,
          contact_phone: contactPhone,
        },
      })
      return { user: createdUser }
    })

    const res = NextResponse.json({ userId: user.id })
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
