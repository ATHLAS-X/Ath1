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

  const targetAcademyId = academyId ?? candidate.suggested_academy_id
  if (!targetAcademyId) {
    return NextResponse.json({ error: 'No academyId provided and no suggestion to confirm' }, { status: 400 })
  }

  await db.$transaction([
    db.academyMatchCandidate.update({
      where: { id: params.id },
      data: { status: 'confirmed', suggested_academy_id: targetAcademyId, reviewed_at: new Date() },
    }),
    db.academy.update({
      where: { id: targetAcademyId },
      data: { name_variants: { push: candidate.raw_string } },
    }),
  ])

  return NextResponse.json({ confirmed: true, academyId: targetAcademyId })
}
