import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, validatePasswordStrength, PASSWORD_TOO_COMMON_MESSAGE } from '@/lib/password'
import { isPasswordBreached } from '@/lib/hibp'
import { isSameOriginRequest } from '@/lib/same-origin'
import { consumePasswordResetToken } from '@/lib/password-reset'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const token = String(body.token ?? '')
  const password = String(body.password ?? '')
  if (!token || !password) {
    return NextResponse.json({ error: 'Token and new password are required' }, { status: 400 })
  }

  // Tokens are 256-bit random (unguessable) — this is a safety net against
  // a client retry-looping on one token, not the primary defense.
  const limit = rateLimit('reset-password-attempt', token, 10, 900)
  if (!limit.success) {
    return NextResponse.json({ error: 'Too many attempts. Please request a new reset link.' }, { status: 429 })
  }

  // Same strength/breach checks as signup, checked BEFORE consuming the
  // token — a request that's going to be rejected for a weak password
  // shouldn't burn the user's one-time token in the process.
  const passwordError = validatePasswordStrength(password)
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 })
  }
  if (await isPasswordBreached(password)) {
    return NextResponse.json({ error: PASSWORD_TOO_COMMON_MESSAGE }, { status: 400 })
  }

  const consumed = await consumePasswordResetToken(token)
  if (!consumed) {
    return NextResponse.json({ error: 'This reset link is invalid or has expired.' }, { status: 400 })
  }

  const passwordHash = await hashPassword(password)
  await db.user.update({ where: { id: consumed.userId }, data: { password_hash: passwordHash } })

  return NextResponse.json({ ok: true })
}
