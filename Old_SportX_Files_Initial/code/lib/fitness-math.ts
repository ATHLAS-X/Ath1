/**
 * Fitness scoring used by Step 7 (StepFitness).
 *
 * Weights (sum = 100):
 *   Sprint        25
 *   Push-ups      20
 *   Endurance     25  (avg of Yo-Yo + 2km, or whichever is present)
 *   BMI           15
 *   Resting HR    15
 *
 * Each sub-score is clamped to [0, 100].
 */

export interface FitnessInputs {
  /** 30m sprint (seconds, lower is better) */
  sprint?: number | null;
  /** Push-ups in 60s (higher is better) */
  pushups?: number | null;
  /** Resting heart rate (BPM, lower is better) */
  rhr?: number | null;
  /** Yo-Yo Test level (higher is better) */
  yoyo?: number | null;
  /** 2km run time in seconds (lower is better) */
  run2km?: number | null;
  /** Height (cm) */
  height?: number | null;
  /** Weight (kg) */
  weight?: number | null;
}

export interface FitnessBreakdown {
  bmi: number | null;
  sprintScore: number;
  pushupsScore: number;
  enduranceScore: number;
  bmiScore: number;
  rhrScore: number;
  fitnessScore: number;
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

export function bmiFrom(height: number | null | undefined, weight: number | null | undefined): number | null {
  if (!height || !weight) return null;
  const m = height / 100;
  if (m <= 0) return null;
  return Number((weight / (m * m)).toFixed(1));
}

/** 4.3s → 100, 5.5s → 25, linear; clamped. */
function sprintSub(s: number | null | undefined): number {
  if (s == null || !Number.isFinite(s) || s <= 0) return 0;
  return Math.round(clamp(100 - (s - 4.3) * 62.5));
}
/** 55+ → 100, scales linearly down. */
function pushupsSub(p: number | null | undefined): number {
  if (p == null || !Number.isFinite(p) || p <= 0) return 0;
  return Math.round(clamp((p / 55) * 100));
}
/** 50 BPM → 100, 90 → 30. Lower is better. */
function rhrSub(h: number | null | undefined): number {
  if (h == null || !Number.isFinite(h) || h <= 0) return 0;
  return Math.round(clamp(100 - (h - 50) * 1.75));
}
/** 16.1 → 100, 11 → ~37, 8 → 0. */
function yoyoSub(y: number | null | undefined): number | null {
  if (y == null || !Number.isFinite(y) || y <= 0) return null;
  return Math.round(clamp(((y - 8) / (16.1 - 8)) * 100));
}
/** 450s (7:30) → 100, 510s (8:30) → 80, 600s → ~50. Lower is better. */
function runSub(s: number | null | undefined): number | null {
  if (s == null || !Number.isFinite(s) || s <= 0) return null;
  return Math.round(clamp(100 - (s - 450) / 3));
}
/** Centred on 22.5; ±8 BMI points off centre → near zero. */
function bmiSub(bmi: number | null): number {
  if (bmi == null || !Number.isFinite(bmi)) return 0;
  return Math.round(clamp(100 - Math.abs(bmi - 22.5) * 8));
}

export function calculateFitness(input: FitnessInputs): FitnessBreakdown {
  const bmi = bmiFrom(input.height, input.weight);

  const sprintScore = sprintSub(input.sprint);
  const pushupsScore = pushupsSub(input.pushups);
  const rhrScore = rhrSub(input.rhr);
  const bmiScore = bmiSub(bmi);

  const yoyo = yoyoSub(input.yoyo);
  const run = runSub(input.run2km);
  let enduranceScore = 0;
  if (yoyo != null && run != null) enduranceScore = Math.round((yoyo + run) / 2);
  else if (yoyo != null) enduranceScore = yoyo;
  else if (run != null) enduranceScore = run;

  const fitnessScore = Math.round(
    sprintScore * 0.25 +
    pushupsScore * 0.20 +
    enduranceScore * 0.25 +
    bmiScore * 0.15 +
    rhrScore * 0.15,
  );

  return { bmi, sprintScore, pushupsScore, enduranceScore, bmiScore, rhrScore, fitnessScore };
}

/** Parse "mm:ss" or "m:ss" → seconds. Returns null on garbage. */
export function parseMmSs(input: string): number | null {
  const m = input.match(/^(\d{1,2}):([0-5]\d)$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}
