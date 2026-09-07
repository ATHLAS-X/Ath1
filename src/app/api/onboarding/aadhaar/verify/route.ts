import { NextRequest, NextResponse } from 'next/server'
import { resolveAadhaarProvider } from '@/lib/aadhaar-verification'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { requestId, code } = await req.json().catch(() => ({}))
  if (typeof requestId !== 'string' || typeof code !== 'string' || code.replace(/\D/g, '').length !== 6) {
    return NextResponse.json({ error: 'requestId and a 6-digit code are required' }, { status: 400 })
  }

  const provider = resolveAadhaarProvider()
  const verified = await provider.verify(requestId, code)
  if (!verified) {
    return NextResponse.json({ error: 'Incorrect or expired code' }, { status: 400 })
  }
  return NextResponse.json({ verified: true })
}
