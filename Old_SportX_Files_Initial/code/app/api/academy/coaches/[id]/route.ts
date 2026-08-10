import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

/* PUT /api/academy/coaches/:id  — edit fields (name, specialization,
   years, certifications, both permission flags).
   DELETE — soft delete by stamping deleted_at. Refuses if the coach has
   any fitness assessments on file (the spec's hard rule). */

const SPECIALIZATIONS = new Set([
  "Batting", "Bowling", "Fitness", "Wicketkeeping", "Mental Conditioning",
]);

const TEXT_FIELDS = new Set(["coach_name", "specialization", "certifications"]);
const NUM_FIELDS  = new Set(["years_experience"]);
const BOOL_FIELDS = new Set(["can_submit_fitness", "can_submit_evaluations"]);

async function guardOwn(adminUserId: string, coachId: string) {
  const rows = (await sql`
    SELECT c.id, c.academy_id, a.user_id AS academy_admin_user_id
    FROM academy_coaches c
    JOIN academies a ON a.id = c.academy_id
    WHERE c.id = ${coachId} AND c.deleted_at IS NULL
    LIMIT 1
  `) as any[];
  if (!rows[0]) return null;
  if (rows[0].academy_admin_user_id !== adminUserId) return null;
  return rows[0];
}

function coerce(v: unknown, kind: "text" | "num" | "bool"): unknown {
  if (kind === "bool") return Boolean(v);
  if (v === undefined || v === null || v === "") return null;
  if (kind === "num") { const n = Number(v); return Number.isFinite(n) ? n : null; }
  return String(v);
}

export async function PUT(req: Request, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "academy_admin") {
    return NextResponse.json({ success: false, error: "Academy admin only" }, { status: 403 });
  }
  const adminUserId = (session.user as any).id as string;
  const own = await guardOwn(adminUserId, ctx.params.id);
  if (!own) return NextResponse.json({ success: false, error: "Coach not found" }, { status: 404 });

  let body: any = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (body.specialization && !SPECIALIZATIONS.has(String(body.specialization))) {
    return NextResponse.json({ success: false, error: "Invalid specialization" }, { status: 400 });
  }

  const updates: Array<[string, unknown]> = [];
  for (const k of Object.keys(body)) {
    if (TEXT_FIELDS.has(k))      updates.push([k, coerce(body[k], "text")]);
    else if (NUM_FIELDS.has(k))  updates.push([k, coerce(body[k], "num")]);
    else if (BOOL_FIELDS.has(k)) updates.push([k, coerce(body[k], "bool")]);
  }

  /* Retroactively link (or unlink, if coach_email is cleared) this roster
     entry to a real coach login — same resolution as the create path in
     app/api/academy/coaches/route.ts. */
  let linkWarning: string | null = null;
  if (Object.prototype.hasOwnProperty.call(body, "coach_email")) {
    const coachEmail = String(body.coach_email ?? "").trim().toLowerCase() || null;
    if (!coachEmail) {
      /* Explicit unlink — coach_email cleared. */
      updates.push(["user_id", null]);
    } else {
      const userRows = (await sql`
        SELECT id FROM users WHERE email = ${coachEmail} AND role = 'coach' LIMIT 1
      `) as unknown as Array<{ id: string }>;
      const coachUserId = userRows[0]?.id ?? null;
      if (coachUserId) {
        updates.push(["user_id", coachUserId]);
      } else {
        /* No match — leave the existing link (if any) untouched rather than
           wiping it out on a typo'd email. */
        linkWarning = "No coach account found with that email — link not applied.";
      }
    }
  }

  if (updates.length === 0) return NextResponse.json({ success: true, updated: 0 });

  for (const [col, val] of updates) {
    await (sql as unknown as (q: string, p: unknown[]) => Promise<unknown>)(
      `UPDATE academy_coaches SET ${col} = $1, updated_at = NOW() WHERE id = $2`,
      [val, ctx.params.id],
    );
  }
  return NextResponse.json({ success: true, updated: updates.length, ...(linkWarning ? { link_warning: linkWarning } : {}) });
}

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "academy_admin") {
    return NextResponse.json({ success: false, error: "Academy admin only" }, { status: 403 });
  }
  const adminUserId = (session.user as any).id as string;
  const own = await guardOwn(adminUserId, ctx.params.id);
  if (!own) return NextResponse.json({ success: false, error: "Coach not found" }, { status: 404 });

  /* Hard rule: refuse if any fitness assessment references this coach. */
  const linked = (await sql`
    SELECT COUNT(*)::int AS n FROM player_fitness_assessments
    WHERE assessed_by_coach_id = ${ctx.params.id}
  `) as any[];
  if ((linked[0]?.n ?? 0) > 0) {
    return NextResponse.json({
      success: false,
      error: "This coach has submitted fitness assessments. Remove their assessments first.",
      assessments: linked[0].n,
    }, { status: 409 });
  }

  await sql`UPDATE academy_coaches SET deleted_at = NOW(), updated_at = NOW() WHERE id = ${ctx.params.id}`;
  return NextResponse.json({ success: true });
}
