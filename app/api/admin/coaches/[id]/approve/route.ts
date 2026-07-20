import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-server";
import { ok, fail } from "@/lib/onboarding-server";
import { calculateAthlasXScore } from "@/lib/score-engine";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (guard instanceof Response) return guard;

  // Find this registry record and approve all peer rows by the same coach.
  const target = (await sql`
    SELECT coach_name FROM coach_registry WHERE id = ${params.id} LIMIT 1
  `) as unknown as Array<{ coach_name: string }>;
  const coachName = target[0]?.coach_name;
  if (!coachName) return fail("Coach registration not found", 404);

  const updated = (await sql`
    UPDATE coach_registry
    SET coach_status = 'APPROVED', approved_at = NOW(), reviewed_by = ${guard.userId}
    WHERE coach_name = ${coachName} AND coach_status = 'PENDING_REVIEW'
    RETURNING user_id
  `) as unknown as Array<{ user_id: string }>;

  // Flip coach_verified + notify + recompute scores for each affected player.
  for (const row of updated) {
    await sql`
      UPDATE player_profiles SET coach_verified = true WHERE user_id = ${row.user_id}
    `;
    await sql`
      INSERT INTO athlasx_score (user_id, coach_verified)
      VALUES (${row.user_id}, true)
      ON CONFLICT (user_id) DO UPDATE SET coach_verified = true
    `;
    await sql`
      INSERT INTO player_notifications (user_id, kind, title, body)
      VALUES (${row.user_id}, 'COACH_APPROVED', 'Coach verified',
              ${`${coachName} has been approved by AthlasX. +5 verification points awarded.`})
    `;
    await calculateAthlasXScore(row.user_id);
  }

  return ok({ approved: updated.length });
}