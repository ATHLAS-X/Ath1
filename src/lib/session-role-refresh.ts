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
 * When this session signed in, in epoch milliseconds — the `authTime` claim
 * set once at sign-in (src/lib/auth.ts) and carried unchanged when NextAuth
 * re-issues the cookie. Not `iat`: NextAuth refreshes `iat` on every
 * re-issue, so a session kept alive after a password change would keep
 * looking newer than that change and never be revoked.
 *
 * Sessions issued before `authTime` existed report 0, which treats them as
 * older than any password change — the safe direction.
 */
export function sessionAuthTime(token: Record<string, unknown>): number {
  return typeof token.authTime === "number" ? token.authTime : 0;
}

// Whether athlasx.users.password_changed_at exists yet. It ships in an
// unapplied migration (prisma/manual_migrations/password_reset_tokens.sql);
// until that runs, selecting it throws. Detected once per process on the
// first failure, so every later request goes straight back to one query.
let passwordChangedColumnAvailable = true;

// Prisma P2022: "The column does not exist in the current database". Checked
// by code rather than instanceof, so it also matches errors from the separate
// generated client the test suite uses.
function isMissingColumnError(err: unknown): boolean {
  return (err as { code?: unknown } | null)?.code === "P2022";
}

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
 * Returns null — "this session is no longer valid", forcing
 * re-authentication — if the account no longer exists, or if its password
 * changed after this session signed in (`authTime`). The second check rides
 * on the same query, so it costs nothing extra, and it inherits the same
 * scope: a password reset evicts privileged sessions immediately, while
 * player/coach sessions keep running until they expire or sign out.
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
export async function refreshPrivilegedRole(
  userId: string,
  claimedRole: string,
  authTime = 0,
): Promise<string | null> {
  if (!PRIVILEGED_ROLES.includes(claimedRole)) return claimedRole;

  if (passwordChangedColumnAvailable) {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { role: true, password_changed_at: true },
      });
      if (!user) return null;
      if (user.password_changed_at && user.password_changed_at.getTime() > authTime) return null;
      return user.role;
    } catch (err) {
      // Anything other than the not-yet-migrated column keeps the original
      // behaviour below: fail closed (see the malformed-id note).
      if (!isMissingColumnError(err)) return null;
      passwordChangedColumnAvailable = false;
      // eslint-disable-next-line no-console
      console.warn(
        JSON.stringify({
          event: "auth.password_changed_at_unavailable",
          note: "password_reset_tokens.sql not applied — sessions are not revoked on password change until it is",
        }),
      );
    }
  }

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
