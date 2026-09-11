import { NextRequest, NextResponse } from 'next/server'
import type { UserRole } from '@prisma/client'
import { db } from '@/lib/db'
import { applySessionCookie, encodeSessionToken } from '@/lib/auth'
import { hashPassword, validatePasswordStrength } from '@/lib/password'
import { rateLimit } from '@/lib/rate-limit'
import { ACADEMY_SELF_SERVE_ENABLED } from '@/lib/feature-flags'

// The auth page's role picker used to jump straight into a wizard with no
// account behind it yet — email+password were collected mid-wizard and the
// account only existed once the whole profile was submitted. This endpoint
// creates the bare account (email+password+role, no profile) up front and
// signs the caller in immediately, so the wizard that follows runs
// authenticated and only has to attach a profile to an existing user_id
// rather than create one. Only roles with a real self-serve wizard are
// accepted here — association/scout have none (see auth/page.tsx's
// roleUnavailable) and academy is gated behind the same feature flag the
// auth page checks.
const SIGNUP_ROLES: Record<string, UserRole> = {
  player: 'player',
  coach: 'coach',
  academy: 'academy_admin',
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const roleKey = String(body.role ?? '')
  const role = SIGNUP_ROLES[roleKey]
  if (!role || (role === 'academy_admin' && !ACADEMY_SELF_SERVE_ENABLED)) {
    return NextResponse.json({ error: 'Sign-up is not available for this role' }, { status: 400 })
  }

  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  const signupLimit = rateLimit('bare-account-signup', email, 5, 3600)
  if (!signupLimit.success) {
    return NextResponse.json({ error: 'Too many signup attempts. Please try again later.' }, { status: 429 })
  }

  const passwordError = validatePasswordStrength(password)
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 })
  }

  const passwordHash = await hashPassword(password)

  try {
    const user = await db.user.create({
      data: { email, password_hash: passwordHash, role },
    })
    const res = NextResponse.json({ ok: true })
    const token = await encodeSessionToken({ id: user.id, email: user.email, role: user.role })
    return applySessionCookie(res, token)
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
    }
    throw err
  }
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002'
}
