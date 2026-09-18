import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'
import { extractClientIp } from '@/lib/request-ip'
import { isSameOriginRequest } from '@/lib/same-origin'
import { createPasswordResetToken } from '@/lib/password-reset'
import { canDeliverPasswordResetEmail, sendPasswordResetEmail } from '@/lib/send-password-reset-email'

// Identical response whether or not the account exists — same principle as
// authenticateWithPassword's generic "Incorrect email or password.": a
// distinct "no account with that email" message would let anyone enumerate
// registered emails through this endpoint alone.
const GENERIC_RESPONSE = {
  ok: true,
  message: 'If an account exists for that email, a password reset link has been sent.',
}

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }

  // Refuse up front, before any account lookup, when this environment has no
  // way to deliver the email. The order matters: the sender only ever runs
  // for accounts that exist, so letting it fail later would return an error
  // for registered emails and the generic 200 for everyone else — turning
  // this endpoint into exactly the account-existence check it exists to avoid.
  if (!canDeliverPasswordResetEmail()) {
    return NextResponse.json(
      { error: 'Password reset by email isn’t available yet. Contact your association or AthlasX support to reset your password.' },
      { status: 503 },
    )
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const email = String(body.email ?? '').trim().toLowerCase()
  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  // Two buckets, the same shape as login: per-email stops one account being
  // flooded with reset emails; per-IP catches a spray across many emails that
  // stays under the per-email cap. Both still return the generic response —
  // a distinct "too many attempts" message would leak rate-limit state.
  const limit = await rateLimit('forgot-password', email, 5, 3600)
  const ipLimit = await rateLimit('forgot-password-ip', extractClientIp(req.headers), 20, 3600)
  if (!limit.success || !ipLimit.success) {
    return NextResponse.json(GENERIC_RESPONSE)
  }

  const user = await db.user.findUnique({ where: { email }, select: { id: true } })
  if (user) {
    // Anything that fails past this point only fails for accounts that exist,
    // so it must not change the response. Log it for operators instead.
    try {
      const token = await createPasswordResetToken(user.id)
      const origin = req.headers.get('origin') ?? new URL(req.url).origin
      const resetUrl = `${origin}/auth/reset-password?token=${token}`
      await sendPasswordResetEmail(email, resetUrl)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify({
          event: 'auth.password_reset_issue_failed',
          userId: user.id,
          error: err instanceof Error ? err.message : String(err),
        }),
      )
    }
  }

  return NextResponse.json(GENERIC_RESPONSE)
}
