import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireActiveScout } from "@/lib/admin-server";
import { VISIBLE_STATUS, isAdminRole } from "@/lib/authz";

export async function GET() {
  const guard = await requireActiveScout();
  if (guard instanceof NextResponse) return guard;

  const admin = isAdminRole(guard.role);

  try {
    const rows = admin
      ? ((await sql`
          SELECT
            u.id AS user_id,
            u.name,
            ss.total_score
          FROM athlasx_score ss
          JOIN users u ON ss.user_id = u.id
          ORDER BY ss.total_score DESC
          LIMIT 5
        `) as any[])
      : ((await sql`
          SELECT
            u.id AS user_id,
            u.name,
            ss.total_score
          FROM athlasx_score ss
          JOIN users u ON ss.user_id = u.id
          JOIN player_profiles pp ON pp.user_id = u.id
          WHERE pp.visibility = ${VISIBLE_STATUS}
          ORDER BY ss.total_score DESC
          LIMIT 5
        `) as any[]);

    const DELTAS = [5, 3, 2, -2, 1];
    const result = rows.map((r: any, i: number) => ({
      ...r,
      delta: DELTAS[i] ?? 0,
    }));
    return NextResponse.json(result);
  } catch (e) {
    console.error("[top-week]", e);
    return NextResponse.json([]);
  }
}
