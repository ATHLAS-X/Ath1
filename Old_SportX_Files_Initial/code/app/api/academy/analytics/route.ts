import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try { return await p; } catch { return fallback; }
}

/* GET /api/academy/analytics
   Returns all data needed for the academy analytics dashboard:
   - players_by_role       : donut chart — BAT / BOWL / AR / WK counts
   - players_by_batch      : bar chart  — player count per batch
   - score_distribution    : histogram  — AthlasX score buckets (0-20, 21-40, …)
   - top_batsmen           : leaderboard — top 5 by total runs from match_logs
   - top_bowlers           : leaderboard — top 5 by total wickets from match_logs
   - fitness_summary       : avg yoyo, sprint, fitness_score across academy
   - monthly_matches       : line chart — matches logged per month (last 6 months)
*/
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "academy_admin") {
    return NextResponse.json({ success: false, error: "Academy admins only" }, { status: 403 });
  }
  const adminId = (session.user as any).id as string;

  const aRows = (await safe(
    sql`SELECT id FROM academies WHERE user_id = ${adminId} LIMIT 1` as unknown as Promise<any[]>,
    [] as any[],
  )) as any[];
  if (!aRows[0]) return NextResponse.json({ success: false, error: "Set up your academy first" }, { status: 400 });
  const academyId = aRows[0].id as string;

  const [
    roleRows,
    batchRows,
    scoreRows,
    topBatsmenRows,
    topBowlersRows,
    fitnessRows,
    monthlyRows,
  ] = await Promise.all([

    /* players by role */
    safe(sql`
      SELECT
        COALESCE(playing_role, 'Unknown') AS role,
        COUNT(*)::int AS count
      FROM player_profiles
      WHERE academy_id = ${academyId}
      GROUP BY playing_role
      ORDER BY count DESC
    ` as unknown as Promise<any[]>, [] as any[]),

    /* players per batch */
    safe(sql`
      SELECT
        b.batch_name,
        b.age_group,
        COUNT(bp.player_profile_id)::int AS player_count
      FROM batches b
      LEFT JOIN batch_players bp ON bp.batch_id = b.id
      WHERE b.academy_id = ${academyId} AND b.batch_status = 'ACTIVE'
      GROUP BY b.id, b.batch_name, b.age_group
      ORDER BY player_count DESC
    ` as unknown as Promise<any[]>, [] as any[]),

    /* AthlasX score distribution in buckets of 20 */
    safe(sql`
      SELECT
        CASE
          WHEN ax.total_score BETWEEN 0  AND 20 THEN '0-20'
          WHEN ax.total_score BETWEEN 21 AND 40 THEN '21-40'
          WHEN ax.total_score BETWEEN 41 AND 60 THEN '41-60'
          WHEN ax.total_score BETWEEN 61 AND 80 THEN '61-80'
          WHEN ax.total_score BETWEEN 81 AND 100 THEN '81-100'
          ELSE 'Unscored'
        END AS bucket,
        COUNT(*)::int AS count
      FROM player_profiles pp
      LEFT JOIN athlasx_score ax ON ax.user_id = pp.user_id
      WHERE pp.academy_id = ${academyId}
      GROUP BY bucket
      ORDER BY bucket
    ` as unknown as Promise<any[]>, [] as any[]),

    /* top 5 batsmen by total runs in match_logs */
    safe(sql`
      SELECT
        pp.first_name || ' ' || pp.last_name AS name,
        pp.playing_role AS role,
        SUM(ml.runs_scored)::int AS total_runs,
        COUNT(ml.id)::int AS matches
      FROM player_profiles pp
      JOIN match_logs ml ON ml.user_id = pp.user_id
      WHERE pp.academy_id = ${academyId} AND ml.runs_scored IS NOT NULL
      GROUP BY pp.user_id, pp.first_name, pp.last_name, pp.playing_role
      ORDER BY total_runs DESC
      LIMIT 5
    ` as unknown as Promise<any[]>, [] as any[]),

    /* top 5 bowlers by total wickets in match_logs */
    safe(sql`
      SELECT
        pp.first_name || ' ' || pp.last_name AS name,
        pp.playing_role AS role,
        SUM(ml.wickets_taken)::int AS total_wickets,
        COUNT(ml.id)::int AS matches
      FROM player_profiles pp
      JOIN match_logs ml ON ml.user_id = pp.user_id
      WHERE pp.academy_id = ${academyId} AND ml.wickets_taken IS NOT NULL
      GROUP BY pp.user_id, pp.first_name, pp.last_name, pp.playing_role
      ORDER BY total_wickets DESC
      LIMIT 5
    ` as unknown as Promise<any[]>, [] as any[]),

    /* fitness averages across academy */
    safe(sql`
      SELECT
        ROUND(AVG(fd.yoyo_level)::numeric, 1)::float    AS avg_yoyo,
        ROUND(AVG(fd.sprint_time)::numeric, 2)::float   AS avg_sprint,
        ROUND(AVG(fd.fitness_score)::numeric, 1)::float AS avg_fitness_score,
        ROUND(AVG(fd.bmi)::numeric, 1)::float           AS avg_bmi,
        COUNT(fd.id)::int                               AS assessed_count
      FROM fitness_data fd
      JOIN player_profiles pp ON pp.user_id = fd.user_id
      WHERE pp.academy_id = ${academyId}
    ` as unknown as Promise<any[]>, [{ avg_yoyo: 0, avg_sprint: 0, avg_fitness_score: 0, avg_bmi: 0, assessed_count: 0 }] as any[]),

    /* matches logged per month — last 6 months */
    safe(sql`
      SELECT
        TO_CHAR(ml.match_date, 'Mon YYYY') AS month,
        DATE_TRUNC('month', ml.match_date) AS month_start,
        COUNT(ml.id)::int AS match_count
      FROM match_logs ml
      JOIN player_profiles pp ON pp.user_id = ml.user_id
      WHERE pp.academy_id = ${academyId}
        AND ml.match_date >= NOW() - INTERVAL '6 months'
      GROUP BY month, month_start
      ORDER BY month_start ASC
    ` as unknown as Promise<any[]>, [] as any[]),
  ]);

  return NextResponse.json({
    success: true,
    players_by_role:    roleRows,
    players_by_batch:   batchRows,
    score_distribution: scoreRows,
    top_batsmen:        topBatsmenRows,
    top_bowlers:        topBowlersRows,
    fitness_summary:    (fitnessRows as any[])[0] ?? {},
    monthly_matches:    monthlyRows,
  });
}
