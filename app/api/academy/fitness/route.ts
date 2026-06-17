import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

/* GET /api/academy/fitness — every fitness assessment for every player in
   the calling admin's academy. Filters: ?search=name&from=YYYY-MM-DD&
   to=YYYY-MM-DD&supervised=1&coach=<id>. The page exports the result as
   CSV client-side so we return everything that matches the filters (no
   server-side pagination). */

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "academy_admin") {
    return NextResponse.json({ success: false, error: "Academy admin only" }, { status: 403 });
  }
  const adminUserId = (session.user as any).id as string;

  const aRows = (await sql`SELECT id FROM academies WHERE user_id = ${adminUserId} LIMIT 1`) as any[];
  if (!aRows[0]) return NextResponse.json({ success: false, error: "No academy" }, { status: 404 });
  const academyId = aRows[0].id;

  const url = new URL(req.url);
  const search = (url.searchParams.get("search") ?? "").trim().toLowerCase();
  const from = (url.searchParams.get("from") ?? "").trim();
  const to   = (url.searchParams.get("to") ?? "").trim();
  const supervised = url.searchParams.get("supervised") === "1";
  const coachId = url.searchParams.get("coach") ?? "";

  /* Coalesce the filter values into nullable params so the WHERE chain
     is purely declarative. */
  const searchP = search ? `%${search}%` : null;
  const fromP = /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : null;
  const toP   = /^\d{4}-\d{2}-\d{2}$/.test(to)   ? to   : null;
  const coachP = coachId || null;

  const rows = (await sql`
    SELECT
      fa.id, fa.assessment_date, fa.yoyo_score, fa.sprint_30m, fa.run_2km,
      fa.notes, fa.is_supervised, fa.assessed_by_coach_id,
      pp.id AS player_id,
      TRIM(COALESCE(pp.first_name, '') || ' ' || COALESCE(pp.last_name, '')) AS player_name,
      pp.user_id AS player_user_id,
      pp.playing_role,
      ac.coach_name, ac.specialization
    FROM player_fitness_assessments fa
    JOIN player_profiles pp ON pp.user_id = fa.user_id
    LEFT JOIN academy_coaches ac ON ac.id = fa.assessed_by_coach_id
    WHERE pp.academy_id = ${academyId}
      AND (${searchP}::text IS NULL OR LOWER(COALESCE(pp.first_name, '') || ' ' || COALESCE(pp.last_name, '')) LIKE ${searchP})
      AND (${fromP}::date  IS NULL OR fa.assessment_date >= ${fromP}::date)
      AND (${toP}::date    IS NULL OR fa.assessment_date <= ${toP}::date)
      AND (${supervised}::boolean = FALSE OR fa.is_supervised = TRUE)
      AND (${coachP}::uuid IS NULL OR fa.assessed_by_coach_id = ${coachP}::uuid)
    ORDER BY fa.assessment_date DESC, fa.created_at DESC
  `) as any[];

  const coaches = (await sql`
    SELECT id, coach_name FROM academy_coaches
    WHERE academy_id = ${academyId} AND deleted_at IS NULL
    ORDER BY coach_name
  `) as any[];

  return NextResponse.json({ success: true, assessments: rows, coaches });
}
