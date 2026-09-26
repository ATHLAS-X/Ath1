import { NextRequest, NextResponse } from 'next/server'
import { sendAcademyOtp } from '@/lib/academy-onboarding-otp'
import { rateLimit } from '@/lib/rate-limit'
import { academyGate } from '@/lib/academy/gate'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const gate = academyGate()
  if (gate) return gate

  const { mobile } = await req.json().catch(() => ({}))
  const digits = typeof mobile === 'string' ? mobile.replace(/\D/g, '') : ''
  if (digits.length !== 10) {
    return NextResponse.json({ error: 'mobile must be a 10-digit number' }, { status: 400 })
  }

  const limit = await rateLimit('academy-onboard-otp-send', digits, 5, 3600)
  if (!limit.success) {
    return NextResponse.json({ error: 'Too many OTP requests. Try again later.' }, { status: 429 })
  }

  const { requestId, devCode } = await sendAcademyOtp(digits)
  // SECURITY FIX: devCode used to be returned unconditionally in every
  // environment — a complete account-takeover primitive for anyone who
  // knows a target's phone number, pre-authentication. Gated the same way
  // claim/start.ts already gates its own dev-only OTP log: never exposed
  // once NODE_ENV is production, only in local/dev/test.
  if (process.env.NODE_ENV !== 'production') {
    return NextResponse.json({ requestId, devCode, devNotice: 'Dev mode — no SMS gateway connected' })
  }
  return NextResponse.json({ requestId })
}
