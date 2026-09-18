import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'
import { extractClientIp } from '@/lib/request-ip'

const MIN_NAME_LENGTH = 3

// Finds unclaimed shadow profiles matching what the claiming player typed.
// No phone is stored on ingested profiles, so matching is by name + district
// + DOB — the same three fields an association's ingest source would have.
//
// Deliberately NOT gated by visibility_tier/resolveAssociationScope: this
// is a player identifying THEIR OWN profile pre-authentication, not staff
// browsing other associations' rosters. A player doesn't know which
// association's ingest their record came from, and association_only (the
// default tier) exists to stop OTHER associations' staff from browsing a
// player, not to stop the player themselves from finding and claiming their
// own shadow profile. Same reasoning as my-record's self-lookup exemption.
//
// Because it's public and returns names and dates of birth of ingested
// players — many of them minors who have never used AthlasX — it can't be an
// open lookup either. There's no account to key a limit on, so it's limited
// per IP, and it requires all three fields plus enough of the name that one
// request can't list a district's whole roster.
export async function POST(req: NextRequest) {
  const limit = await rateLimit('claim-search', extractClientIp(req.headers), 10, 900)
  if (!limit.success) {
    return NextResponse.json({ error: 'Too many searches. Wait a few minutes, then try again.' }, { status: 429 })
  }

  const { fullName, district, dob } = await req.json()
  const name = typeof fullName === 'string' ? fullName.trim() : ''

  if (!name || !district || !dob) {
    return NextResponse.json({ error: 'Full name, district and date of birth are all required.' }, { status: 400 })
  }
  if (name.length < MIN_NAME_LENGTH) {
    return NextResponse.json({ error: `Enter at least ${MIN_NAME_LENGTH} letters of your name.` }, { status: 400 })
  }
  const dobDate = new Date(dob)
  if (Number.isNaN(dobDate.getTime())) {
    return NextResponse.json({ error: 'Enter a valid date of birth.' }, { status: 400 })
  }

  const candidates = await db.playerProfile.findMany({
    where: {
      claim_status: 'unclaimed',
      consent_status: { not: 'withdrawn' },
      district: { equals: district, mode: 'insensitive' },
      full_name: { contains: name, mode: 'insensitive' },
      dob: dobDate,
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
