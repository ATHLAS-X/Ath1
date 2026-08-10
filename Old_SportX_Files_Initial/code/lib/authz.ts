/**
 * Single authorization layer for the player-visibility model. Every route
 * that returns player data should call canViewPlayerProfile() instead of
 * re-implementing its own visibility/role/ownership check — that
 * per-file duplication is how the scout endpoints ended up with no guard
 * at all (see lib/admin-server.ts's requireActiveScout() for the sibling
 * "is this caller allowed to act as a scout/admin at all" check; this file
 * is specifically "can this caller see THIS player's data").
 *
 * IMPORTANT — schema reality check: the live Neon `player_profiles.visibility`
 * column uses the values 'Private' and 'Scout Visible' (see
 * app/api/admin/approvals/route.ts and app/api/player/profile/submit/route.ts),
 * NOT the Prisma schema's DRAFT/HIDDEN/LIVE enum, which was never applied to
 * the running database (confirmed: lib/schema.sql is the live source of
 * truth, prisma/schema.prisma is aspirational — see prisma/MIGRATION_NOTES.md).
 * VISIBLE_STATUS below is the actual gate value. If you migrate the column to
 * the Prisma enum, update VISIBLE_STATUS here — every caller of this module
 * inherits the fix automatically since they don't compare the literal string
 * themselves.
 */
import type { Session } from "next-auth";

/** Exported so list/search queries (scout/players, scout/top-week, etc.) can
 *  filter `WHERE pp.visibility = ${VISIBLE_STATUS}` for non-admin callers
 *  instead of hardcoding the literal string themselves. */
export const VISIBLE_STATUS = "Scout Visible";

const ADMIN_ROLES = new Set(["admin", "athlasx_admin"]);
const STAFF_ROLES = new Set(["scout", "academy_admin", "coach"]);

/** True if `role` always bypasses the visibility filter (used by list
 *  endpoints to decide whether to add the visibility WHERE clause at all). */
export function isAdminRole(role: string | null | undefined): boolean {
  return !!role && ADMIN_ROLES.has(role);
}

export interface ViewablePlayer {
  visibility: string | null;
  user_id: string;
}

function viewerFields(viewer: Session | null): { id: string | null; role: string | null; accountStatus: string | null } {
  const user = viewer?.user as any;
  return {
    id: user?.id ?? null,
    role: user?.role ?? null,
    accountStatus: user?.account_status ?? null,
  };
}

/**
 * Owner can always view their own profile, regardless of visibility.
 * Admin can always view any profile.
 * Scout / academy_admin / coach can view only if they have an ACTIVE account
 * AND the profile's visibility is 'Scout Visible' (the live-schema "LIVE"
 * equivalent — see VISIBLE_STATUS above).
 * Everyone else (no session, pending/suspended staff, player role, etc.)
 * gets false.
 */
export function canViewPlayerProfile(viewer: Session | null, player: ViewablePlayer): boolean {
  const { id, role, accountStatus } = viewerFields(viewer);
  if (!id || !role) return false;

  if (id === player.user_id) return true;
  if (ADMIN_ROLES.has(role)) return true;

  if (STAFF_ROLES.has(role)) {
    return accountStatus === "active" && player.visibility === VISIBLE_STATUS;
  }

  return false;
}
