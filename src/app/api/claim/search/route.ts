import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Finds unclaimed shadow profiles matching what the claiming player typed.
// No phone is stored on ingested profiles, so matching is by name + district
// + DOB — the same three fields an association's ingest source would have.
export async function POST(req: NextRequest) {
  const { fullName, district, dob } = await req.json()

  if (!fullName || !district) {
    return NextResponse.json({ error: 'fullName and district are required' }, { status: 400 })
  }

  const candidates = await db.playerProfile.findMany({
    where: {
      claim_status: 'unclaimed',
      district: { equals: district, mode: 'insensitive' },
      full_name: { contains: fullName, mode: 'insensitive' },
      ...(dob ? { dob: new Date(dob) } : {}),
    },
    select: {
      id: true,
      full_name: true,
      dob: true,
      district: true,
      state: true,
      academy: true,
      playing_role: true,
      profile_source: true,
    },
    take: 10,
  })

  return NextResponse.json({ candidates })
}
