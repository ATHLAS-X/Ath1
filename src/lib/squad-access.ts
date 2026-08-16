import { db } from '@/lib/db'
import type { SessionUser } from '@/lib/require-auth'
import { resolveAssociationScope } from '@/lib/association-scope'

/**
 * A caller can act on a squad if they're athlasx_ops (unrestricted),
 * association staff of the squad's own association (per
 * resolveAssociationScope — real AssociationStaff membership, never a
 * client-supplied ID), or a coach with a real SquadCoach row for this
 * specific squad. Mirrors the same "membership row is the only source of
 * access" discipline as resolveAssociationScope/canAccessAssociation.
 */
export async function canAccessSquad(user: SessionUser, squadId: string): Promise<boolean> {
  if (user.role === 'athlasx_ops') return true

  const squad = await db.squad.findUnique({ where: { id: squadId }, select: { association_id: true } })
  if (!squad) return false

  const scope = await resolveAssociationScope(user)
  if (scope !== null && scope.includes(squad.association_id)) return true

  const membership = await db.squadCoach.findFirst({
    where: { squad_id: squadId, user_id: user.id },
    select: { id: true },
  })
  return membership !== null
}

/** Squad IDs a coach is a real member of — used by coach/squad/route.ts to
 *  resolve "this coach's own squad" instead of guessing. */
export async function squadIdsForCoach(userId: string): Promise<string[]> {
  const rows = await db.squadCoach.findMany({ where: { user_id: userId }, select: { squad_id: true } })
  return rows.map(r => r.squad_id)
}
