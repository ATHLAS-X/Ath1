import { sql } from "@/lib/db";
import type { DashboardData } from "@/components/dashboard/types";

export async function loadDashboardUser(userId: string) {
  const rows = (await sql`
    SELECT id, name, email, created_at FROM users WHERE id = ${userId} LIMIT 1
  `) as unknown as Array<{ id: string; name: string; email: string | null; created_at: string | null }>;
  return rows[0] ?? null;
}

/** Run a query but never reject — return `fallback` on transient failure. */
async function safeSql<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch (e) {
    console.warn("[dashboard-loader] query failed, using fallback:", (e as any)?.message);
    return fallback;
  }
}

/**
 * Parallel-fetches every onboarding-table row needed to render the
 * comprehensive player dashboard. Used by both /dashboard and /profile/[userId].
 *
 * Each query is wrapped in `safeSql` so a transient NeonDB hiccup on any
 * single table just yields an empty section instead of blowing up the whole
 * server-rendered page.
 */
export async function loadDashboardData(
  userId: string,
  isOwner: boolean,
): Promise<DashboardData | null> {
  const user = await safeSql(loadDashboardUser(userId), null);
  if (!user) return null;

  const [
    profileRows, cricketRows, perfRows, matchRows, fitRows,
    behRows, vidRows, scoreRows, aadhaarRows, guardianRows, coachRows,
  ] = await Promise.all([
    safeSql(sql`
      SELECT city, state, district, date_of_birth, playing_role, batting_style, bowling_style,
             matches_played, runs_scored, wickets_taken, highest_score, best_bowling, bio,
             avatar_url, coach_verified, score_weights,
             height_cm, weight_kg, profile_status, visibility, user_id
      FROM player_profiles WHERE user_id = ${userId} LIMIT 1
    ` as unknown as Promise<any[]>, [] as any[]),
    safeSql(sql`SELECT player_role, batting_style, bowling_style, phase_specialty
        FROM cricket_profile WHERE user_id = ${userId} LIMIT 1` as unknown as Promise<any[]>, [] as any[]),
    safeSql(sql`
      SELECT format, matches, innings, runs, not_outs, highest_score, fifties, hundreds,
             powerplay_sr, middle_avg, death_sr, overs_bowled, wickets, economy,
             bowl_avg, bowl_sr, best_figures, bpi, cbr
      FROM performance_stats WHERE user_id = ${userId} ORDER BY format
    ` as unknown as Promise<any[]>, [] as any[]),
    safeSql(sql`
      SELECT id, opponent, match_date, format, competition_level, mqi_tag, mqi_weight,
             runs_scored, wickets_taken, scorecard_url, ocr_status, verification_pts, created_at
      FROM match_logs WHERE user_id = ${userId}
      ORDER BY match_date DESC, created_at DESC LIMIT 25
    ` as unknown as Promise<any[]>, [] as any[]),
    safeSql(sql`
      SELECT sprint_time, pushups_60s, resting_hr_bpm, yoyo_level, run_2km_time,
             height_cm, weight_kg, bmi, fitness_score, medical_cert_url
      FROM fitness_data WHERE user_id = ${userId} LIMIT 1
    ` as unknown as Promise<any[]>, [] as any[]),
    safeSql(sql`SELECT strengths, gaps, mental_rating, coaching_tip, mindset_score
        FROM behavioral_assessment WHERE user_id = ${userId} LIMIT 1` as unknown as Promise<any[]>, [] as any[]),
    safeSql(sql`
      SELECT video_url, youtube_video_id, batting_style, wrist_movement, foot_work, bowling_action,
             strong_points, weak_points, style_classification, technique_notes
      FROM video_analysis WHERE user_id = ${userId} LIMIT 1
    ` as unknown as Promise<any[]>, [] as any[]),
    safeSql(sql`
      SELECT total_score, performance_score, experience_score, fitness_score,
             verification_score, mindset_score, profile_score, verification_pts,
             trajectory_boost, coach_verified, profile_strength, roadmap, status
      FROM athlasx_score WHERE user_id = ${userId} LIMIT 1
    ` as unknown as Promise<any[]>, [] as any[]),
    safeSql(sql`SELECT age_verified, verified_dob, verification_pts FROM aadhaar_verification
        WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 1` as unknown as Promise<any[]>, [] as any[]),
    safeSql(sql`SELECT parent_phone_verified, disclaimer_signed, verification_pts FROM guardian_consent
        WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 1` as unknown as Promise<any[]>, [] as any[]),
    safeSql(sql`SELECT coach_name, academy_club, coach_status, approved_at FROM coach_registry
        WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 1` as unknown as Promise<any[]>, [] as any[]),
  ]);

  return {
    user,
    profile: (profileRows as any[])[0] ?? null,
    cricket: (cricketRows as any[])[0] ?? null,
    performance: (perfRows as any[]) ?? [],
    matches: (matchRows as any[]) ?? [],
    fitness: (fitRows as any[])[0] ?? null,
    behaviour: (behRows as any[])[0] ?? null,
    video: (vidRows as any[])[0] ?? null,
    score: (scoreRows as any[])[0] ?? null,
    aadhaar: (aadhaarRows as any[])[0] ?? null,
    guardian: (guardianRows as any[])[0] ?? null,
    coach: (coachRows as any[])[0] ?? null,
    isOwner,
  };
}
