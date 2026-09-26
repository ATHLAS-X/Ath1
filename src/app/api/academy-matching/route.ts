import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/require-auth'

export const dynamic = 'force-dynamic'

// SECURITY FIX: this and the sibling [id]/confirm|reject routes previously
// only called requireAuth (any logged-in role, e.g. a player or coach could
// read/mutate this internal identity-resolution queue). The direct analog,
// ingest/[id]/decide, already gates on ['association', 'athlasx_ops'] —
// applying the same gate here.
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['association', 'athlasx_ops'])
  if (auth instanceof NextResponse) return auth

  const candidates = await db.academyMatchCandidate.findMany({
    where: { status: { in: ['unmatched', 'suggested'] } },
    include: { suggested_academy: { select: { id: true, name: true, district: true } } },
    orderBy: { created_at: 'desc' },
  })
  return NextResponse.json({ candidates })
}
