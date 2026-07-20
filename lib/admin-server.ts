import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

/** Resolve session + verify the user has role='admin'. */
export async function requireAdmin(): Promise<{ userId: string } | NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const rows = (await sql`
    SELECT role FROM users WHERE id = ${session.user.id} LIMIT 1
  `) as unknown as Array<{ role: string }>;
  if (!isAdminRole(rows[0]?.role)) {
    return NextResponse.json({ success: false, error: "Forbidden — admin only" }, { status: 403 });
  }
  return { userId: session.user.id };
}

/* Both values exist in the wild: make-admin.ts writes 'admin', the signup
   role enum uses 'athlasx_admin'. */
function isAdminRole(role: string | undefined): boolean {
  return role === "admin" || role === "athlasx_admin";
}

/** Resolve session + verify role is scout or admin AND account_status='active'.
 *  Mirrors requireAdmin() — same 401 (no session) / 403 (wrong role or not
 *  active yet) split. */
export async function requireActiveScout(): Promise<
  { userId: string; role: string } | NextResponse
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const rows = (await sql`
    SELECT role, account_status FROM users WHERE id = ${session.user.id} LIMIT 1
  `) as unknown as Array<{ role: string; account_status: string | null }>;
  const row = rows[0];
  const role = row?.role;
  if (role !== "scout" && !isAdminRole(role)) {
    return NextResponse.json({ success: false, error: "Forbidden — scout only" }, { status: 403 });
  }
  if (row?.account_status !== "active") {
    return NextResponse.json({ success: false, error: "Account is not active" }, { status: 403 });
  }
  return { userId: session.user.id, role };
}

/** True if the user is an admin (server-side, for non-route helpers).
 *  Accepts an optional `sessionRole` (the role on the signed JWT) so that
 *  when the DB is briefly unreachable we don't 500 the entire admin shell —
 *  we trust the signed session role for the duration of the outage. */
export async function isAdminUser(userId: string, sessionRole?: string): Promise<boolean> {
  try {
    const rows = (await sql`
      SELECT role FROM users WHERE id = ${userId} LIMIT 1
    `) as unknown as Array<{ role: string }>;
    return isAdminRole(rows[0]?.role);
  } catch (e) {
    /* Network blip — fall back to the JWT's role. The JWT is signed so a
       caller can't forge athlasx_admin here. */
    console.warn("[isAdminUser] DB lookup failed, falling back to session role:", (e as any)?.message);
    return isAdminRole(sessionRole);
  }
}