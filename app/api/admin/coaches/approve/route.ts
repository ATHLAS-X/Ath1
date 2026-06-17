import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-server";
import { ok, fail } from "@/lib/onboarding-server";
import { calculateSportXScore } from "@/lib/score-engine";

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (guard instanceof Response) return guard;

  let body: any;
  try { body = await req.json(); } catch { return fail("Invalid JSON"); }
  const coachId = String(body?.coach_id ?? "").trim();
  if (!coachId) return fail("coach_id is required");

  // Look up coach_name from the representative registration row.
  const target = (await sql`
    SELECT coach_name, academy_club FROM coach_registry WHERE id = ${coachId} LIMIT 1
  `) as unknown as Array<{ coach_name: string; academy_club: string }>;
  const t = target[0];
  if (!t) return fail("Coach registration not found", 404);

  // 1: Approve all peer rows by the same coach.
  const updated = (await sql`
    UPDATE coach_registry
    SET coach_status = 'APPROVED',
        approved_at = NOW(),
        reviewed_by = ${guard.userId},
        players_waiting = 0
    WHERE coach_name = ${t.coach_name} AND coach_status = 'PENDING_REVIEW'
    RETURNING user_id::text AS user_id
  `) as unknown as Array<{ user_id: string }>;

  let totalDelta = 0;
  for (const row of updated) {
    // 3a: coach_verified on player_profiles.
    await sql`UPDATE player_profiles SET coach_verified = true WHERE user_id = ${row.user_id}`;

    // 3b: bump verification_score (cap 15) + coach_verified on sportx_score.
    await sql`
      INSERT INTO sportx_score (user_id, coach_verified, verification_score)
      VALUES (${row.user_id}, true, 5)
      ON CONFLICT (user_id) DO UPDATE SET
        coach_verified = true,
        verification_score = LEAST(15, COALESCE(sportx_score.verification_score, 0) + 5)
    `;

    // Snapshot score before recompute so we can report average delta.
    const before = (await sql`
      SELECT total_score FROM sportx_score WHERE user_id = ${row.user_id} LIMIT 1
    `) as unknown as Array<{ total_score: number }>;
    const prevTotal = before[0]?.total_score ?? 0;

    // 3c + 3d: recompute everything (score-engine handles profile_strength).
    const result = await calculateSportXScore(row.user_id);
    totalDelta += Math.max(0, result.total - prevTotal);

    // 3e: notify the player.
    const msg = `Your coach ${t.coach_name} from ${t.academy_club} has been verified! +5 verification points added to your profile.`;
    await sql`
      INSERT INTO admin_notifications (recipient_user_id, type, message)
      VALUES (${row.user_id}, 'COACH_APPROVED', ${msg})
    `;
    await sql`
      INSERT INTO player_notifications (user_id, kind, title, body)
      VALUES (${row.user_id}, 'COACH_APPROVED', 'Coach verified', ${msg})
    `;
  }

  const avgScoreIncrease = updated.length ? Math.round(totalDelta / updated.length) : 0;

  return ok({
    success: true,
    players_updated: updated.length,
    avg_score_increase: avgScoreIncrease,
  });
}
