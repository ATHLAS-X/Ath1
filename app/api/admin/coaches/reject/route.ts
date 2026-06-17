import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-server";
import { ok, fail } from "@/lib/onboarding-server";

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (guard instanceof Response) return guard;

  let body: any;
  try { body = await req.json(); } catch { return fail("Invalid JSON"); }
  const coachId = String(body?.coach_id ?? "").trim();
  const reason = String(body?.reason ?? "").trim().slice(0, 500);
  if (!coachId) return fail("coach_id is required");
  if (!reason) return fail("reason is required");

  const target = (await sql`
    SELECT coach_name FROM coach_registry WHERE id = ${coachId} LIMIT 1
  `) as unknown as Array<{ coach_name: string }>;
  const coachName = target[0]?.coach_name;
  if (!coachName) return fail("Coach registration not found", 404);

  // 1: Reject all pending peer rows by the same coach.
  const updated = (await sql`
    UPDATE coach_registry
    SET coach_status = 'REJECTED',
        rejection_reason = ${reason},
        reviewed_by = ${guard.userId}
    WHERE coach_name = ${coachName} AND coach_status = 'PENDING_REVIEW'
    RETURNING user_id::text AS user_id
  `) as unknown as Array<{ user_id: string }>;

  // 2: Notify each inviting player.
  const msg = `Your coach verification could not be approved. Reason: ${reason}. Please ask your coach to re-register with valid credentials.`;
  for (const row of updated) {
    await sql`
      INSERT INTO admin_notifications (recipient_user_id, type, message)
      VALUES (${row.user_id}, 'COACH_REJECTED', ${msg})
    `;
    await sql`
      INSERT INTO player_notifications (user_id, kind, title, body)
      VALUES (${row.user_id}, 'COACH_REJECTED', 'Coach verification rejected', ${msg})
    `;
  }
  return ok({ success: true });
}
