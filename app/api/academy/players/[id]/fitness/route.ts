import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

/* Fitness assessments — multi-row, newest first. is_supervised is auto-set
   from whether assessed_by_coach_id is present (per the spec — never
   exposed to the user as a toggle). */

async function guardOwn(adminUserId: string, profileId: string) {
  const rows = (await sql`
    SELECT pp.user_id, a.id AS academy_id
    FROM player_profiles pp
    JOIN academies a ON a.id = pp.academy_id AND a.user_id = ${adminUserId}
    WHERE pp.id = ${profileId} LIMIT 1
  `) as any[];
  return rows[0] ?? null;
}

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const adminUserId = (session.user as any).id as string;
  const owned = await guardOwn(adminUserId, ctx.params.id);
  if (!owned) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

  const rows = (await sql`
    SELECT a.id, a.assessment_date, a.yoyo_score, a.sprint_30m, a.run_2km, a.notes,
           a.is_supervised, a.assessed_by_coach_id,
           ac.coach_name, ac.specialization
    FROM player_fitness_assessments a
    LEFT JOIN academy_coaches ac ON ac.id = a.assessed_by_coach_id
    WHERE a.user_id = ${owned.user_id}
    ORDER BY a.assessment_date DESC, a.created_at DESC
  `) as any[];

  const coaches = (await sql`
    SELECT id, coach_name, specialization FROM academy_coaches
    WHERE academy_id = ${owned.academy_id}
    ORDER BY coach_name
  `) as any[];

  return NextResponse.json({ success: true, assessments: rows, coaches });
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "academy_admin") {
    return NextResponse.json({ success: false, error: "Academy admin only" }, { status: 403 });
  }
  const adminUserId = (session.user as any).id as string;
  const owned = await guardOwn(adminUserId, ctx.params.id);
  if (!owned) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

  let body: any = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }
  const date = String(body.assessment_date ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ success: false, error: "assessment_date must be YYYY-MM-DD" }, { status: 400 });
  }
  const num = (v: any) => (v === "" || v == null ? null : Number(v));
  const yoyo = num(body.yoyo_score);
  const sprint = num(body.sprint_30m);
  const run = num(body.run_2km);
  const notes = String(body.notes ?? "").trim() || null;
  const coachId = body.assessed_by_coach_id ? String(body.assessed_by_coach_id) : null;
  /* Hard rule: is_supervised is derived from coach presence — never trust
     a client-side flag. */
  const isSupervised = Boolean(coachId);

  /* If a coach_id was provided, double-check it belongs to this academy. */
  if (coachId) {
    const ok = (await sql`SELECT 1 FROM academy_coaches WHERE id = ${coachId} AND academy_id = ${owned.academy_id} LIMIT 1`) as any[];
    if (!ok[0]) return NextResponse.json({ success: false, error: "Coach is not in this academy" }, { status: 400 });
  }

  const inserted = (await sql`
    INSERT INTO player_fitness_assessments
      (user_id, assessment_date, yoyo_score, sprint_30m, run_2km, notes,
       is_supervised, assessed_by_coach_id, created_by_user_id)
    VALUES
      (${owned.user_id}, ${date}, ${yoyo}, ${sprint}, ${run}, ${notes},
       ${isSupervised}, ${coachId}, ${adminUserId})
    RETURNING id
  `) as any[];

  return NextResponse.json({ success: true, id: inserted[0]?.id });
}
