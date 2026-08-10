import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { academyForAdmin, isUuid } from "@/lib/session-access";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function text(value: unknown, max: number): string | null {
  const out = String(value ?? "").trim();
  return out ? out.slice(0, max) : null;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "academy_admin") return NextResponse.json({ success: false, error: "Academy admin only" }, { status: 403 });
  const academy = await academyForAdmin((session.user as any).id);
  if (!academy) return NextResponse.json({ success: false, error: "No academy" }, { status: 404 });

  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const batchId = url.searchParams.get("batch_id") ?? "";
  const fromP = ISO_DATE.test(from) ? from : null;
  const toP = ISO_DATE.test(to) ? to : null;
  const batchP = isUuid(batchId) ? batchId : null;
  const sessions = (await sql`
    SELECT s.id, s.batch_id, s.coach_id, s.session_date, s.start_time, s.end_time,
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
      AND (${fromP}::date IS NULL OR s.session_date >= ${fromP}::date)
      AND (${toP}::date IS NULL OR s.session_date <= ${toP}::date)
      AND (${batchP}::uuid IS NULL OR s.batch_id = ${batchP}::uuid)
    GROUP BY s.id, b.batch_name, b.age_group, ac.coach_name
    ORDER BY s.session_date DESC, s.start_time DESC NULLS LAST
  `) as any[];
  return NextResponse.json({ success: true, sessions });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "academy_admin") return NextResponse.json({ success: false, error: "Academy admin only" }, { status: 403 });
  const userId = (session.user as any).id as string;
  const academy = await academyForAdmin(userId);
  if (!academy) return NextResponse.json({ success: false, error: "No academy" }, { status: 404 });
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 }); }

  const sessionDate = String(body.session_date ?? "").trim();
  const batchId = String(body.batch_id ?? "").trim() || null;
  const coachId = String(body.coach_id ?? "").trim() || null;
  const startTime = text(body.start_time, 10);
  const endTime = text(body.end_time, 10);
  if (!ISO_DATE.test(sessionDate)) return NextResponse.json({ success: false, error: "session_date must be YYYY-MM-DD" }, { status: 400 });
  if ((startTime && !TIME.test(startTime)) || (endTime && !TIME.test(endTime))) return NextResponse.json({ success: false, error: "Times must use HH:MM (24-hour)" }, { status: 400 });
  if (batchId && !isUuid(batchId)) return NextResponse.json({ success: false, error: "Invalid batch_id" }, { status: 400 });
  if (coachId && !isUuid(coachId)) return NextResponse.json({ success: false, error: "Invalid coach_id" }, { status: 400 });
  if (batchId) {
    const rows = (await sql`SELECT id FROM batches WHERE id = ${batchId} AND academy_id = ${academy.id} AND batch_status = 'ACTIVE' LIMIT 1`) as any[];
    if (!rows[0]) return NextResponse.json({ success: false, error: "Active batch not found" }, { status: 404 });
  }
  if (coachId) {
    const rows = (await sql`SELECT id FROM academy_coaches WHERE id = ${coachId} AND academy_id = ${academy.id} AND deleted_at IS NULL AND coach_status = 'ACTIVE' LIMIT 1`) as any[];
    if (!rows[0]) return NextResponse.json({ success: false, error: "Active coach not found" }, { status: 404 });
  }
  const rows = (await sql`
    INSERT INTO training_sessions (academy_id, batch_id, coach_id, session_date, start_time, end_time, session_type, venue, title, created_by_user_id)
    VALUES (${academy.id}, ${batchId}, ${coachId}, ${sessionDate}, ${startTime}, ${endTime}, ${text(body.session_type, 40) ?? 'Practice'}, ${text(body.venue, 120)}, ${text(body.title, 160)}, ${userId})
    RETURNING id, academy_id, batch_id, coach_id, session_date, start_time, end_time, session_type, venue, title, created_at
  `) as any[];
  return NextResponse.json({ success: true, session: rows[0] }, { status: 201 });
}
