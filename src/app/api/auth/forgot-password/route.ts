import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'
import { isSameOriginRequest } from '@/lib/same-origin'
import { createPasswordResetToken } from '@/lib/password-reset'
import { sendPasswordResetEmail } from '@/lib/send-password-reset-email'

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

  // Same "identity being targeted" rate-limit pattern as login-password.
  // Rate-limited requests still get the generic response below (never a
  // distinct message) — a different response here would leak rate-limit
  // state the same way a distinct "too many attempts" login message would.
  const limit = rateLimit('forgot-password', email, 5, 3600)
  if (!limit.success) {
    return NextResponse.json(GENERIC_RESPONSE)
  }

  const user = await db.user.findUnique({ where: { email }, select: { id: true } })
  if (user) {
    const token = await createPasswordResetToken(user.id)
    const origin = req.headers.get('origin') ?? new URL(req.url).origin
    const resetUrl = `${origin}/auth/reset-password?token=${token}`
    await sendPasswordResetEmail(email, resetUrl)
  }

  return NextResponse.json(GENERIC_RESPONSE)
}
