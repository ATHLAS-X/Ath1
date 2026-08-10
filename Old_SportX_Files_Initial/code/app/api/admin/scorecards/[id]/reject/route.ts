import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-server";
import { ok, fail } from "@/lib/onboarding-server";
import { calculateAthlasXScore } from "@/lib/score-engine";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (guard instanceof Response) return guard;

  let body: any;
  try { body = await req.json(); } catch { body = {}; }
  const reason = String(body?.reason ?? "Scorecard could not be verified.").slice(0, 500);

  const rows = (await sql`
    UPDATE match_logs
    SET ocr_status = 'REJECTED',
        verification_pts = 0,
        reviewed_by = ${guard.userId},
        reviewed_at = NOW(),
        reject_reason = ${reason}
    WHERE id = ${params.id}
    RETURNING user_id, opponent
  `) as unknown as Array<{ user_id: string; opponent: string }>;
  const m = rows[0];
  if (!m) return fail("Scorecard not found", 404);

  await sql`
    INSERT INTO player_notifications (user_id, kind, title, body)
    VALUES (${m.user_id}, 'SCORECARD_REJECTED', 'Scorecard rejected', ${reason})
  `;
  await calculateAthlasXScore(m.user_id);
  return ok({ status: "REJECTED" });
}
