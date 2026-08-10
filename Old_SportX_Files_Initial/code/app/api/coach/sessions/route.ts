import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { coachMembership } from "@/lib/session-access";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "coach" || (session.user as any).account_status !== "active") return NextResponse.json({ success: false, error: "Active coach role required" }, { status: 403 });
  const coach = await coachMembership((session.user as any).id);
  if (!coach) return NextResponse.json({ success: false, error: "Coach login is not linked to an active academy roster" }, { status: 403 });
  const sessions = (await sql`
    SELECT s.id, s.batch_id, s.session_date, s.start_time, s.end_time, s.session_type, s.venue, s.title,
      b.batch_name, b.age_group,
      COUNT(bp.id)::int AS roster_count,
      COUNT(sa.id) FILTER (WHERE sa.status <> 'UNMARKED')::int AS marked_count
    FROM training_sessions s
    LEFT JOIN batches b ON b.id = s.batch_id
    LEFT JOIN batch_players bp ON bp.batch_id = s.batch_id
    LEFT JOIN session_attendance sa ON sa.session_id = s.id AND sa.player_profile_id = bp.player_profile_id
    WHERE s.coach_id = ${coach.id} AND s.academy_id = ${coach.academy_id}
    GROUP BY s.id, b.batch_name, b.age_group
    ORDER BY s.session_date DESC, s.start_time DESC NULLS LAST
  `) as any[];
  return NextResponse.json({ success: true, sessions });
}
