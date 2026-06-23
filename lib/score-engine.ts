/**
 * Server-side AthlasX Score calculator.
 *
 * Category caps:
 *   Performance   40  — BPI / CBR benchmarked vs IPL-level stats
 *   Experience    15  — match count × quality (MQI weight)
 *   Fitness       15  — supervised academy assessment preferred; self-reported capped at 8
 *   Verification  15  — Aadhaar + guardian + verified scorecards + coach endorsement
 *   Mindset       10  — human coach evaluation (avg of 6 dimensions, 1–10 each)
 *   Profile        5  — profile completeness signals
 *   ───────────────────
 *   Total        100
 *
 * Bias note (changed from original design):
 *   Fitness formerly used only self-reported fitness_data, disadvantaging players
 *   without academy lab access. Now supervised assessments (is_supervised=true) get
 *   full credit; self-reported scores are capped at 8/15 to avoid penalising access gaps.
 *
 *   Mindset formerly used a Gemini AI psychological assessment which has documented
 *   cultural/linguistic bias risks. Replaced with a human coach evaluation
 *   (coach_evaluations table) — a real person who has worked with the player scores
 *   6 behavioural dimensions. No coach evaluation = 0 mindset pts (not a penalty for
 *   the player; it just hasn't been assessed yet).
 *
 * Trajectory boost: if score improved > 5 pts vs the snapshot from ~30 days ago,
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

/**
 * Compute a 0–100 fitness score from raw supervised assessment metrics.
 * Any missing metric is skipped; the average is taken over available ones only.
 *
 * Benchmarks (cricket-specific):
 *   Yo-Yo:    8 (poor) → 23 (elite). BCCI minimum for senior national = 16.1
 *   Sprint:   4.8s (poor) → 3.5s (elite), lower is better
 *   2km run:  11.0 min (poor) → 6.0 min (elite), lower is better
 */
