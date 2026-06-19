/**
 * Server-side AthlasX Score calculator.
 *
 * Category caps:
 *   Performance   40
 *   Experience    15
 *   Fitness       15
 *   Verification  15
 *   Mindset       10
 *   Profile        5
 *   ---------------
 *   Total        100
 *
 * Trajectory boost: if score improved > 5pts vs the snapshot from ~30 days ago,
 * flag trajectory_boost = true (search ranking multiplies by ×1.2).
 */
import { sql } from "@/lib/db";
import { BPI_BENCHMARKS, CBR_BENCHMARKS } from "@/lib/stats-math";

export interface CategoryBreakdown {
  performance: number;
  experience: number;
  fitness: number;
  verification: number;
  mindset: number;
  profile: number;
}

export interface RoadmapItem {
  title: string;
  reward: string;
}

export interface ScoreResult {
  total: number;
  breakdown: CategoryBreakdown;
  verification_pts: number;
  profile_strength: "STRONG" | "MID" | "WEAK";
  trajectory_boost: boolean;
  delta_vs_30d: number;
  coach_verified: boolean;
  roadmap: RoadmapItem[];
  calculated_at: string;
}

const clamp = (n: number, lo = 0, hi = Infinity) => Math.max(lo, Math.min(hi, n));

export async function calculateAthlasXScore(userId: string): Promise<ScoreResult> {
  // Pull every signal in one round-trip-ish.
  const stats = (await sql`
    SELECT format, matches, bpi, cbr
    FROM performance_stats WHERE user_id = ${userId}
  `) as unknown as Array<{ format: string; matches: number; bpi: number | null; cbr: number | null }>;

  const matchRows = (await sql`
    SELECT mqi_weight, ocr_status FROM match_logs WHERE user_id = ${userId}
  `) as unknown as Array<{ mqi_weight: number | string | null; ocr_status: string }>;

  const fitnessRows = (await sql`
    SELECT fitness_score FROM fitness_data WHERE user_id = ${userId} LIMIT 1
  `) as unknown as Array<{ fitness_score: number | null }>;

  const behaviour = (await sql`
    SELECT mindset_score FROM behavioral_assessment WHERE user_id = ${userId} LIMIT 1
  `) as unknown as Array<{ mindset_score: number | null }>;

  const video = (await sql`
    SELECT video_analysed FROM video_analysis WHERE user_id = ${userId} LIMIT 1
  `) as unknown as Array<{ video_analysed: boolean | null }>;

  const coach = (await sql`
    SELECT 1 FROM coach_registry WHERE user_id = ${userId} AND coach_status = 'APPROVED' LIMIT 1
  `) as unknown as Array<unknown>;
  const coachVerified = coach.length > 0;

  const aadhaar = (await sql`
    SELECT verification_pts FROM aadhaar_verification WHERE user_id = ${userId}
  `) as unknown as Array<{ verification_pts: number | null }>;

  const guardian = (await sql`
    SELECT verification_pts FROM guardian_consent WHERE user_id = ${userId}
  `) as unknown as Array<{ verification_pts: number | null }>;

  const cricket = (await sql`
    SELECT player_role FROM cricket_profile WHERE user_id = ${userId} LIMIT 1
  `) as unknown as Array<{ player_role: string | null }>;
  const role = cricket[0]?.player_role ?? null;

  // ── Performance (max 40) ────────────────────────────────────────────────
  let bestBpi = 0;
  let bestCbr = Infinity;
  for (const s of stats) {
    if (s.bpi != null && s.bpi > bestBpi) bestBpi = Number(s.bpi);
    if (s.cbr != null && s.cbr > 0 && s.cbr < bestCbr) bestCbr = Number(s.cbr);
  }
  const bpiPerf = clamp((bestBpi / BPI_BENCHMARKS.ipl) * 40, 0, 40);
  const cbrPerf = bestCbr === Infinity ? 0 : clamp((CBR_BENCHMARKS.ipl / bestCbr) * 40, 0, 40);

  let performance = 0;
  if (role === "Bowler") performance = cbrPerf;
  else if (role === "All-Rounder") performance = (bpiPerf + cbrPerf) / 2;
  else performance = bpiPerf;
  performance = Math.round(clamp(performance, 0, 40));

  // ── Experience (max 15) ─────────────────────────────────────────────────
  const matchCount = matchRows.length;
  const avgMqi = matchCount
    ? matchRows.reduce((acc, m) => acc + (Number(m.mqi_weight) || 0), 0) / matchCount
    : 0;
  const experience = Math.round(clamp((matchCount / 20) * 15 * (avgMqi || 1), 0, 15));

  // ── Fitness (max 15) ────────────────────────────────────────────────────
  const fitnessRaw = fitnessRows[0]?.fitness_score ?? 0;
  const fitness = Math.round(clamp((fitnessRaw / 100) * 15, 0, 15));

  // ── Verification (max 15) ───────────────────────────────────────────────
  const aadhaarPts = (aadhaar[0]?.verification_pts ?? 0) || 0;
  const guardianPts = (guardian[0]?.verification_pts ?? 0) || 0;
  const matchPts = matchRows.filter((m) => m.ocr_status === "VERIFIED").length * 3;
  const coachPts = coachVerified ? 5 : 0;
  const totalVerifPts = aadhaarPts + guardianPts + matchPts + coachPts;
  const verification = Math.round(clamp(totalVerifPts, 0, 15));

  // ── Mindset (max 10) ────────────────────────────────────────────────────
  const mindsetRaw = behaviour[0]?.mindset_score ?? 0;
  const mindset = Math.round(clamp((mindsetRaw / 100) * 10, 0, 10));

  // ── Profile completeness (max 5) ────────────────────────────────────────
  const completenessSignals = [
    !!cricket[0]?.player_role,
    stats.length > 0,
    matchCount > 0,
    fitnessRaw > 0,
    mindsetRaw > 0,
    !!video[0]?.video_analysed,
    coachVerified,
    aadhaarPts > 0,
  ];
  const completeness = completenessSignals.filter(Boolean).length / completenessSignals.length;
  const profileScore = Math.round(clamp(completeness * 5, 0, 5));

  const total = performance + experience + fitness + verification + mindset + profileScore;

  // ── Trajectory: compare with snapshot ~30 days ago ──────────────────────
  const prior = (await sql`
    SELECT score_history FROM athlasx_score WHERE user_id = ${userId} LIMIT 1
  `) as unknown as Array<{ score_history: Array<{ at: string; total: number }> | null }>;
  const history = Array.isArray(prior[0]?.score_history) ? prior[0]!.score_history! : [];
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  let priorTotal: number | null = null;
  for (const h of history) {
    const t = new Date(h.at).getTime();
    if (!isNaN(t) && t <= cutoff) priorTotal = h.total;
  }
  const delta = priorTotal == null ? 0 : total - priorTotal;
  const trajectoryBoost = delta > 5;

  // ── Profile strength ────────────────────────────────────────────────────
  const itemCount =
    (matchCount > 0 ? 1 : 0) +
    (video[0]?.video_analysed ? 1 : 0) +
    (fitnessRaw > 0 ? 1 : 0);
  let strength: "STRONG" | "MID" | "WEAK" = "WEAK";
  if (coachVerified && itemCount >= 3) strength = "STRONG";
  else if (coachVerified && itemCount >= 1) strength = "MID";
  else if (!coachVerified && total >= 60) strength = "MID";

  // ── Roadmap (3 actionable items) ────────────────────────────────────────
  const roadmap: RoadmapItem[] = [];
  const stateBPI = BPI_BENCHMARKS.state;
  if (bestBpi < stateBPI) {
    roadmap.push({
      title: `Improve BPI by ${(stateBPI - bestBpi).toFixed(1)} to reach State threshold`,
      reward: `+${Math.min(40 - performance, Math.round(((stateBPI - bestBpi) / BPI_BENCHMARKS.ipl) * 40))} Performance pts`,
    });
  }
  if (matchCount < 5) {
    roadmap.push({
      title: `Add ${5 - matchCount} more verified match scorecards`,
      reward: `+${(5 - matchCount) * 3} verification pts`,
    });
  }
  if (fitnessRaw < 70) {
    roadmap.push({
      title: "Complete fitness certification (BMI + sprint + Yo-Yo)",
      reward: "+2 profile pts",
    });
  }
  if (!coachVerified) {
    roadmap.push({
      title: "Get a coach to verify your profile",
      reward: "+5 verification pts (unlocks scout discovery)",
    });
  }
  if (!video[0]?.video_analysed) {
    roadmap.push({
      title: "Upload a YouTube highlight for AI technique analysis",
      reward: "+2 profile pts",
    });
  }
  const topRoadmap = roadmap.slice(0, 3);

  const breakdown: CategoryBreakdown = {
    performance, experience, fitness, verification, mindset, profile: profileScore,
  };

  const calculatedAt = new Date().toISOString();
  const updatedHistory = [...history, { at: calculatedAt, total }].slice(-50);

  // Upsert athlasx_score row
  await sql`
    INSERT INTO athlasx_score
      (user_id, total_score, performance_score, experience_score, fitness_score,
       verification_score, mindset_score, profile_score, verification_pts,
       trajectory_boost, coach_verified, profile_strength, roadmap, score_history,
       calculated_at, updated_at)
    VALUES
      (${userId}, ${total}, ${performance}, ${experience}, ${fitness},
       ${verification}, ${mindset}, ${profileScore}, ${totalVerifPts},
       ${trajectoryBoost}, ${coachVerified}, ${strength},
       ${JSON.stringify(topRoadmap)}::jsonb, ${JSON.stringify(updatedHistory)}::jsonb,
       NOW(), NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      total_score = EXCLUDED.total_score,
      performance_score = EXCLUDED.performance_score,
      experience_score = EXCLUDED.experience_score,
      fitness_score = EXCLUDED.fitness_score,
      verification_score = EXCLUDED.verification_score,
      mindset_score = EXCLUDED.mindset_score,
      profile_score = EXCLUDED.profile_score,
      verification_pts = EXCLUDED.verification_pts,
      trajectory_boost = EXCLUDED.trajectory_boost,
      coach_verified = EXCLUDED.coach_verified,
      profile_strength = EXCLUDED.profile_strength,
      roadmap = EXCLUDED.roadmap,
      score_history = EXCLUDED.score_history,
      calculated_at = NOW(),
      updated_at = NOW()
  `;

  return {
    total,
    breakdown,
    verification_pts: totalVerifPts,
    profile_strength: strength,
    trajectory_boost: trajectoryBoost,
    delta_vs_30d: delta,
    coach_verified: coachVerified,
    roadmap: topRoadmap,
    calculated_at: calculatedAt,
  };
}

export const CATEGORY_MAX: CategoryBreakdown = {
  performance: 40,
  experience: 15,
  fitness: 15,
  verification: 15,
  mindset: 10,
  profile: 5,
};

export const CATEGORY_COLORS: Record<keyof CategoryBreakdown, string> = {
  performance: "#60A5FA",
  experience: "#A78BFA",
  fitness: "#F59E0B",
  verification: "#22C55E",
  mindset: "#EC4899",
  profile: "#94A3B8",
};
