import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-server";
import { ok, fail } from "@/lib/onboarding-server";

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (guard instanceof Response) return guard;

  let body: any;
  try { body = await req.json(); } catch { return fail("Invalid JSON"); }
  const matchLogId = String(body?.match_log_id ?? "").trim();
  const playerId = String(body?.player_id ?? "").trim();
  const reason = String(body?.reason ?? "").trim().slice(0, 500);
  if (!matchLogId || !playerId) return fail("match_log_id and player_id are required");
  if (!reason) return fail("reason is required");

  // 1: Mark rejected with the reason.
  const updated = (await sql`
    UPDATE match_logs
    SET ocr_status = 'REJECTED',
        verification_pts = 0,
        rejection_reason = ${reason},
        reviewed_by = ${guard.userId},
        reviewed_at = NOW()
    WHERE id = ${matchLogId} AND user_id = ${playerId}
    RETURNING opponent
  `) as unknown as Array<{ opponent: string }>;
  if (!updated[0]) return fail("Scorecard not found", 404);
  const opponent = updated[0].opponent;

  // 2: Notify the player.
  const msg = `Your scorecard vs ${opponent} could not be verified. Reason: ${reason}. Please re-upload a clearer image.`;
  await sql`
    INSERT INTO admin_notifications (recipient_user_id, type, message)
    VALUES (${playerId}, 'SCORECARD_REJECTED', ${msg})
  `;
  await sql`
    INSERT INTO player_notifications (user_id, kind, title, body)
    VALUES (${playerId}, 'SCORECARD_REJECTED', 'Scorecard rejected', ${msg})
  `;

  return ok({ success: true });
}
