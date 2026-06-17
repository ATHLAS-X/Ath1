import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-server";
import { ok, fail } from "@/lib/onboarding-server";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (guard instanceof Response) return guard;

  let body: any;
  try { body = await req.json(); } catch { body = {}; }
  const reason = String(body?.reason ?? "Coach credentials could not be verified.").slice(0, 500);

  const target = (await sql`
    SELECT coach_name FROM coach_registry WHERE id = ${params.id} LIMIT 1
  `) as unknown as Array<{ coach_name: string }>;
  const coachName = target[0]?.coach_name;
  if (!coachName) return fail("Coach not found", 404);

  const updated = (await sql`
    UPDATE coach_registry
    SET coach_status = 'REJECTED', reviewed_by = ${guard.userId}, reject_reason = ${reason}
    WHERE coach_name = ${coachName} AND coach_status = 'PENDING_REVIEW'
    RETURNING user_id
  `) as unknown as Array<{ user_id: string }>;

  for (const row of updated) {
    await sql`
      INSERT INTO player_notifications (user_id, kind, title, body)
      VALUES (${row.user_id}, 'COACH_REJECTED', 'Coach verification rejected', ${reason})
    `;
  }
  return ok({ rejected: updated.length });
}
