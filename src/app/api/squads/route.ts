import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/require-auth'
import { resolveAssociationScope, resolveRequestedAssociationScope } from '@/lib/association-scope'

export const dynamic = 'force-dynamic'

// Lists squads the caller can see: ops sees all, association staff sees
// their own association's squads, a coach sees squads they're assigned to.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const scope = await resolveAssociationScope(auth.user)
  const squads = await db.squad.findMany({
    where: scope === null ? undefined : {
      OR: [
        { association_id: { in: scope } },
        { coaches: { some: { user_id: auth.user.id } } },
      ],
    },
    include: { _count: { select: { players: true, coaches: true } } },
    orderBy: { created_at: 'desc' },
  })

  return NextResponse.json({ squads })
}

// Creates a squad and its initial roster in one transaction. Association-
// staff/ops only — a squad is formed by the association, not self-assembled
// by a coach.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { associationId, name, season, trialCycleId, playerIds } = await req.json()
  if (!associationId || !name || !season) {
    return NextResponse.json({ error: 'associationId, name, and season are required' }, { status: 400 })
  }

  const scope = await resolveRequestedAssociationScope(auth.user, associationId)
  if (scope !== null && !scope.includes(associationId)) {
    return NextResponse.json({ error: 'Forbidden — not scoped to this association' }, { status: 403 })
  }

  const squad = await db.$transaction(async (tx) => {
    const created = await tx.squad.create({
      data: {
        association_id: associationId,
        trial_cycle_id: trialCycleId ?? undefined,
        name,
        season,
      },
    })
    const ids: string[] = Array.isArray(playerIds) ? playerIds : []
    if (ids.length > 0) {
      await tx.squadPlayer.createMany({
        data: ids.map((player_id: string) => ({ squad_id: created.id, player_id })),
        skipDuplicates: true,
      })
    }
    return created
  })

  return NextResponse.json({ squad })
}
