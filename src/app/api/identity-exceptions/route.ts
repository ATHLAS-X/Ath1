import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/require-auth'
import { resolveVerifiedAssociationScope } from '@/lib/association/verification-gate'

export const dynamic = 'force-dynamic'

// Gated to association_staff/athlasx_ops per the auth pass's role model —
// mandatorily scoped via resolveAssociationScope, never an optional
// client-supplied associationId.
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['association', 'athlasx_ops'])
  if (auth instanceof NextResponse) return auth

  const scope = await resolveVerifiedAssociationScope(auth.user)
  const exceptions = await db.identityException.findMany({
    where: scope === null ? { status: 'OPEN' } : { status: 'OPEN', association_id: { in: scope } },
    orderBy: { created_at: 'desc' },
  })

  // candidate_player_ids is a raw String[], not a relation — resolve display
  // info for every candidate across all open exceptions in one query so the
  // review page never has to be handed bare UUIDs.
  const candidateIds = Array.from(new Set(exceptions.flatMap((e) => e.candidate_player_ids)))
  const candidates = candidateIds.length
    ? await db.playerProfile.findMany({
        where: { id: { in: candidateIds } },
        select: { id: true, full_name: true, dob: true, district: true, state: true },
      })
    : []
  const candidateById = new Map(candidates.map((c) => [c.id, c]))

  return NextResponse.json({
    exceptions: exceptions.map((e) => ({
      ...e,
      candidates: e.candidate_player_ids.map(
        (id) => candidateById.get(id) ?? { id, full_name: null, dob: null, district: null, state: null },
      ),
    })),
  })
}
