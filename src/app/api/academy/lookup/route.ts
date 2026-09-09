import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Player onboarding's Batch field (docs/AthlasX_Master_Data_Points.docx
// Phase 1, HIGH) is dual-mode: a dropdown of real AcademyBatch rows when
// the player's academy already has batches set up, free text otherwise.
// The player wizard's own Academy field (src/app/onboarding/page.tsx) is
// free text, not a relation — there is no existing "select an academy"
// step anywhere in that flow — so this is a best-effort case-insensitive
// exact-name lookup against Academy rows that already exist (mostly from
// ingest/association matching, per the Academy model's own comments),
// not an authoritative resolution. A near-miss (typo, "KCA" vs "Kanpur
// Cricket Academy") falls through to the free-text batch_label path,
// same as "batches not yet set up" — this endpoint can't and doesn't try
// to fuzzy-match; see src/lib/identity/identity-normalize.ts for why
// exact-match-or-nothing is the deliberately chosen default elsewhere in
// this codebase for the same class of problem.
//
// Not behind academyGate()/ACADEMY_SELF_SERVE_ENABLED — Academy rows and
// their batches exist independently of the flagged-off self-serve admin
// surface, and this is a read-only lookup for the (always-on) player
// onboarding wizard, not a self-serve academy-admin action.
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name')?.trim()
  if (!name) return NextResponse.json({ found: false, batches: [] })

  const academy = await db.academy.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
    select: {
      id: true,
      batches: { select: { id: true, batch_name: true }, orderBy: { batch_name: 'asc' } },
    },
  })

  if (!academy) return NextResponse.json({ found: false, batches: [] })
  return NextResponse.json({ found: true, academyId: academy.id, batches: academy.batches })
}
