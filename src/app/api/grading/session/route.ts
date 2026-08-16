import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/require-auth'
import { resolveAssociationScope } from '@/lib/association-scope'

export const dynamic = 'force-dynamic'

// Returns the most recently created selection session (scoped to the
// caller's own association — was previously the most recent session in the
// WHOLE database regardless of which association the caller belongs to),
// its real players, and the pool of users eligible to act as a selector —
// enough for the grading page to submit and read grades against the live
// database instead of local component state.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const scope = await resolveAssociationScope(auth.user)
  if (scope !== null && scope.length === 0) return NextResponse.json({ session: null })

  const session = await db.selectionSession.findFirst({
    where: scope === null ? undefined : { association_id: { in: scope } },
    orderBy: { created_at: 'desc' },
    include: {
      association: { include: { players: { where: { consent_status: { not: 'withdrawn' } }, orderBy: { created_at: 'asc' } } } },
    },
  })

  if (!session) return NextResponse.json({ session: null })

  const selectors = await db.user.findMany({
    where: { role: 'selection_panel' },
    select: { id: true, email: true },
  })

  return NextResponse.json({
    session: {
      id: session.id,
      chair_id: session.chair_id,
      convergence_unlocked_at: session.convergence_unlocked_at,
      players: session.association.players.map(p => ({
        id: p.id,
        full_name: p.full_name,
        district: p.district,
        playing_role: p.playing_role,
      })),
    },
    selectors,
  })
}
