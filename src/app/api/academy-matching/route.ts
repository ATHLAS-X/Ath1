import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const candidates = await db.academyMatchCandidate.findMany({
    where: { status: { in: ['unmatched', 'suggested'] } },
    include: { suggested_academy: { select: { id: true, name: true, district: true } } },
    orderBy: { created_at: 'desc' },
  })
  return NextResponse.json({ candidates })
}
