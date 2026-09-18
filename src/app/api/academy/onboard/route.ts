import { NextRequest, NextResponse } from 'next/server'
import type { AcademyType, PlayerCountRange } from '@prisma/client'
import { db } from '@/lib/db'
import { applySessionCookie, encodeSessionToken } from '@/lib/auth'
import { hashPassword, validatePasswordStrength } from '@/lib/password'
import { verifyAcademyOtp } from '@/lib/academy-onboarding-otp'
import { academyGate } from '@/lib/academy/gate'
import { rateLimit } from '@/lib/rate-limit'

// Creates a new Academy row + its first academy_admin User in one action —
// no existing route did this (src/app/api/academy/** — batches/join-requests/
// attendance-flags — all assume an Academy + admin already exist, scoped via
// getOwnedAcademy()). Follows the same encodeSessionToken/applySessionCookie
// session-minting pattern as player/onboard and associations/onboard.
//
// docs/AthlasX_Master_Data_Points.docx Phase 1 (HIGH) — Step 2's identity
// fields (year/type/contact/BCCI/state-association/head-coach) now persist;
// they used to be collected in the wizard's own React state and silently
// discarded here. Facilities/Programs (ground type, coach certs, age
// groups, fees) are still Phase 2/3 — not touched in this pass.
//
// active_player_count_range (docs Phase 1, HIGH) has no corresponding
// wizard field anywhere in this codebase today — nothing to wire through
// yet. Left null on every row until a Step 2/3 field for it exists.
const ACADEMY_TYPE_MAP: Record<string, AcademyType> = {
  'Private': 'private',
  'Government': 'government',
  'Sports Club': 'sports_club',
  // The wizard's ACADEMY_TYPES option list combines Trust and NGO into one
  // "Trust / NGO" choice, but the enum (correctly) keeps them distinct per
  // the source doc. There's no way to know which the admin meant from a
  // single combined option — left unmapped (falls through to undefined)
  // rather than guessing one and silently losing the other.
}

function toIntOrUndefined(v: unknown): number | undefined {
  const n = Number(v)
  return Number.isFinite(n) && String(v).trim() !== '' ? n : undefined
}

function toBool(v: unknown): boolean {
  return v === 'Yes' || v === true
}

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
  // Final-submit OTP re-check had no guess-rate bound — send-otp does.
  const otpVerifyLimit = await rateLimit('academy-onboard-otp-verify', mobile, 10, 3600)
  if (!otpVerifyLimit.success) {
    return NextResponse.json({ error: 'Too many verification attempts. Try again later.' }, { status: 429 })
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

  const signupLimit = await rateLimit('academy-onboard-signup', email, 5, 3600)
  if (!signupLimit.success) {
    return NextResponse.json({ error: 'Too many signup attempts. Please try again later.' }, { status: 429 })
  }

  const passwordError = validatePasswordStrength(password)
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 })
  }

  // docs/AthlasX_Master_Data_Points.docx Phase 1 (HIGH) fields — all
  // optional here even though several are required client-side (the
  // wizard's own canProceed() already gates Step 2 on city/contactName),
  // so a malformed/omitted value degrades to "not recorded" instead of a
  // second server-side 400 duplicating client validation.
  const city = String(body.city ?? '').trim() || undefined
  const yearEstablished = toIntOrUndefined(body.year_established)
  const academyType = ACADEMY_TYPE_MAP[String(body.academy_type ?? '')]
  const contactName = String(body.contact_name ?? '').trim() || undefined
  const contactDesignation = String(body.contact_designation ?? '').trim() || undefined
  const bcciAffiliated = toBool(body.bcci_affiliated)
  const bcciAffiliationId = String(body.bcci_affiliation_id ?? '').trim() || undefined
  const stateAssocAffiliated = toBool(body.state_assoc_affiliated)
  const stateAssocNames = Array.isArray(body.state_assoc_names)
    ? body.state_assoc_names.map(String).filter(Boolean)
    : []
  const headCoachName = String(body.head_coach_name ?? '').trim() || undefined
  // No wizard field produces this yet — see the header comment.
  const activePlayerCountRange: PlayerCountRange | undefined = undefined

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
          city,
          district,
          state,
          year_established: yearEstablished,
          academy_type: academyType,
          contact_name: contactName,
          contact_designation: contactDesignation,
          bcci_affiliated: bcciAffiliated,
          bcci_affiliation_id: bcciAffiliationId,
          state_assoc_affiliated: stateAssocAffiliated,
          state_assoc_names: stateAssocNames,
          head_coach_name: headCoachName,
          active_player_count_range: activePlayerCountRange,
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
