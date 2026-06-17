import { sql } from "@/lib/db";
import { ok, requireUserId } from "@/lib/onboarding-server";

export async function GET() {
  const guard = await requireUserId();
  if (guard instanceof Response) return guard;

  const rows = (await sql`
    SELECT total_score, performance_score, experience_score, fitness_score,
           verification_score, mindset_score, profile_score, verification_pts,
           trajectory_boost, coach_verified, profile_strength, roadmap,
           status, elasticsearch_indexed, calculated_at, activated_at, score_history
    FROM sportx_score WHERE user_id = ${guard.userId} LIMIT 1
  `) as unknown as any[];

  return ok(rows[0] ?? null);
}
