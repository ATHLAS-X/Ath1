import { sql } from "@/lib/db";
import { ok, requireUserId } from "@/lib/onboarding-server";
import { getUserOnboardingState } from "@/lib/onboarding";

/**
 * Consolidated dashboard payload. One round trip, every query runs in
 * parallel server-side so the cold-start cost is paid once.
 */
export async function GET() {
  const guard = await requireUserId();
  if (guard instanceof Response) return guard;
  const userId = guard.userId;

  const [profileRows, videoRows, scoreRows, onboarding] = await Promise.all([
    sql`
      SELECT id, user_id, city, state, district, date_of_birth,
             playing_role, batting_style, bowling_style,
             matches_played, runs_scored, wickets_taken, highest_score,
             best_bowling, bio, avatar_url
      FROM player_profiles WHERE user_id = ${userId} LIMIT 1
    `,
    sql`
      SELECT id, user_id, title, youtube_url, youtube_video_id, category, created_at
      FROM player_videos WHERE user_id = ${userId}
      ORDER BY created_at DESC LIMIT 10
    `,
    sql`
      SELECT total_score, status, profile_strength, trajectory_boost, verification_pts
      FROM sportx_score WHERE user_id = ${userId} LIMIT 1
    `,
    getUserOnboardingState(userId),
  ]);

  return ok({
    userId,
    profile: (profileRows as any[])[0] ?? null,
    videos: videoRows ?? [],
    score: (scoreRows as any[])[0] ?? null,
    onboarding,
    trialInvites: [],
  });
}
