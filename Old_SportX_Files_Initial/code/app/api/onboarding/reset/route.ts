import { sql } from "@/lib/db";
import { fail, ok, requireUserId } from "@/lib/onboarding-server";

/**
 * Dev-only nuke: wipes every onboarding row for the current user and resets
 * onboarding_progress back to Step 1 / DRAFT. Useful when QA'ing the flow.
 */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return fail("Reset is disabled in production", 403);
  }
  const guard = await requireUserId();
  if (guard instanceof Response) return guard;
  const u = guard.userId;

  await sql`DELETE FROM aadhaar_verification WHERE user_id = ${u}`;
  await sql`DELETE FROM guardian_consent WHERE user_id = ${u}`;
  await sql`DELETE FROM cricket_profile WHERE user_id = ${u}`;
  await sql`DELETE FROM performance_stats WHERE user_id = ${u}`;
  await sql`DELETE FROM match_logs WHERE user_id = ${u}`;
  await sql`DELETE FROM fitness_data WHERE user_id = ${u}`;
  await sql`DELETE FROM behavioral_assessment WHERE user_id = ${u}`;
  await sql`DELETE FROM video_analysis WHERE user_id = ${u}`;
  await sql`DELETE FROM coach_registry WHERE user_id = ${u}`;
  await sql`DELETE FROM coach_invites WHERE user_id = ${u}`;
  await sql`DELETE FROM athlasx_score WHERE user_id = ${u}`;
  await sql`
    UPDATE player_profiles
    SET coach_verified = false, score_weights = NULL
    WHERE user_id = ${u}
  `;
  await sql`
    INSERT INTO onboarding_progress (user_id, current_step, status, completed_steps)
    VALUES (${u}, 1, 'DRAFT', '{}')
    ON CONFLICT (user_id) DO UPDATE SET
      current_step = 1,
      status = 'DRAFT',
      completed_steps = '{}',
      updated_at = NOW()
  `;

  return ok({ reset: true });
}
