import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Deliberately NOT auth-gated — coach onboarding runs pre-account, same
// reasoning as GET /api/associations/state-list. Unlike that route this
// returns every association (state and district), since CoachProfile.
// association_id can point to either.
export async function GET() {
  const associations = await db.association.findMany({
    select: { id: true, name: true, state: true, type: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({ associations })
}
