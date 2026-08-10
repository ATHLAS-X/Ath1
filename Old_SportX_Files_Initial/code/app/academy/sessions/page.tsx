import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import AcademySessionsClient from "./AcademySessionsClient";

export const dynamic = "force-dynamic";

export default async function AcademySessionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login?from=/academy/sessions");
  if ((session.user as any).role !== "academy_admin") redirect("/dashboard");
  const userId = (session.user as any).id as string;

  const academyRows = (await sql`
    SELECT id, academy_name, logo_url
    FROM academies
    WHERE user_id = ${userId}
    LIMIT 1
  `) as any[];
  const academy = academyRows[0];
  if (!academy) redirect("/onboarding/academy");

  const batches = (await sql`
    SELECT id, batch_name, age_group
    FROM batches
    WHERE academy_id = ${academy.id} AND batch_status = 'ACTIVE'
    ORDER BY batch_name
  `) as any[];

  const coaches = (await sql`
    SELECT id, coach_name
    FROM academy_coaches
    WHERE academy_id = ${academy.id} AND deleted_at IS NULL AND coach_status = 'ACTIVE'
    ORDER BY coach_name
  `) as any[];

  const sessions = (await sql`
    SELECT
      s.id, s.batch_id, s.coach_id, s.session_date, s.start_time, s.end_time,
      s.session_type, s.venue, s.title, s.created_at,
      b.batch_name, b.age_group, ac.coach_name,
      COUNT(sa.id)::int AS attendance_count,
      COUNT(sa.id) FILTER (WHERE sa.status = 'PRESENT')::int AS present_count,
      COUNT(sa.id) FILTER (WHERE sa.status = 'ABSENT')::int AS absent_count,
      COUNT(sa.id) FILTER (WHERE sa.status = 'LATE')::int AS late_count
    FROM training_sessions s
    LEFT JOIN batches b ON b.id = s.batch_id
    LEFT JOIN academy_coaches ac ON ac.id = s.coach_id
    LEFT JOIN session_attendance sa ON sa.session_id = s.id
    WHERE s.academy_id = ${academy.id}
    GROUP BY s.id, b.batch_name, b.age_group, ac.coach_name
    ORDER BY s.session_date DESC, s.start_time DESC NULLS LAST, s.created_at DESC
  `) as any[];

  return (
    <AcademySessionsClient
      academy={{
        id: academy.id,
        name: academy.academy_name,
        logoUrl: academy.logo_url ?? null,
      }}
      adminName={(session.user as any).name ?? "Admin"}
      adminEmail={(session.user as any).email ?? ""}
      batches={batches}
      coaches={coaches}
      initialSessions={sessions}
    />
  );
}
