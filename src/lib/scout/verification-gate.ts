import { db } from '@/lib/db'
import type { SessionUser } from '@/lib/require-auth'

/**
 * Scout's pending-verification gate — mirrors
 * src/lib/association/verification-gate.ts, simplified for ScoutProfile's
 * 1:1 relationship to User (no multi-org scope array the way
 * AssociationStaff gives associations: a scout account has exactly one
 * ScoutProfile, so there's nothing to resolve a "scope" list for — just a
 * single verified/not-verified check).
 *
 * athlasx_ops is always treated as verified — the same unrestricted-
 * superset treatment every other role-scoped check in this codebase
 * gives it.
 */

export async function isScoutVerified(user: SessionUser): Promise<boolean> {
  if (user.role === 'athlasx_ops') return true
  if (user.role !== 'scout') return false
  const profile = await db.scoutProfile.findUnique({
    where: { user_id: user.id },
    select: { verification_status: true },
  })
  return profile?.verification_status === 'approved'
}

/**
 * Page-shell check: does this signed-in scout have an approved
 * ScoutProfile, or are they stuck pending/rejected (or missing a profile
 * row entirely)? Used to route to the holding page
 * (src/app/scout/pending/page.tsx) instead of the real dashboard.
 * athlasx_ops always passes (unrestricted, nothing to be "pending" on) —
 * mirrors isAssociationAccessPending's own role check.
 */
export async function isScoutAccessPending(user: SessionUser): Promise<boolean> {
  if (user.role !== 'scout') return false
  return !(await isScoutVerified(user))
}
