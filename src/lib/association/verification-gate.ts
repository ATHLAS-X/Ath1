import { db } from '@/lib/db'
import type { SessionUser } from '@/lib/require-auth'
import { resolveAssociationScope, resolveRequestedAssociationScope } from '@/lib/association-scope'

/**
 * The pending-verification gate — every association-scoped chokepoint in
 * this codebase (src/app/api/association/**, src/app/api/associations/**,
 * squad-access.ts, and the (dashboard)/association page shell) should
 * resolve scope through these wrappers instead of calling
 * resolveAssociationScope/resolveRequestedAssociationScope directly, so a
 * self-serve association stuck in `pending` (or ever moved to `rejected`)
 * gets zero real association-scoped access — the same "empty scope means
 * see nothing" contract those two functions already document, just
 * additionally filtered by verification_status.
 *
 * athlasx_ops is unaffected (both underlying functions already return
 * `null` — unrestricted — for that role; there's no verification_status
 * to check because there's no scope to filter).
 */

async function approvedIdsWithin(candidateIds: string[]): Promise<string[]> {
  if (candidateIds.length === 0) return []
  const rows = await db.association.findMany({
    where: { id: { in: candidateIds }, verification_status: 'approved' },
    select: { id: true },
  })
  return rows.map((r) => r.id)
}

export async function resolveVerifiedAssociationScope(user: SessionUser): Promise<string[] | null> {
  const scope = await resolveAssociationScope(user)
  if (scope === null) return null
  return approvedIdsWithin(scope)
}

export async function resolveVerifiedRequestedAssociationScope(
  user: SessionUser,
  requestedAssociationId: string | null,
): Promise<string[] | null> {
  const scope = await resolveRequestedAssociationScope(user, requestedAssociationId)
  if (scope === null) return null
  return approvedIdsWithin(scope)
}

/**
 * Page-shell check: does this signed-in association-role user have at
 * least one real (approved) association, or are they stuck pending/
 * rejected? Used to route to the holding page
 * (src/app/association/pending/page.tsx) instead of the real dashboard.
 * athlasx_ops always passes (unrestricted, nothing to be "pending" on).
 */
export async function isAssociationAccessPending(user: SessionUser): Promise<boolean> {
  if (user.role === 'athlasx_ops') return false
  const rawScope = await resolveAssociationScope(user)
  if (rawScope === null || rawScope.length === 0) return false // no staff row at all — not this gate's concern
  const approved = await approvedIdsWithin(rawScope)
  return approved.length === 0
}
