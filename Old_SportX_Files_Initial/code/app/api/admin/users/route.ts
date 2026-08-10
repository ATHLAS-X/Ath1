import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const role = (req.nextUrl.searchParams.get("role") ?? "").trim();

  try {
    const rows = (await sql`
      SELECT u.id, u.name, u.email, u.role,
             COALESCE(u.account_status, 'pending') AS account_status,
             u.created_at, u.phone, u.phone_verified_at
      FROM users u
      WHERE (${q} = '' OR u.name ILIKE ${"%" + q + "%"} OR u.email ILIKE ${"%" + q + "%"})
        AND (${role} = '' OR u.role = ${role})
      ORDER BY u.created_at DESC
      LIMIT 100
    `) as unknown as Array<any>;
    return NextResponse.json(rows);
  } catch (e) {
    console.error("[admin/users]", e);
    return NextResponse.json([]);
  }
}
