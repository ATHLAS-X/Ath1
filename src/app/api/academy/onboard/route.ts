import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { applySessionCookie, encodeSessionToken } from '@/lib/auth'
import { hashPassword } from '@/lib/password'
import { verifyAcademyOtp } from '@/lib/academy-onboarding-otp'
import { academyGate } from '@/lib/academy/gate'

// Creates a new Academy row + its first academy_admin User in one action —
// no existing route did this (src/app/api/academy/** — batches/join-requests/
// attendance-flags — all assume an Academy + admin already exist, scoped via
// getOwnedAcademy()). Follows the same encodeSessionToken/applySessionCookie
// session-minting pattern as player/onboard and associations/onboard.
//
// Only name/district/state/email/password/mobile persist anywhere — the
// mockup's Facilities/Staff/Programs steps (ground type, coach certs, age
// groups, fees, BCCI/state-association affiliation) have no matching column
// on the Academy model today. Collected in the UI for fidelity to the
// mockup's step structure and copy, but intentionally not sent here.
export async function POST(req: NextRequest) {
  const gate = academyGate()
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
  const otpOk = await verifyAcademyOtp(requestId, mobile, otp)
  if (!otpOk) {
    return NextResponse.json({ error: 'Incorrect or expired OTP' }, { status: 400 })
  }

  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  const academyName = String(body.academy_name ?? '').trim()
  const district = String(body.district ?? '').trim()
  const state = String(body.state ?? '').trim()

  if (!email || !password || !academyName || !district || !state) {
    return NextResponse.json({ error: 'Account and academy identity fields are required' }, { status: 400 })
  }

  const passwordHash = await hashPassword(password)

  try {
    const { user, academy } = await db.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          password_hash: passwordHash,
          phone: mobile,
          role: 'academy_admin',
        },
      })
      const createdAcademy = await tx.academy.create({
        data: {
          name: academyName,
          district,
          state,
          admin_user_id: createdUser.id,
        },
      })
      return { user: createdUser, academy: createdAcademy }
    })

    const res = NextResponse.json({ academyId: academy.id })
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
