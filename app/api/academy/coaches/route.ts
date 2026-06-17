import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

const SPECIALIZATIONS = new Set([
  "Batting",
  "Bowling",
  "Fitness",
  "Wicketkeeping",
  "Mental Conditioning",
]);

/* GET — list coaches for this academy (used by the wizard's final summary
   and the academy dashboard).
   POST — add one coach. Permission flags default OFF. */

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "academy_admin") {
    return NextResponse.json({ success: false, error: "Academy admin only" }, { status: 403 });
  }
  const userId = (session.user as any).id as string;

  /* Pull live coaches (deleted_at IS NULL) with the count of fitness
     assessments each one has on file — the Remove action needs this. */
  const rows = (await sql`
    SELECT c.id, c.coach_name, c.specialization, c.years_experience,
           c.certifications, c.can_submit_fitness, c.can_submit_evaluations,
           c.coach_status, c.created_at,
           COALESCE(fa.n, 0) AS assessment_count
    FROM academy_coaches c
    JOIN academies a ON a.id = c.academy_id
    LEFT JOIN (
      SELECT assessed_by_coach_id, COUNT(*)::int AS n
      FROM player_fitness_assessments
      GROUP BY assessed_by_coach_id
    ) fa ON fa.assessed_by_coach_id = c.id
    WHERE a.user_id = ${userId} AND c.deleted_at IS NULL
    ORDER BY c.created_at DESC
  `) as any[];
  return NextResponse.json({ success: true, coaches: rows });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "academy_admin") {
    return NextResponse.json({ success: false, error: "Academy admin only" }, { status: 403 });
  }
  const userId = (session.user as any).id as string;

  let body: any = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }
  const name = String(body.coach_name ?? "").trim();
  const specialization = String(body.specialization ?? "").trim();
  const yearsRaw = body.years_experience;
  const certs = String(body.certifications ?? "").trim() || null;
  const canFitness = Boolean(body.can_submit_fitness);
  const canEval = Boolean(body.can_submit_evaluations);

  if (!name) return NextResponse.json({ success: false, error: "Coach name is required" }, { status: 400 });
  if (specialization && !SPECIALIZATIONS.has(specialization)) {
    return NextResponse.json({ success: false, error: "Invalid specialization" }, { status: 400 });
  }
  const years = yearsRaw === "" || yearsRaw == null ? null : Number(yearsRaw);
  if (years != null && (!Number.isFinite(years) || years < 0 || years > 80)) {
    return NextResponse.json({ success: false, error: "Years of experience must be 0–80" }, { status: 400 });
  }

  const aRows = (await sql`SELECT id FROM academies WHERE user_id = ${userId} LIMIT 1`) as any[];
  if (!aRows[0]) {
    return NextResponse.json({ success: false, error: "Set up your academy first" }, { status: 400 });
  }
  const academyId = aRows[0].id;

  const inserted = (await sql`
    INSERT INTO academy_coaches
      (academy_id, coach_name, specialization, years_experience, certifications,
       can_submit_fitness, can_submit_evaluations, created_by_user_id)
    VALUES
      (${academyId}, ${name}, ${specialization || null}, ${years}, ${certs},
       ${canFitness}, ${canEval}, ${userId})
    RETURNING id, coach_name
  `) as any[];

  return NextResponse.json({ success: true, coach: inserted[0] });
}
