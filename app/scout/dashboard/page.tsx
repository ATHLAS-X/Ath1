import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import ScoutDashboardClient from "./ScoutDashboardClient";

async function safeQuery<T>(p: Promise<T>, fallback: T): Promise<T> {
  try { return await p; } catch { return fallback; }
}


export default async function ScoutDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login");
  if ((session.user as any).role !== "scout") redirect("/dashboard");
  const scoutId = (session.user as any).id;

  const [featuredRows, playerRows, shortlistRows, noteRows, inviteRows] = await Promise.all([
    safeQuery(sql`
      SELECT u.id AS user_id, u.name,
        COALESCE(cp.player_role, pp.playing_role, 'Player') AS playing_role,
        COALESCE(pp.city, '') AS city,
        COALESCE(pp.state, '') AS state,
        COALESCE(ac.academy_name, '') AS academy_name_custom,
        COALESCE(pp.verification_level, 1) AS verification_level,
        EXTRACT(YEAR FROM AGE(pp.date_of_birth))::int AS age,
        ss.total_score, ss.coach_verified,
        COALESCE(ps.bpi, 0) AS bpi,
        COALESCE(ps.matches, 0) AS matches_played,
        COALESCE(ps.runs, 0) AS runs_scored,
        COALESCE(ps.wickets, 0) AS wickets,
        COALESCE(ps.economy, 0) AS economy,
        (CASE WHEN pp.date_of_birth IS NOT NULL THEN 15 ELSE 0 END)
          + (CASE WHEN COALESCE(pp.state, '') <> '' THEN 10 ELSE 0 END)
          + (CASE WHEN pp.academy_id IS NOT NULL THEN 10 ELSE 0 END)
          + (CASE WHEN cp.player_role IS NOT NULL OR pp.playing_role IS NOT NULL THEN 15 ELSE 0 END)
          + (CASE WHEN ps.user_id IS NOT NULL THEN 25 ELSE 0 END)
          + (CASE WHEN ss.coach_verified THEN 15 ELSE 0 END)
          + 10 AS profile_pct
      FROM sportx_score ss
      JOIN users u ON ss.user_id = u.id
      LEFT JOIN cricket_profile cp ON u.id = cp.user_id
      LEFT JOIN player_profiles pp ON u.id = pp.user_id
      LEFT JOIN performance_stats ps ON u.id = ps.user_id AND ps.format = 'T20'
      LEFT JOIN academies ac ON pp.academy_id = ac.id
      WHERE ss.total_score > 60
      ORDER BY ss.total_score DESC LIMIT 1
    ` as unknown as Promise<any[]>, [] as any[]),

    safeQuery(sql`
      SELECT u.id AS user_id, u.name,
        COALESCE(pp.city, pp.district, '') AS city,
        COALESCE(pp.state, '') AS state,
        COALESCE(ac.academy_name, '') AS academy_name_custom,
        COALESCE(cp.player_role, pp.playing_role, 'Player') AS playing_role,
        COALESCE(pp.verification_level, 1) AS verification_level,
        EXTRACT(YEAR FROM AGE(pp.date_of_birth))::int AS age,
        ss.total_score, ss.coach_verified,
        COALESCE(ps.bpi, 0) AS bpi,
        (CASE WHEN pp.date_of_birth IS NOT NULL THEN 15 ELSE 0 END)
          + (CASE WHEN COALESCE(pp.state, '') <> '' THEN 10 ELSE 0 END)
          + (CASE WHEN pp.academy_id IS NOT NULL THEN 10 ELSE 0 END)
          + (CASE WHEN cp.player_role IS NOT NULL OR pp.playing_role IS NOT NULL THEN 15 ELSE 0 END)
          + (CASE WHEN ps.user_id IS NOT NULL THEN 25 ELSE 0 END)
          + (CASE WHEN ss.coach_verified THEN 15 ELSE 0 END)
          + 10 AS profile_pct
      FROM sportx_score ss
      JOIN users u ON ss.user_id = u.id
      LEFT JOIN cricket_profile cp ON u.id = cp.user_id
      LEFT JOIN player_profiles pp ON u.id = pp.user_id
      LEFT JOIN performance_stats ps ON u.id = ps.user_id AND ps.format = 'T20'
      LEFT JOIN academies ac ON pp.academy_id = ac.id
      ORDER BY ss.total_score DESC LIMIT 8
    ` as unknown as Promise<any[]>, [] as any[]),

    safeQuery(sql`
      SELECT player_user_id FROM scout_shortlist
      WHERE scout_user_id = ${scoutId}
    ` as unknown as Promise<any[]>, [] as any[]),

    safeQuery(sql`
      SELECT sn.player_user_id, sn.updated_at, u.name AS player_name
      FROM scout_notes sn
      JOIN users u ON sn.player_user_id = u.id
      WHERE sn.scout_user_id = ${scoutId}
      ORDER BY sn.updated_at DESC LIMIT 3
    ` as unknown as Promise<any[]>, [] as any[]),

    safeQuery(sql`
      SELECT ti.id, ti.status
      FROM scout_trial_invites ti
      WHERE ti.scout_user_id = ${scoutId}
    ` as unknown as Promise<any[]>, [] as any[]),
  ]);

  const invites = inviteRows as any[];

  return (
    <ScoutDashboardClient
      session={session}
      featuredPlayer={(featuredRows as any[])[0] ?? null}
      players={playerRows as any[]}
      shortlistIds={(shortlistRows as any[]).map((r) => String(r.player_user_id))}
      recentNotes={noteRows as any[]}
      watchlist={{
        shortlist: (shortlistRows as any[]).length,
        notes: (noteRows as any[]).length,
        invites: invites.length,
        accepted: invites.filter((i) => i.status === "Accepted").length,
      }}
    />
  );
}
