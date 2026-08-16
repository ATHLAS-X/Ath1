/**
 * Single chokepoint for cross-association player visibility.
 *
 * Every player belongs to one association (PlayerProfile.association_id).
 * By default (visibility_tier = association_only) only that association's
 * own staff — and unrestricted athlasx_ops — can see the player at all.
 * A player can opt into being visible more broadly:
 *   - cross_association: any association's staff can see them.
 *   - franchise_scout: additionally gated adult-only, and hard-disabled
 *     behind FRANCHISE_SCOUT_ENABLED (see feature-flags.ts) since no scout
 *     role/route exists on this branch yet — enforced HERE too, not just
 *     at the UI/route boundary, so a row with the tier already set can't
 *     leak through if the flag is ever flipped on prematurely.
 *
 * Every route that lists or reads PlayerProfile data across an
 * association boundary should go through visibilityWhere() (list queries)
 * or canViewPlayerProfile() (single-record checks) rather than
 * reimplementing this logic — that's the whole point of a chokepoint.
 */
import type { Prisma } from '@prisma/client'
import { FRANCHISE_SCOUT_ENABLED } from '@/lib/feature-flags'

const ADULT_AGE_YEARS = 18

export function isAdult(dob: Date): boolean {
  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - ADULT_AGE_YEARS)
  return dob <= cutoff
}

/**
 * Prisma where-clause fragment for PlayerProfile list queries. Combine
 * with `AND` alongside any other filters (consent, claim_status, etc.) —
 * this only expresses the visibility boundary.
 *
 * `viewerScope` is the caller's resolveAssociationScope() result verbatim:
 * null = unrestricted (athlasx_ops), otherwise the association IDs the
 * caller's own AssociationStaff rows grant. An empty array is handled by
 * Prisma's own `{ in: [] }` semantics (matches zero rows) — no special
 * casing needed, matching the idiom already used in identity-exceptions.
 */
export function visibilityWhere(viewerScope: string[] | null): Prisma.PlayerProfileWhereInput {
  if (viewerScope === null) return {}

  const clauses: Prisma.PlayerProfileWhereInput[] = [
    { association_id: { in: viewerScope } },
    { visibility_tier: 'cross_association' },
  ]
  if (FRANCHISE_SCOUT_ENABLED) {
    const cutoff = new Date()
    cutoff.setFullYear(cutoff.getFullYear() - ADULT_AGE_YEARS)
    clauses.push({ visibility_tier: 'franchise_scout', dob: { lte: cutoff } })
  }
  return { OR: clauses }
}

/** Single-record check, for routes that fetch one player by ID directly
 *  rather than filtering a list (e.g. a detail/profile view). */
export function canViewPlayerProfile(
  viewerScope: string[] | null,
  player: { association_id: string | null; visibility_tier: string; dob: Date },
): boolean {
  if (viewerScope === null) return true
  if (player.association_id !== null && viewerScope.includes(player.association_id)) return true
  if (player.visibility_tier === 'cross_association') return true
  if (player.visibility_tier === 'franchise_scout' && FRANCHISE_SCOUT_ENABLED && isAdult(player.dob)) return true
  return false
}
