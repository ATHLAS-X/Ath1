import { sql } from "@/lib/db";
import { ok, requireUserId } from "@/lib/onboarding-server";

// MVP: auto-approve any pending coach registration 5 seconds after submission.
// TODO: production — replace with real P8 review queue + admin approval UI.

export async function GET() {
  const guard = await requireUserId();
  if (guard instanceof Response) return guard;

  // Lazy auto-approval for any PENDING_REVIEW row whose created_at >= 5s ago.
  await sql`
    UPDATE coach_registry
    SET coach_status = 'APPROVED', approved_at = NOW()
    WHERE user_id = ${guard.userId}
      AND coach_status = 'PENDING_REVIEW'
      AND created_at <= NOW() - INTERVAL '5 seconds'
  `;

  // If any row is APPROVED now, denormalise + award pts (idempotent).
  const approved = (await sql`
    SELECT 1 FROM coach_registry
    WHERE user_id = ${guard.userId} AND coach_status = 'APPROVED'
    LIMIT 1
  `) as unknown as Array<unknown>;
  if (approved.length) {
    await sql`UPDATE player_profiles SET coach_verified = true WHERE user_id = ${guard.userId}`;
    // Award +5 in athlasx_score (insert row if missing).
    await sql`
      INSERT INTO athlasx_score (user_id, coach_verified, verification_pts)
      VALUES (${guard.userId}, true, 5)
      ON CONFLICT (user_id) DO UPDATE SET
        coach_verified = true,
        verification_pts = GREATEST(athlasx_score.verification_pts, 5)
    `;
  }

  const invites = (await sql`
    SELECT coach_name, coach_email, status, created_at
    FROM coach_invites
    WHERE user_id = ${guard.userId}
    ORDER BY created_at DESC
  `) as unknown as any[];
  const coaches = (await sql`
    SELECT coach_name, academy_club, official_id, cert_url, coach_status, created_at, approved_at
    FROM coach_registry
    WHERE user_id = ${guard.userId}
    ORDER BY created_at DESC
  `) as unknown as any[];

  const coachVerified = coaches.some((c: any) => c.coach_status === "APPROVED");

  // Count "items" — match logs, video analysis, fitness data — to drive
  // STRONG / MID / WEAK profile strength.
  const counts = (await sql`
    SELECT
      (SELECT COUNT(*) FROM match_logs WHERE user_id = ${guard.userId})::int AS match_count,
      (SELECT COUNT(*) FROM video_analysis WHERE user_id = ${guard.userId} AND video_analysed = true)::int AS video_count,
      (SELECT COUNT(*) FROM fitness_data WHERE user_id = ${guard.userId} AND fitness_score IS NOT NULL)::int AS fitness_count
  `) as unknown as Array<{ match_count: number; video_count: number; fitness_count: number }>;
  const c = counts[0] ?? { match_count: 0, video_count: 0, fitness_count: 0 };
  const itemCount =
    (c.match_count > 0 ? 1 : 0) + (c.video_count > 0 ? 1 : 0) + (c.fitness_count > 0 ? 1 : 0);

  let strength: "STRONG" | "MID" | "WEAK" = "WEAK";
  if (coachVerified && itemCount >= 3) strength = "STRONG";
  else if (coachVerified && itemCount >= 1) strength = "MID";

  return ok({
    coach_verified: coachVerified,
    invites,
    coaches,
    items: { matches: c.match_count, videos: c.video_count, fitness: c.fitness_count, total: itemCount },
    profile_strength: strength,
  });
}
