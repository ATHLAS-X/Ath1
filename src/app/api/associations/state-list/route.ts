import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Deliberately NOT auth-gated — a district association signing up needs to
// pick its parent state association before it has any account, same
// reasoning as GET /api/trial-cycles's public browsing. Returns only
// state-type associations' id/name/state — no staff, no PII, nothing the
// existing authenticated GET /api/associations exposes beyond that.
export async function GET() {
  const associations = await db.association.findMany({
    where: { type: 'state' },
    select: { id: true, name: true, state: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({ associations })
}
