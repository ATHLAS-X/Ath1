import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try { return await p; } catch { return fallback; }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "academy_admin") {
    return NextResponse.json({ success: false, error: "Academy admins only" }, { status: 403 });
  }
  const adminId = (session.user as any).id as string;

  const aRows = (await safe(
    sql`SELECT id, academy_name FROM academies WHERE user_id = ${adminId} LIMIT 1` as unknown as Promise<any[]>,
    [] as any[],
  )) as any[];
  const academy = aRows[0];
  if (!academy) {
    return NextResponse.json({ success: false, error: "Set up your academy profile first" }, { status: 400 });
  }
  const academyId = academy.id as string;

  const [
    countsRows, viewsRows, savesRows, invitesRows,
    fitnessRows, behavRows, topRows, recentRows,
  ] = await Promise.all([
    safe(sql`
      SELECT
        COUNT(*)::int AS total_players,
        COUNT(*) FILTER (WHERE pp.user_id IS NOT NULL)::int AS active_players,
        COUNT(*) FILTER (WHERE COALESCE(ss.coach_verified, false) = true)::int AS verified_players
      FROM player_profiles pp
      LEFT JOIN sportx_score ss ON ss.user_id = pp.user_id
      WHERE pp.academy_id = ${academyId}
    ` as unknown as Promise<any[]>, [{ total_players: 0, active_players: 0, verified_players: 0 }] as any[]),

    safe(sql`
      SELECT COUNT(*)::int AS cnt FROM scout_views sv
      JOIN player_profiles pp ON pp.user_id = sv.player_user_id
      WHERE pp.academy_id = ${academyId}
        AND sv.viewed_at >= NOW() - INTERVAL '30 days'
    ` as unknown as Promise<any[]>, [{ cnt: 0 }] as any[]),

    safe(sql`
      SELECT COUNT(*)::int AS cnt FROM scout_shortlist ss
      JOIN player_profiles pp ON pp.user_id = ss.player_user_id
      WHERE pp.academy_id = ${academyId}
    ` as unknown as Promise<any[]>, [{ cnt: 0 }] as any[]),

    safe(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'Claimed')::int AS claimed,
        COUNT(*) FILTER (WHERE status IN ('Pending','Sent'))::int AS pending
      FROM player_invites WHERE academy_id = ${academyId}
    ` as unknown as Promise<any[]>, [{ total: 0, claimed: 0, pending: 0 }] as any[]),

    safe(sql`
      SELECT
        AVG(NULLIF(fd.yoyo_level, 0))::float AS avg_yoyo,
        AVG(NULLIF(fd.sprint_time, 0))::float AS avg_sprint,
        AVG(NULLIF(fd.fitness_score, 0))::float AS avg_fitness_score
      FROM fitness_data fd
      JOIN player_profiles pp ON pp.user_id = fd.user_id
      WHERE pp.academy_id = ${academyId}
    ` as unknown as Promise<any[]>, [{ avg_yoyo: 0, avg_sprint: 0, avg_fitness_score: 0 }] as any[]),

    safe(sql`
      SELECT
        AVG(NULLIF(ba.mindset_score, 0))::float AS avg_mindset
      FROM behavioral_assessment ba
      JOIN player_profiles pp ON pp.user_id = ba.user_id
      WHERE pp.academy_id = ${academyId}
    ` as unknown as Promise<any[]>, [{ avg_mindset: 0 }] as any[]),

    safe(sql`
      SELECT
        pp.user_id, pp.first_name, pp.last_name, pp.playing_role,
        ss.total_score, ss.coach_verified
      FROM player_profiles pp
      JOIN sportx_score ss ON ss.user_id = pp.user_id
      WHERE pp.academy_id = ${academyId}
      ORDER BY ss.total_score DESC NULLS LAST
      LIMIT 5
    ` as unknown as Promise<any[]>, [] as any[]),

    safe(sql`
      SELECT
        pp.user_id, pp.id AS player_profile_id,
        COALESCE(pp.first_name || ' ' || pp.last_name, 'Player') AS name,
        pp.profile_status, pp.created_at, pp.claimed_at
      FROM player_profiles pp
      WHERE pp.academy_id = ${academyId}
      ORDER BY pp.created_at DESC
      LIMIT 8
    ` as unknown as Promise<any[]>, [] as any[]),
  ]);

  return NextResponse.json({
    academy_name: academy.academy_name,
    counts: (countsRows as any[])[0] ?? {},
    scout_views_30d: (viewsRows as any[])[0]?.cnt ?? 0,
    scout_saves:     (savesRows as any[])[0]?.cnt ?? 0,
    invites:         (invitesRows as any[])[0] ?? {},
    fitness:         (fitnessRows as any[])[0] ?? {},
    behavioural:     (behavRows as any[])[0] ?? {},
    top_performers:  topRows as any[],
    recent_players:  recentRows as any[],
  });
}
