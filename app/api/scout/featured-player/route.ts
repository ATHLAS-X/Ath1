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
            COALESCE(cp.player_role, pp.playing_role, 'Player') AS playing_role,
            COALESCE(pp.city, '') AS city,
            COALESCE(pp.state, '') AS state,
            COALESCE(pp.district, '') AS district,
            COALESCE(ac.academy_name, '') AS academy_name_custom,
            ss.total_score,
            ss.coach_verified,
            COALESCE(ps.bpi, 0) AS bpi,
            COALESCE(ps.matches, 0) AS matches_played,
            COALESCE(ps.runs, 0) AS runs_scored,
            COALESCE(ps.wickets, 0) AS wickets,
            COALESCE(ps.economy, 0) AS economy,
            COALESCE(ps.innings, 0) AS innings,
            COALESCE(ps.highest_score, '0') AS highest_score,
            pp.avatar_url
          FROM athlasx_score ss
          JOIN users u ON ss.user_id = u.id
          LEFT JOIN cricket_profile cp ON u.id = cp.user_id
          LEFT JOIN player_profiles pp ON u.id = pp.user_id
          LEFT JOIN performance_stats ps ON u.id = ps.user_id AND ps.format = 'T20'
          LEFT JOIN academies ac ON pp.academy_id = ac.id
          WHERE ss.total_score > 60
          ORDER BY ss.total_score DESC
          LIMIT 1
        `) as any[])
      : ((await sql`
          SELECT
            u.id AS user_id,
            u.name,
            COALESCE(cp.player_role, pp.playing_role, 'Player') AS playing_role,
            COALESCE(pp.city, '') AS city,
            COALESCE(pp.state, '') AS state,
            COALESCE(pp.district, '') AS district,
            COALESCE(ac.academy_name, '') AS academy_name_custom,
            ss.total_score,
            ss.coach_verified,
            COALESCE(ps.bpi, 0) AS bpi,
            COALESCE(ps.matches, 0) AS matches_played,
            COALESCE(ps.runs, 0) AS runs_scored,
            COALESCE(ps.wickets, 0) AS wickets,
            COALESCE(ps.economy, 0) AS economy,
            COALESCE(ps.innings, 0) AS innings,
            COALESCE(ps.highest_score, '0') AS highest_score,
            pp.avatar_url
          FROM athlasx_score ss
          JOIN users u ON ss.user_id = u.id
          LEFT JOIN cricket_profile cp ON u.id = cp.user_id
          JOIN player_profiles pp ON u.id = pp.user_id
          LEFT JOIN performance_stats ps ON u.id = ps.user_id AND ps.format = 'T20'
          LEFT JOIN academies ac ON pp.academy_id = ac.id
          WHERE ss.total_score > 60 AND pp.visibility = ${VISIBLE_STATUS}
          ORDER BY ss.total_score DESC
          LIMIT 1
        `) as any[]);
    if (!rows.length) return NextResponse.json(null);
    return NextResponse.json(rows[0]);
  } catch (e) {
    console.error("[featured-player]", e);
    return NextResponse.json(null);
  }
}