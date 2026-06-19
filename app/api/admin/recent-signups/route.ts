import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { sql } from "@/lib/db";

export async function GET() {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  try {
    const rows = (await sql`
      SELECT
        u.id,
        u.name,
        u.created_at,
        COALESCE(cp.player_role, pp.playing_role, 'Player') AS playing_role,
        COALESCE(pp.state, '') AS state,
        ss.total_score,
        op.status AS onboarding_status
      FROM users u
      LEFT JOIN cricket_profile cp ON u.id = cp.user_id
      LEFT JOIN player_profiles pp ON u.id = pp.user_id
      LEFT JOIN athlasx_score ss ON u.id = ss.user_id
      LEFT JOIN onboarding_progress op ON u.id = op.user_id
      WHERE COALESCE(u.role, 'player') = 'player'
      ORDER BY u.created_at DESC
      LIMIT 10
    `) as any[];
    return NextResponse.json(rows);
  } catch (e) {
    console.error("[admin/recent-signups]", e);
    return NextResponse.json([]);
  }
}