function supervisedFitnessScore(
  yoyo: number | null,
  sprint: number | null,
  run2km: number | null,
): number {
  const parts: number[] = [];
  if (yoyo != null && yoyo > 0)
    parts.push(clamp(((yoyo - 8) / (23 - 8)) * 100, 0, 100));
  if (sprint != null && sprint > 0)
    parts.push(clamp(((4.8 - sprint) / (4.8 - 3.5)) * 100, 0, 100));
  if (run2km != null && run2km > 0)
    parts.push(clamp(((11.0 - run2km) / (11.0 - 6.0)) * 100, 0, 100));
  if (!parts.length) return 0;
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

export async function calculateAthlasXScore(userId: string): Promise<ScoreResult> {
  // ── Fetch all signals in parallel ────────────────────────────────────────
  const [
    stats,
    matchRows,
    fitnessData,
    supervisedFitness,
    coachEval,
    video,
    coach,
    aadhaar,
    guardian,
    cricket,
  ] = await Promise.all([
    sql`SELECT format, matches, bpi, cbr FROM performance_stats WHERE user_id = ${userId}` as unknown as Promise<Array<{ format: string; matches: number; bpi: number | null; cbr: number | null }>>,

    sql`SELECT mqi_weight, ocr_status FROM match_logs WHERE user_id = ${userId}` as unknown as Promise<Array<{ mqi_weight: number | string | null; ocr_status: string }>>,

    // Self-reported fitness (onboarding) — capped at 8/15 in scoring
    sql`SELECT fitness_score FROM fitness_data WHERE user_id = ${userId} LIMIT 1` as unknown as Promise<Array<{ fitness_score: number | null }>>,

    // Academy-supervised fitness — full 15/15 credit
    sql`
      SELECT yoyo_score, sprint_30m, run_2km
      FROM player_fitness_assessments
      WHERE user_id = ${userId} AND is_supervised = true
      ORDER BY assessment_date DESC LIMIT 1
    ` as unknown as Promise<Array<{ yoyo_score: number | null; sprint_30m: number | null; run_2km: number | null }>>,

    // Human coach evaluation — replaces Gemini AI behavioural assessment
    sql`
      SELECT discipline, coachability, work_ethic, leadership, mental_toughness, communication
      FROM coach_evaluations
      WHERE player_user_id = ${userId}
      ORDER BY updated_at DESC LIMIT 1
    ` as unknown as Promise<Array<{ discipline: number; coachability: number; work_ethic: number; leadership: number; mental_toughness: number; communication: number }>>,

    sql`SELECT video_analysed FROM video_analysis WHERE user_id = ${userId} LIMIT 1` as unknown as Promise<Array<{ video_analysed: boolean | null }>>,

    sql`SELECT 1 FROM coach_registry WHERE user_id = ${userId} AND coach_status = 'APPROVED' LIMIT 1` as unknown as Promise<Array<unknown>>,

    sql`SELECT verification_pts FROM aadhaar_verification WHERE user_id = ${userId}` as unknown as Promise<Array<{ verification_pts: number | null }>>,

    sql`SELECT verification_pts FROM guardian_consent WHERE user_id = ${userId}` as unknown as Promise<Array<{ verification_pts: number | null }>>,

    sql`SELECT player_role FROM cricket_profile WHERE user_id = ${userId} LIMIT 1` as unknown as Promise<Array<{ player_role: string | null }>>,
  ]);

  const coachVerified = coach.length > 0;
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

  // ── Fitness (max 15) — supervised preferred, self-reported capped ───────
  let fitnessRaw = 0;
  let fitnessIsSupervised = false;
  if (supervisedFitness[0]) {
    const { yoyo_score, sprint_30m, run_2km } = supervisedFitness[0];
    fitnessRaw = supervisedFitnessScore(
      yoyo_score != null ? Number(yoyo_score) : null,
      sprint_30m != null ? Number(sprint_30m) : null,
      run_2km != null ? Number(run_2km) : null,
    );
    fitnessIsSupervised = true;
  } else {
    fitnessRaw = fitnessData[0]?.fitness_score ?? 0;
  }
  // Supervised → full 15 pts. Self-reported → max 8 pts (access-bias guard).
  const fitnessCap = fitnessIsSupervised ? 15 : 8;
  const fitness = Math.round(clamp((fitnessRaw / 100) * fitnessCap, 0, fitnessCap));

  // ── Verification (max 15) ───────────────────────────────────────────────
  const aadhaarPts  = (aadhaar[0]?.verification_pts  ?? 0) || 0;
  const guardianPts = (guardian[0]?.verification_pts ?? 0) || 0;
  const matchPts    = matchRows.filter((m) => m.ocr_status === "VERIFIED").length * 3;
  const coachPts    = coachVerified ? 5 : 0;
  const totalVerifPts = aadhaarPts + guardianPts + matchPts + coachPts;
  const verification = Math.round(clamp(totalVerifPts, 0, 15));

  // ── Mindset (max 10) — human coach evaluation, 6 dimensions 1–10 ───────
  let mindset = 0;
  const evalRow = coachEval[0];
  if (evalRow) {
    const avgCoachScore =
      (evalRow.discipline + evalRow.coachability + evalRow.work_ethic +
       evalRow.leadership + evalRow.mental_toughness + evalRow.communication) / 6;
    // 1–10 scale maps directly to 1–10 mindset pts (coach rating of 10 = full marks)
    mindset = Math.round(clamp(avgCoachScore, 0, 10));
  }

  // ── Profile completeness (max 5) ────────────────────────────────────────
  const completenessSignals = [
    !!cricket[0]?.player_role,
    stats.length > 0,
    matchCount > 0,
    fitnessRaw > 0,
    !!evalRow,                      // coach behavioral evaluation submitted
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

  // ── Roadmap (top 3 actionable gaps) ────────────────────────────────────
  const roadmap: RoadmapItem[] = [];
  if (bestBpi < BPI_BENCHMARKS.state) {
    roadmap.push({
      title: `Improve BPI by ${(BPI_BENCHMARKS.state - bestBpi).toFixed(1)} to reach State threshold`,
      reward: `+${Math.min(40 - performance, Math.round(((BPI_BENCHMARKS.state - bestBpi) / BPI_BENCHMARKS.ipl) * 40))} Performance pts`,
    });
  }
  if (matchCount < 5) {
    roadmap.push({
      title: `Add ${5 - matchCount} more verified match scorecards`,
      reward: `+${(5 - matchCount) * 3} Verification pts`,
    });
  }
  if (!fitnessIsSupervised) {
    roadmap.push({
      title: "Complete a supervised academy fitness assessment (Yo-Yo + sprint + 2km)",
      reward: `+${15 - fitness} Fitness pts (supervised unlocks full 15 pts)`,
    });
  } else if (fitnessRaw < 70) {
    roadmap.push({
      title: "Improve fitness scores — aim for Yo-Yo 16+, sprint under 4.2s",
      reward: "+2–4 Fitness pts",
    });
  }
  if (!evalRow) {
    roadmap.push({
      title: "Ask your coach to submit a behavioral evaluation on AthlasX",
      reward: "+up to 10 Mindset pts (based on coach's rating of 6 traits)",
    });
  }
  if (!coachVerified) {
    roadmap.push({
      title: "Get a verified coach to endorse your profile",
      reward: "+5 Verification pts (unlocks scout discovery)",
    });
  }
  if (!video[0]?.video_analysed) {
    roadmap.push({
      title: "Upload a YouTube highlight for AI technique analysis",
      reward: "+1 Profile pt",
    });
  }

  const breakdown: CategoryBreakdown = {
    performance, experience, fitness, verification, mindset, profile: profileScore,
  };

  const calculatedAt = new Date().toISOString();
  const updatedHistory = [...history, { at: calculatedAt, total }].slice(-50);

  // ── Upsert athlasx_score ────────────────────────────────────────────────
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
       ${JSON.stringify(roadmap.slice(0, 3))}::jsonb,
       ${JSON.stringify(updatedHistory)}::jsonb,
       NOW(), NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      total_score        = EXCLUDED.total_score,
      performance_score  = EXCLUDED.performance_score,
      experience_score   = EXCLUDED.experience_score,
      fitness_score      = EXCLUDED.fitness_score,
      verification_score = EXCLUDED.verification_score,
      mindset_score      = EXCLUDED.mindset_score,
      profile_score      = EXCLUDED.profile_score,
      verification_pts   = EXCLUDED.verification_pts,
      trajectory_boost   = EXCLUDED.trajectory_boost,
      coach_verified     = EXCLUDED.coach_verified,
      profile_strength   = EXCLUDED.profile_strength,
      roadmap            = EXCLUDED.roadmap,
      score_history      = EXCLUDED.score_history,
      calculated_at      = NOW(),
      updated_at         = NOW()
  `;

  return {
    total,
    breakdown,
    verification_pts: totalVerifPts,
    profile_strength: strength,
    trajectory_boost: trajectoryBoost,
    delta_vs_30d: delta,
    coach_verified: coachVerified,
    roadmap: roadmap.slice(0, 3),
    calculated_at: calculatedAt,
  };
}

export const CATEGORY_MAX: CategoryBreakdown = {
  performance: 40,
  experience:  15,
  fitness:     15,
  verification: 15,
  mindset:     10,
  profile:      5,
};

export const CATEGORY_COLORS: Record<keyof CategoryBreakdown, string> = {
  performance:  "#60A5FA",
  experience:   "#A78BFA",
  fitness:      "#F59E0B",
  verification: "#22C55E",
  mindset:      "#EC4899",
  profile:      "#94A3B8",
};
