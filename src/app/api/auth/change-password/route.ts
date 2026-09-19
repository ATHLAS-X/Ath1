import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/require-auth'
import { applySessionCookie, encodeSessionToken } from '@/lib/auth'
import { comparePassword, hashPassword, validatePasswordStrength, PASSWORD_TOO_COMMON_MESSAGE } from '@/lib/password'
import { isPasswordBreached } from '@/lib/hibp'
import { isSameOriginRequest } from '@/lib/same-origin'
import { rateLimit } from '@/lib/rate-limit'

// Signed-in password change, used by /settings. Before this route, a signed-in
// user who wanted a new password had to sign out and go through the
// forgot-password email flow.
//
// Needs prisma/manual_migrations/password_reset_tokens.sql applied: it stamps
// User.password_changed_at and retires outstanding reset links, and both
// writes fail until that migration has run.
export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }

  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const currentPassword = String(body.currentPassword ?? '')
  const newPassword = String(body.newPassword ?? '')
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Enter your current password and a new one.' }, { status: 400 })
  }

  // Keyed by account, so a stolen session can't brute-force the current
  // password through this endpoint.
  const limit = await rateLimit('change-password', auth.user.id, 5, 900)
  if (!limit.success) {
    return NextResponse.json({ error: 'Too many attempts. Wait a few minutes, then try again.' }, { status: 429 })
  }

  const user = await db.user.findUnique({
    where: { id: auth.user.id },
    select: { email: true, role: true, password_hash: true },
  })
  if (!user?.password_hash) {
    return NextResponse.json({ error: 'This account doesn’t have a password to change.' }, { status: 400 })
  }

  if (!(await comparePassword(currentPassword, user.password_hash))) {
    return NextResponse.json({ error: 'Your current password is incorrect.' }, { status: 400 })
  }
  if (newPassword === currentPassword) {
    return NextResponse.json({ error: 'Choose a new password that’s different from your current one.' }, { status: 400 })
  }

  // Same strength and breach checks as signup and reset-password.
  const passwordError = validatePasswordStrength(newPassword)
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 })
  }
  if (await isPasswordBreached(newPassword)) {
    return NextResponse.json({ error: PASSWORD_TOO_COMMON_MESSAGE }, { status: 400 })
  }

  const passwordHash = await hashPassword(newPassword)
  const changedAt = new Date()
  await db.$transaction([
    db.user.update({
      where: { id: auth.user.id },
      data: { password_hash: passwordHash, password_changed_at: changedAt },
      select: { id: true },
    }),
    // A reset link requested before this change must stop working.
    db.passwordResetToken.updateMany({
      where: { user_id: auth.user.id, consumed_at: null },
      data: { consumed_at: changedAt },
    }),
  ])

  // Stamping password_changed_at ends every privileged session that signed in
  // before now — including this one. Re-issue this device's session (its
  // authTime is taken after changedAt) so the person who just changed their
  // password stays signed in here while other devices are signed out.
  const res = NextResponse.json({ ok: true })
  const token = await encodeSessionToken({ id: auth.user.id, email: user.email, role: user.role })
  return applySessionCookie(res, token)
}
