import { NextRequest, NextResponse } from 'next/server'
import { resolveAadhaarProvider } from '@/lib/aadhaar-verification'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { requestId, code } = await req.json().catch(() => ({}))
  if (typeof requestId !== 'string' || typeof code !== 'string' || code.replace(/\D/g, '').length !== 6) {
    return NextResponse.json({ error: 'requestId and a 6-digit code are required' }, { status: 400 })
  }

  // Mirrors /api/onboarding/aadhaar/initiate's send-side rateLimit — the
  // verify side had no guess-rate bound at all.
  const limit = rateLimit('aadhaar-otp-verify', requestId, 10, 3600)
  if (!limit.success) {
    return NextResponse.json({ error: 'Too many verification attempts. Try again later.' }, { status: 429 })
  }

  const provider = resolveAadhaarProvider()
  const verified = await provider.verify(requestId, code)
  if (!verified) {
    return NextResponse.json({ error: 'Incorrect or expired code' }, { status: 400 })
  }
  return NextResponse.json({ verified: true })
}
