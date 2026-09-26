import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/require-auth'

// SECURITY FIX: previously only requireAuth — any authenticated role could
// mutate this identity-resolution data. Gated the same as ingest/[id]/decide.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(req, ['association', 'athlasx_ops'])
  if (auth instanceof NextResponse) return auth

  const candidate = await db.academyMatchCandidate.findUnique({ where: { id: params.id } })
  if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })

  // 'confirmed' and 'rejected' are terminal (see confirm/route.ts). The status
  // filter makes the guard atomic against a concurrent decision.
  const decided = await db.academyMatchCandidate.updateMany({
    where: { id: params.id, status: { in: ['unmatched', 'suggested'] } },
    data: { status: 'rejected', reviewed_by: auth.user.id, reviewed_at: new Date() },
  })
  if (decided.count === 0) {
    return NextResponse.json({ error: `Candidate is already ${candidate.status}` }, { status: 409 })
  }

  return NextResponse.json({ rejected: true })
}
