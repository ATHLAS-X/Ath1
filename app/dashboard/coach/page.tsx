import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import CoachDashboardClient from "./CoachDashboardClient";
import type { CoachDashboardData, CoachAssignedPlayer, CoachSubmission } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

async function safeQuery<T>(p: Promise<T>, fallback: T): Promise<T> {
  try { return await p; } catch { return fallback; }
}

/* Real coach identity + a real, academy-matched player roster (no schema
   changes). coach_registry.academy_club is free text, not a foreign key, so
   the academy match below is best-effort (case-insensitive name match
   against academies.academy_name) — if it doesn't match anything real, the
   roster is honestly empty rather than showing fabricated players.

   What's still NOT real, on purpose: fitness_data/behavioral_assessment have
   no recorded_by_user_id column, so "recent submissions" below are real rows
   for this coach's real roster, but not attributable to THIS coach
   specifically (any coach, parent, or the player themself could have
   entered them). Quick Log / Quick Actions stay as the existing honest
   "not built yet" message — there's nowhere real to attach a coach-authored
   submission until that column exists. */
export default async function CoachDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login?from=/dashboard/coach");
  if ((session.user as any).role !== "coach") redirect("/dashboard");
  const userId = (session.user as any).id as string;

  const coachRows = await safeQuery(
    sql`SELECT coach_name, coach_status, academy_club FROM coach_registry WHERE user_id = ${userId} LIMIT 1` as unknown as Promise<any[]>,
    [] as any[],
  );
  const coach = coachRows[0];
  if (!coach) redirect("/onboarding/coach");

  const coachName = coach.coach_name ?? session.user.name ?? "Coach";
  const coachStatus = String(coach.coach_status ?? "PENDING_REVIEW").toUpperCase();
  const academyClub = coach.academy_club as string | null;

  const academyRows = academyClub
    ? await safeQuery(
        sql`SELECT id, academy_name FROM academies WHERE academy_name ILIKE ${academyClub} LIMIT 1` as unknown as Promise<any[]>,
        [] as any[],
      )
    : [];
  const academy = academyRows[0] ?? null;
  const academyName: string | null = academy?.academy_name ?? academyClub ?? null;
  const canSubmit = coachStatus === "APPROVED" && !!academy;

  const playerRows = academy
    ? await safeQuery(
        sql`
          SELECT u.id AS user_id, u.name,
            COALESCE(cp.player_role, pp.playing_role, 'Player') AS playing_role,
            EXTRACT(YEAR FROM AGE(pp.date_of_birth))::int AS age,
            COALESCE(pp.city, '') AS city,
            COALESCE(pp.state, '') AS state,
            COALESCE(pp.verification_level, 1) AS verification_level,
            fd.yoyo_level, fd.created_at AS fitness_at,
            ba.created_at AS eval_at
          FROM player_profiles pp
          JOIN users u ON u.id = pp.user_id
          LEFT JOIN cricket_profile cp ON cp.user_id = u.id
          LEFT JOIN LATERAL (
            SELECT yoyo_level, created_at FROM fitness_data WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1
          ) fd ON true
          LEFT JOIN LATERAL (
            SELECT created_at FROM behavioral_assessment WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1
          ) ba ON true
          WHERE pp.academy_id = ${academy.id}
          ORDER BY u.name
          LIMIT 50
        ` as unknown as Promise<any[]>,
        [] as any[],
      )
    : [];

  const assigned_players: CoachAssignedPlayer[] = playerRows.map((p) => ({
    user_id: p.user_id,
    name: p.name,
    playing_role: p.playing_role,
    age: p.age ?? null,
    city: p.city,
    state: p.state,
    academy_name: academyName ?? "",
    verification_level: p.verification_level,
    profile_pct: 0,
    latest_yoyo: p.yoyo_level != null ? Number(p.yoyo_level) : null,
    pending_action: !p.fitness_at ? "fitness" : !p.eval_at ? "behaviour" : null,
    last_assessment_at: p.fitness_at ?? p.eval_at ?? null,
  }));

  const playerIds = playerRows.map((p) => p.user_id);
  let recent_submissions: CoachSubmission[] = [];
  if (playerIds.length > 0) {
    const subRows = await safeQuery(
      sql`
        SELECT player_user_id, player_name, kind, summary, submitted_at FROM (
          SELECT fd.user_id AS player_user_id, u.name AS player_name, 'fitness' AS kind,
            ('YoYo ' || COALESCE(fd.yoyo_level::text, '—')) AS summary, fd.created_at AS submitted_at
          FROM fitness_data fd JOIN users u ON u.id = fd.user_id
          WHERE fd.user_id = ANY(${playerIds})
          UNION ALL
          SELECT ba.user_id, u.name, 'behaviour',
            ('Mindset score ' || COALESCE(ba.mindset_score::text, '—')),
            ba.created_at
          FROM behavioral_assessment ba JOIN users u ON u.id = ba.user_id
          WHERE ba.user_id = ANY(${playerIds})
        ) sub
        ORDER BY submitted_at DESC LIMIT 8
      ` as unknown as Promise<any[]>,
      [] as any[],
    );
    recent_submissions = subRows.map((r, i) => ({
      id: String(i),
      player_user_id: r.player_user_id,
      player_name: r.player_name,
      kind: r.kind,
      summary: r.summary,
      submitted_at: r.submitted_at,
    }));
  }

  const now = Date.now();
  const data: CoachDashboardData = {
    coach_name: coachName,
    coach_status: coachStatus as CoachDashboardData["coach_status"],
    academy_name: academyName,
    can_submit_fitness: canSubmit,
    counts: {
      assigned: assigned_players.length,
      pending_fitness: assigned_players.filter((p) => p.pending_action === "fitness").length,
      pending_behaviour: assigned_players.filter((p) => p.pending_action === "behaviour").length,
      submissions_30d: recent_submissions.filter((s) => now - new Date(s.submitted_at).getTime() < 30 * 86_400_000).length,
    },
    assigned_players,
    recent_submissions,
  };

  return <CoachDashboardClient data={data} />;
}
