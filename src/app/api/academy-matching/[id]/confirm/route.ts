import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/require-auth'

// Confirms a raw ingested academy string as the same academy the fuzzy
// matcher suggested (or a different one the reviewer picked). Never
// auto-merged — a human always confirms before name_variants grows.
//
// SECURITY FIX: previously only requireAuth — any authenticated role could
// mutate this identity-resolution data. Gated the same as ingest/[id]/decide.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(req, ['association', 'athlasx_ops'])
  if (auth instanceof NextResponse) return auth

  const { academyId } = await req.json()

  const candidate = await db.academyMatchCandidate.findUnique({ where: { id: params.id } })
  if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })

  // 'confirmed' and 'rejected' are terminal: a candidate is decided INTO them,
  // never out of them (GET /api/academy-matching only queues 'unmatched' and
  // 'suggested'). Without this, a repeat confirm re-pushed the same string
  // into name_variants and a later reject silently reverted a confirmed match.
  if (candidate.status === 'confirmed' || candidate.status === 'rejected') {
    return NextResponse.json({ error: `Candidate is already ${candidate.status}` }, { status: 409 })
  }

  const targetAcademyId = academyId ?? candidate.suggested_academy_id
  if (!targetAcademyId) {
    return NextResponse.json({ error: 'No academyId provided and no suggestion to confirm' }, { status: 400 })
  }

  // The status filter on the update makes the guard atomic: of two concurrent
  // decisions, only one matches a still-open candidate.
  const decided = await db.$transaction(async (tx) => {
    const claimed = await tx.academyMatchCandidate.updateMany({
      where: { id: params.id, status: { in: ['unmatched', 'suggested'] } },
      data: { status: 'confirmed', suggested_academy_id: targetAcademyId, reviewed_by: auth.user.id, reviewed_at: new Date() },
    })
    if (claimed.count === 0) return false
    await tx.academy.update({
      where: { id: targetAcademyId },
      data: { name_variants: { push: candidate.raw_string } },
    })
    return true
  })
  if (!decided) {
    return NextResponse.json({ error: 'Candidate was already decided' }, { status: 409 })
  }

  return NextResponse.json({ confirmed: true, academyId: targetAcademyId })
}
