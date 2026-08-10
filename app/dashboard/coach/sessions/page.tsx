import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { coachMembership } from "@/lib/session-access";
import CoachSessionsClient from "./CoachSessionsClient";

export const dynamic = "force-dynamic";

export default async function CoachSessionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login?from=/dashboard/coach/sessions");
  if ((session.user as any).role !== "coach" || (session.user as any).account_status !== "active") redirect("/dashboard");

  const coach = await coachMembership((session.user as any).id);
  if (!coach) redirect("/onboarding/coach");

  const academyRows = (await sql`
    SELECT academy_name, logo_url
    FROM academies
    WHERE id = ${coach.academy_id}
    LIMIT 1
  `) as any[];
  const academy = academyRows[0] ?? null;

  const sessions = (await sql`
    SELECT
      s.id, s.batch_id, s.coach_id, s.session_date, s.start_time, s.end_time,
      s.session_type, s.venue, s.title, s.created_at,
      b.batch_name, b.age_group,
      COUNT(bp.id)::int AS roster_count,
      COUNT(sa.id) FILTER (WHERE sa.status <> 'UNMARKED')::int AS marked_count,
      COUNT(sa.id) FILTER (WHERE sa.status = 'PRESENT')::int AS present_count,
      COUNT(sa.id) FILTER (WHERE sa.status = 'ABSENT')::int AS absent_count,
      COUNT(sa.id) FILTER (WHERE sa.status = 'LATE')::int AS late_count
    FROM training_sessions s
    LEFT JOIN batches b ON b.id = s.batch_id
    LEFT JOIN batch_players bp ON bp.batch_id = s.batch_id
    LEFT JOIN session_attendance sa ON sa.session_id = s.id AND sa.player_profile_id = bp.player_profile_id
    WHERE s.coach_id = ${coach.id} AND s.academy_id = ${coach.academy_id}
    GROUP BY s.id, b.batch_name, b.age_group
    ORDER BY s.session_date DESC, s.start_time DESC NULLS LAST, s.created_at DESC
  `) as any[];

  return (
    <CoachSessionsClient
      coach={{ coachId: coach.id, coachName: coach.coach_name, academyName: academy?.academy_name ?? "Academy", logoUrl: academy?.logo_url ?? null }}
      initialSessions={sessions}
    />
  );
}
