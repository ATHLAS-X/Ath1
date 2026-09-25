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

  await db.academyMatchCandidate.update({
    where: { id: params.id },
    data: { status: 'rejected', reviewed_at: new Date() },
  })

  return NextResponse.json({ rejected: true })
}
