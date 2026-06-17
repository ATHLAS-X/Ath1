import { sql } from "@/lib/db";
import { advanceStep } from "@/lib/onboarding";
import { ok, requireUserId } from "@/lib/onboarding-server";

export async function POST() {
  const guard = await requireUserId();
  if (guard instanceof Response) return guard;

  // Ensure a sportx_score row exists, then activate + flag indexed.
  await sql`
    INSERT INTO sportx_score (user_id, status, elasticsearch_indexed, activated_at, updated_at)
    VALUES (${guard.userId}, 'ACTIVE', true, NOW(), NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      status = 'ACTIVE',
      elasticsearch_indexed = true,
      activated_at = COALESCE(sportx_score.activated_at, NOW()),
      updated_at = NOW()
  `;

  const state = await advanceStep(guard.userId, 12);
  return ok({ status: "ACTIVE", elasticsearch_indexed: true, onboarding: state });
}
