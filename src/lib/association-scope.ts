import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/require-auth";

/**
 * Resolves which association IDs a caller may act on — derived ONLY from
 * their own AssociationStaff membership rows, never from a client-supplied
 * associationId. Mirrors feat/w1-w8-and-association-auth's
 * resolveAssociationListScope() design (see lib/schema.sql's
 * association_staff table) ported onto this codebase's role model.
 *
 * Returns `null` for athlasx_ops — unrestricted, matching how every other
 * role check in this codebase treats platform-admin as a superset, not a
 * separate code path.
 *
 * Returns a (possibly empty) array of association IDs for every other
 * role. An empty array means "this caller is scoped to zero associations"
 * — callers must treat that as "return nothing", never as "unscoped".
 */
export async function resolveAssociationScope(user: SessionUser): Promise<string[] | null> {
  if (user.role === "athlasx_ops") return null;

  const rows = await db.associationStaff.findMany({
    where: { user_id: user.id },
    select: { association_id: true },
  });
  return rows.map((r) => r.association_id);
}

/**
 * Same as resolveAssociationScope, but narrows a caller-supplied
 * associationId down to only what they're actually scoped to — an
 * explicit request for an association the caller isn't a member of
 * resolves to an empty scope (zero rows), never silently falling back to
 * "show me my own associations instead". Matches the reference
 * implementation's resolveAssociationListScope contract exactly.
 */
export async function resolveRequestedAssociationScope(
  user: SessionUser,
  requestedAssociationId: string | null,
): Promise<string[] | null> {
  const scope = await resolveAssociationScope(user);
  if (scope === null) return null; // athlasx_ops — unrestricted regardless of what was requested
  if (!requestedAssociationId) return scope;
  return scope.includes(requestedAssociationId) ? [requestedAssociationId] : [];
}
