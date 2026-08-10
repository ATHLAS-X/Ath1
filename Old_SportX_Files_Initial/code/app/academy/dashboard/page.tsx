import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import AcademyAdminDashboard from "./AcademyAdminDashboard";

export const dynamic = "force-dynamic";

interface PlayerRow {
  id: string;
  user_id: string | null;
  name: string;
  playing_role: string | null;
  verification_level: number;
  profile_status: string;
  created_at: string;
}

interface SessionSummary {
  today_sessions: number;
  upcoming_sessions: number;
  marked_count: number;
  unmarked_count: number;
  present_count: number;
  absent_count: number;
  late_count: number;
}

export default async function AcademyDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login?from=/academy/dashboard");
  const role = (session.user as any).role;
  /* "Not academy admin" route — the spec asked for /unauthorized but that
     page doesn't exist; route them to their own role's home via /dashboard. */
  if (role !== "academy_admin") redirect("/dashboard");
  const userId = (session.user as any).id as string;

  /* Find the academy this admin owns. */
  const aRows = (await sql`
    SELECT id, academy_name, logo_url, profile_status, city, state
    FROM academies WHERE user_id = ${userId} LIMIT 1
  `) as unknown as any[];
  const academy = aRows[0];
  if (!academy) redirect("/onboarding/academy");

  /* Section 1 — four stats in a single round-trip. */
  const statsRows = (await sql`
    SELECT
      COUNT(*)::int                                             AS total_players,
      COUNT(*) FILTER (WHERE verification_level >= 2)::int      AS verified_players,
      COUNT(*) FILTER (WHERE profile_status = 'Live')::int      AS live_players
    FROM player_profiles WHERE academy_id = ${academy.id}
  `) as unknown as any[];
  const stats = {
    total:    statsRows[0]?.total_players ?? 0,
    verified: statsRows[0]?.verified_players ?? 0,
    live:     statsRows[0]?.live_players ?? 0,
    scoutViews: 0, /* V2 — no scout_views table yet. */
  };

  const sessionRows = (await sql`
    SELECT
      COUNT(*) FILTER (WHERE s.session_date = CURRENT_DATE)::int AS today_sessions,
      COUNT(*) FILTER (WHERE s.session_date > CURRENT_DATE)::int AS upcoming_sessions,
      COUNT(sa.id) FILTER (WHERE sa.status <> 'UNMARKED')::int AS marked_count,
      COUNT(sa.id) FILTER (WHERE sa.status = 'UNMARKED')::int AS unmarked_count,
      COUNT(sa.id) FILTER (WHERE sa.status = 'PRESENT')::int AS present_count,
      COUNT(sa.id) FILTER (WHERE sa.status = 'ABSENT')::int AS absent_count,
      COUNT(sa.id) FILTER (WHERE sa.status = 'LATE')::int AS late_count
    FROM training_sessions s
    LEFT JOIN session_attendance sa ON sa.session_id = s.id
    WHERE s.academy_id = ${academy.id}
      AND s.session_date >= CURRENT_DATE - INTERVAL '30 days'
  `) as unknown as any[];
  const sessionSummary: SessionSummary = {
    today_sessions: sessionRows[0]?.today_sessions ?? 0,
    upcoming_sessions: sessionRows[0]?.upcoming_sessions ?? 0,
    marked_count: sessionRows[0]?.marked_count ?? 0,
    unmarked_count: sessionRows[0]?.unmarked_count ?? 0,
    present_count: sessionRows[0]?.present_count ?? 0,
    absent_count: sessionRows[0]?.absent_count ?? 0,
    late_count: sessionRows[0]?.late_count ?? 0,
  };

  /* Section 3 — last 10 players added. */
  const playerRows = (await sql`
    SELECT pp.id, pp.user_id,
      TRIM(COALESCE(pp.first_name, '') || ' ' || COALESCE(pp.last_name, '')) AS full_name,
      u.name AS user_name,
      pp.playing_role,
      COALESCE(pp.verification_level, 1) AS verification_level,
      COALESCE(pp.profile_status, 'Draft') AS profile_status,
      pp.created_at
    FROM player_profiles pp
    LEFT JOIN users u ON u.id = pp.user_id
    WHERE pp.academy_id = ${academy.id}
    ORDER BY pp.created_at DESC NULLS LAST
    LIMIT 10
  `) as unknown as any[];

  const recentPlayers: PlayerRow[] = playerRows.map((r) => ({
    id:                 r.id,
    user_id:            r.user_id,
    name:               (r.full_name?.trim() || r.user_name || "Player") as string,
    playing_role:       r.playing_role,
    verification_level: Number(r.verification_level ?? 1),
    profile_status:     r.profile_status,
    created_at:         r.created_at,
  }));

  return (
    <AcademyAdminDashboard
      academy={{
        id: academy.id,
        name: academy.academy_name,
        logoUrl: academy.logo_url ?? null,
        profileStatus: academy.profile_status ?? "Draft",
        location: [academy.city, academy.state].filter(Boolean).join(", "),
      }}
      adminName={(session.user as any).name ?? "Admin"}
      adminEmail={(session.user as any).email ?? ""}
      stats={stats}
      sessionSummary={sessionSummary}
      recentPlayers={recentPlayers}
    />
  );
}
