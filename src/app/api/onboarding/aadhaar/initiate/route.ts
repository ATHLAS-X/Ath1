import { NextRequest, NextResponse } from 'next/server'
import { resolveAadhaarProvider } from '@/lib/aadhaar-verification'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// Pre-auth by design — this runs during onboarding, before any account or
// player profile exists to attach a session to. Not scoped to a caller
// identity for the same reason /api/claim/start isn't.
export async function POST(req: NextRequest) {
  const { aadhaarNumber } = await req.json().catch(() => ({}))
  const digits = typeof aadhaarNumber === 'string' ? aadhaarNumber.replace(/\D/g, '') : ''
  if (digits.length !== 12) {
    return NextResponse.json({ error: 'aadhaarNumber must be 12 digits' }, { status: 400 })
  }

  // Keyed by the number itself rather than an IP/session — nothing else
  // identifies the caller at this point in the flow.
  const limit = await rateLimit('aadhaar-otp-send', digits, 5, 3600)
  if (!limit.success) {
    return NextResponse.json({ error: 'Too many verification requests. Try again later.' }, { status: 429 })
  }

  const provider = resolveAadhaarProvider()
  const result = await provider.initiate(digits)
  return NextResponse.json(result)
}
