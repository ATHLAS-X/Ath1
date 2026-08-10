import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-server";
import { ok, fail } from "@/lib/onboarding-server";
import { calculateAthlasXScore } from "@/lib/score-engine";

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (guard instanceof Response) return guard;

  let body: any;
  try { body = await req.json(); } catch { return fail("Invalid JSON"); }
  const matchLogId = String(body?.match_log_id ?? "").trim();
  const playerId = String(body?.player_id ?? "").trim();
  if (!matchLogId || !playerId) return fail("match_log_id and player_id are required");

  // 1+2: Mark verified + award 3 pts on this row.
  const updated = (await sql`
    UPDATE match_logs
    SET ocr_status = 'VERIFIED',
        verification_pts = 3,
        reviewed_by = ${guard.userId},
        reviewed_at = NOW()
    WHERE id = ${matchLogId} AND user_id = ${playerId}
    RETURNING opponent
  `) as unknown as Array<{ opponent: string }>;
  if (!updated[0]) return fail("Scorecard not found", 404);
  const opponent = updated[0].opponent;

  // 3: Notify the player.
  const msg = `Your scorecard vs ${opponent} has been verified! +3 verification points awarded.`;
  await sql`
    INSERT INTO admin_notifications (recipient_user_id, type, message)
    VALUES (${playerId}, 'SCORECARD_APPROVED', ${msg})
  `;
  // Mirror into player_notifications so the player's in-app feed sees it too.
  await sql`
    INSERT INTO player_notifications (user_id, kind, title, body)
    VALUES (${playerId}, 'SCORECARD_APPROVED', 'Scorecard verified', ${msg})
  `;

  // 4: Recompute verification subscore from VERIFIED rows (cap 15).
  const sums = (await sql`
    SELECT COALESCE(SUM(verification_pts), 0)::int AS total_pts
    FROM match_logs
    WHERE user_id = ${playerId} AND ocr_status = 'VERIFIED'
  `) as unknown as Array<{ total_pts: number }>;
  const newVerificationPts = Math.min(15, sums[0]?.total_pts ?? 0);
  await sql`
    INSERT INTO athlasx_score (user_id, verification_score)
    VALUES (${playerId}, ${newVerificationPts})
    ON CONFLICT (user_id) DO UPDATE SET verification_score = ${newVerificationPts}
  `;

  // 5: Recompute total via the score engine (handles the full breakdown).
  const result = await calculateAthlasXScore(playerId);

  // 6:
  return ok({
    success: true,
    new_verification_pts: newVerificationPts,
    new_total_score: result.total,
  });
}
