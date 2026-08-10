import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-server";
import { ok, fail } from "@/lib/onboarding-server";
import { calculateAthlasXScore } from "@/lib/score-engine";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (guard instanceof Response) return guard;

  const rows = (await sql`
    UPDATE match_logs
    SET ocr_status = 'VERIFIED',
        verification_pts = 3,
        reviewed_by = ${guard.userId},
        reviewed_at = NOW()
    WHERE id = ${params.id}
    RETURNING user_id, opponent
  `) as unknown as Array<{ user_id: string; opponent: string }>;
  const m = rows[0];
  if (!m) return fail("Scorecard not found", 404);

  await sql`
    INSERT INTO player_notifications (user_id, kind, title, body)
    VALUES (${m.user_id}, 'SCORECARD_APPROVED', 'Scorecard verified',
            ${`Your match vs ${m.opponent} has been verified. +3 verification points awarded.`})
  `;

  // Recompute AthlasX score.
  await calculateAthlasXScore(m.user_id);
  return ok({ status: "VERIFIED" });
}