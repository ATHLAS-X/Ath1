import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role") ?? "";
  const state = searchParams.get("state") ?? "";
  const minScore = parseInt(searchParams.get("minScore") ?? "0");
  const maxAge = parseInt(searchParams.get("maxAge") ?? "100");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "8"), 50);

  try {
    const rows = (await sql`
      SELECT
        u.id AS user_id,
        u.name,
        COALESCE(pp.city, pp.district, '') AS city,
        COALESCE(pp.state, '') AS state,
        COALESCE(cp.player_role, pp.playing_role, 'Player') AS playing_role,
        ss.total_score,
        ss.coach_verified,
        COALESCE(ps.bpi, 0) AS bpi,
        pp.avatar_url
      FROM athlasx_score ss
      JOIN users u ON ss.user_id = u.id
      LEFT JOIN cricket_profile cp ON u.id = cp.user_id
      LEFT JOIN player_profiles pp ON u.id = pp.user_id
      LEFT JOIN performance_stats ps ON u.id = ps.user_id AND ps.format = 'T20'
      WHERE ss.total_score >= ${minScore}
        AND (${role} = '' OR LOWER(COALESCE(cp.player_role, pp.playing_role, '')) ILIKE ${'%' + role + '%'})
        AND (${state} = '' OR LOWER(COALESCE(pp.state, '')) ILIKE ${'%' + state + '%'})
      ORDER BY ss.total_score DESC
      LIMIT ${limit}
    `) as any[];
    return NextResponse.json(rows);
  } catch (e) {
    console.error("[scout/players]", e);
    return NextResponse.json([]);
  }
}
