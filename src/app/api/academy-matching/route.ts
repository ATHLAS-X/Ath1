import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/require-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const candidates = await db.academyMatchCandidate.findMany({
    where: { status: { in: ['unmatched', 'suggested'] } },
    include: { suggested_academy: { select: { id: true, name: true, district: true } } },
    orderBy: { created_at: 'desc' },
  })
  return NextResponse.json({ candidates })
}
