import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

const AGE_GROUPS = new Set(["U-10", "U-13", "U-17", "Senior", "Open"]);
const DAYS = new Set(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);

async function getAcademyId(userId: string): Promise<string | null> {
  const rows = (await sql`SELECT id FROM academies WHERE user_id = ${userId} LIMIT 1`) as any[];
  return rows[0]?.id ?? null;
}

/* GET — list all active batches with coach name + player count */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "academy_admin") {
    return NextResponse.json({ success: false, error: "Academy admins only" }, { status: 403 });
  }
  const userId = (session.user as any).id as string;
  const academyId = await getAcademyId(userId);
  if (!academyId) return NextResponse.json({ success: false, error: "Set up your academy first" }, { status: 400 });

  const rows = (await sql`
    SELECT
      b.id, b.batch_name, b.age_group, b.schedule_days, b.schedule_time,
      b.max_players, b.batch_status, b.created_at,
      b.coach_id,
      ac.coach_name,
      ac.specialization AS coach_specialization,
      COUNT(bp.id)::int AS player_count
    FROM batches b
    LEFT JOIN academy_coaches ac ON ac.id = b.coach_id AND ac.deleted_at IS NULL
    LEFT JOIN batch_players bp ON bp.batch_id = b.id
    WHERE b.academy_id = ${academyId} AND b.batch_status != 'DELETED'
    GROUP BY b.id, ac.coach_name, ac.specialization
    ORDER BY b.created_at DESC
  `) as any[];

  return NextResponse.json({ success: true, batches: rows });
}

/* POST — create a new batch */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "academy_admin") {
    return NextResponse.json({ success: false, error: "Academy admins only" }, { status: 403 });
  }
  const userId = (session.user as any).id as string;
  const academyId = await getAcademyId(userId);
  if (!academyId) return NextResponse.json({ success: false, error: "Set up your academy first" }, { status: 400 });

  let body: any = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const name = String(body.batch_name ?? "").trim();
  if (!name) return NextResponse.json({ success: false, error: "Batch name is required" }, { status: 400 });

  const ageGroup = String(body.age_group ?? "").trim() || null;
  if (ageGroup && !AGE_GROUPS.has(ageGroup)) {
    return NextResponse.json({ success: false, error: `age_group must be one of: ${[...AGE_GROUPS].join(", ")}` }, { status: 400 });
  }

  const scheduleDays: string[] = Array.isArray(body.schedule_days)
    ? body.schedule_days.map(String).filter((d: string) => DAYS.has(d))
    : [];

  const scheduleTime = String(body.schedule_time ?? "").trim() || null;
  const maxPlayers = body.max_players ? Number(body.max_players) : null;
  const coachId = String(body.coach_id ?? "").trim() || null;

  if (coachId) {
    const coachRows = (await sql`
      SELECT id FROM academy_coaches
      WHERE id = ${coachId} AND academy_id = ${academyId} AND deleted_at IS NULL
    `) as any[];
    if (!coachRows[0]) return NextResponse.json({ success: false, error: "Coach not found" }, { status: 404 });
  }

  const inserted = (await sql`
    INSERT INTO batches
      (academy_id, coach_id, batch_name, age_group, schedule_days, schedule_time, max_players, created_by_user_id)
    VALUES
      (${academyId}, ${coachId}, ${name}, ${ageGroup}, ${scheduleDays}, ${scheduleTime}, ${maxPlayers}, ${userId})
    RETURNING id, batch_name, age_group, batch_status, created_at
  `) as any[];

  return NextResponse.json({ success: true, batch: inserted[0] }, { status: 201 });
}
