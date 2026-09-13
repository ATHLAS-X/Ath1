import { db } from "@/lib/db";

/**
 * Roles worth an extra DB round-trip on every request. Not player/coach —
 * that would add a DB query to every request across the entire app for a
 * risk this codebase's audit found concentrated in higher-privilege
 * accounts (ops, association staff, academy admins, scouts — the roles
 * that gate real cross-user data access and moderation actions).
 */
export const PRIVILEGED_ROLES: readonly string[] = ["athlasx_ops", "association", "academy_admin", "scout"];

/**
 * Returns the CURRENT role for a session whose JWT-claimed role is one of
 * PRIVILEGED_ROLES, re-checked against the DB on every call — this is the
 * fix for the audit finding that a DB-level role change (promote/demote/
 * revoke) otherwise has no effect until the session's 30-day JWT naturally
 * expires or the user re-authenticates, since NextAuth's jwt callback
 * (src/lib/auth.ts) only sets token.role once, at initial sign-in.
 *
 * For any OTHER claimed role, returns the claim unchanged with NO DB
 * query — this function adds zero per-request cost for player/coach
 * sessions, which is the whole point of scoping it to four roles instead
 * of fixing this generically for every session.
 *
 * Returns null if the account no longer exists at all (deleted) — callers
 * treat that as "this session is no longer valid", forcing re-
 * authentication rather than running the rest of the request as an
 * unauthenticated caller with a stale identity.
 *
 * Deliberately ASYMMETRIC, on purpose: a DEMOTION or REVOCATION (the DB
 * role is no longer privileged, or the row is gone) takes effect on this
 * very request — the whole point of this fix. A PROMOTION into a
 * privileged role from a currently non-privileged JWT claim is NOT
 * detected here, because this function is only ever called once a claim
 * is already privileged — a freshly-promoted user's elevated access still
 * waits for their next real login. That's the safe default direction:
 * revoking access should never wait on a stale token; granting access
 * safely can.
 */
export async function refreshPrivilegedRole(userId: string, claimedRole: string): Promise<string | null> {
  if (!PRIVILEGED_ROLES.includes(claimedRole)) return claimedRole;

  try {
    // User.id is @db.Uuid — a malformed/tampered JWT carrying a non-UUID
    // id (forged, corrupted, or from an incompatible token) makes this
    // query throw at the DB level rather than just miss, unlike a
    // syntactically valid but nonexistent UUID. Either case means "this
    // session doesn't correspond to a real, current account" and should
    // resolve to null (force re-auth), not let a DB error propagate up
    // through NextAuth's session/jwt callbacks and break the request.
    const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
    return user?.role ?? null;
  } catch {
    return null;
  }
}
