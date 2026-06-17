/**
 * Onboarding helpers for the 12-step player workflow.
 *
 * Tables touched: onboarding_progress, aadhaar_verification, guardian_consent,
 * cricket_profile, performance_stats, match_logs, fitness_data,
 * behavioral_assessment, video_analysis, coach_registry, sportx_score.
 *
 * All functions are server-only — they import `sql` from "@/lib/db", which
 * runs against NeonDB. Do not import this module from client components.
 */

import { sql } from "@/lib/db";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type OnboardingStatus = "DRAFT" | "IN_PROGRESS" | "COMPLETED";
export type ProfileStrength = "STRONG" | "MID" | "WEAK";

export const TOTAL_ONBOARDING_STEPS = 12;

export interface OnboardingState {
  userId: string;
  currentStep: number;
  status: OnboardingStatus;
  completedSteps: number[];
  totalSteps: number;
  percentComplete: number;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface VerificationBreakdown {
  total: number;
  aadhaar: number;
  guardian: number;
  matchLogs: number;
}

// -----------------------------------------------------------------------------
// getUserOnboardingState
// -----------------------------------------------------------------------------

/**
 * Fetch the onboarding progress for a user. Lazily creates a DRAFT row on
 * first call so callers never have to deal with a missing record.
 */
export async function getUserOnboardingState(userId: string): Promise<OnboardingState> {
  if (!userId) throw new Error("getUserOnboardingState: userId is required");

  const existing = (await sql`
    SELECT user_id, current_step, status, completed_steps, created_at, updated_at
    FROM onboarding_progress
    WHERE user_id = ${userId}
    LIMIT 1
  `) as unknown as Array<{
    user_id: string;
    current_step: number;
    status: string;
    completed_steps: number[] | null;
    created_at: Date;
    updated_at: Date;
  }>;

  let row = existing[0];
  if (!row) {
    const inserted = (await sql`
      INSERT INTO onboarding_progress (user_id, current_step, status, completed_steps)
      VALUES (${userId}, 1, 'DRAFT', '{}')
      ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
      RETURNING user_id, current_step, status, completed_steps, created_at, updated_at
    `) as unknown as Array<typeof row>;
    row = inserted[0];
  }

  const completed = Array.isArray(row.completed_steps) ? row.completed_steps : [];

  return {
    userId: row.user_id,
    currentStep: row.current_step,
    status: row.status as OnboardingStatus,
    completedSteps: completed,
    totalSteps: TOTAL_ONBOARDING_STEPS,
    percentComplete: Math.min(
      100,
      Math.round((completed.length / TOTAL_ONBOARDING_STEPS) * 100),
    ),
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

// -----------------------------------------------------------------------------
// advanceStep
// -----------------------------------------------------------------------------

/**
 * Mark `step` as completed for the user and advance `current_step` to the
 * next uncompleted step. Idempotent — calling with the same step twice is a
 * no-op. Transitions status: DRAFT → IN_PROGRESS on first completion,
 * IN_PROGRESS → COMPLETED when all 12 steps are done.
 */
export async function advanceStep(
  userId: string,
  step: number,
): Promise<OnboardingState> {
  if (!userId) throw new Error("advanceStep: userId is required");
  if (!Number.isInteger(step) || step < 1 || step > TOTAL_ONBOARDING_STEPS) {
    throw new Error(
      `advanceStep: step must be an integer in [1, ${TOTAL_ONBOARDING_STEPS}], got ${step}`,
    );
  }

  // Ensure a row exists.
  await getUserOnboardingState(userId);

  // Merge step into completed_steps (dedup), recompute current_step and status.
  const updated = (await sql`
    WITH merged AS (
      SELECT
        user_id,
        (
          SELECT ARRAY(
            SELECT DISTINCT s
            FROM unnest(COALESCE(completed_steps, '{}'::int[]) || ARRAY[${step}]::int[]) AS s
            ORDER BY s
          )
        ) AS new_completed
      FROM onboarding_progress
      WHERE user_id = ${userId}
    )
    UPDATE onboarding_progress op
    SET
      completed_steps = m.new_completed,
      current_step = LEAST(${TOTAL_ONBOARDING_STEPS}, COALESCE((
        SELECT MIN(s) FROM generate_series(1, ${TOTAL_ONBOARDING_STEPS}) AS s
        WHERE s <> ALL (m.new_completed)
      ), ${TOTAL_ONBOARDING_STEPS})),
      status = CASE
        WHEN array_length(m.new_completed, 1) >= ${TOTAL_ONBOARDING_STEPS} THEN 'COMPLETED'
        WHEN array_length(m.new_completed, 1) > 0 THEN 'IN_PROGRESS'
        ELSE 'DRAFT'
      END,
      updated_at = NOW()
    FROM merged m
    WHERE op.user_id = m.user_id
    RETURNING op.user_id, op.current_step, op.status, op.completed_steps, op.created_at, op.updated_at
  `) as unknown as Array<{
    user_id: string;
    current_step: number;
    status: string;
    completed_steps: number[] | null;
    created_at: Date;
    updated_at: Date;
  }>;

  const row = updated[0];
  const completed = Array.isArray(row.completed_steps) ? row.completed_steps : [];

  return {
    userId: row.user_id,
    currentStep: row.current_step,
    status: row.status as OnboardingStatus,
    completedSteps: completed,
    totalSteps: TOTAL_ONBOARDING_STEPS,
    percentComplete: Math.min(
      100,
      Math.round((completed.length / TOTAL_ONBOARDING_STEPS) * 100),
    ),
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

// -----------------------------------------------------------------------------
// calculateVerificationPts
// -----------------------------------------------------------------------------

/**
 * Sum verification_pts across all tables that track them
 * (aadhaar_verification, guardian_consent, match_logs).
 */
export async function calculateVerificationPts(
  userId: string,
): Promise<VerificationBreakdown> {
  if (!userId) throw new Error("calculateVerificationPts: userId is required");

  const rows = (await sql`
    SELECT
      COALESCE((
        SELECT SUM(verification_pts) FROM aadhaar_verification WHERE user_id = ${userId}
      ), 0)::int AS aadhaar,
      COALESCE((
        SELECT SUM(verification_pts) FROM guardian_consent WHERE user_id = ${userId}
      ), 0)::int AS guardian,
      COALESCE((
        SELECT SUM(verification_pts) FROM match_logs WHERE user_id = ${userId}
      ), 0)::int AS match_logs
  `) as unknown as Array<{ aadhaar: number; guardian: number; match_logs: number }>;

  const r = rows[0] ?? { aadhaar: 0, guardian: 0, match_logs: 0 };
  const total = r.aadhaar + r.guardian + r.match_logs;
  return { total, aadhaar: r.aadhaar, guardian: r.guardian, matchLogs: r.match_logs };
}

// -----------------------------------------------------------------------------
// calculateProfileStrength
// -----------------------------------------------------------------------------

/**
 * Profile strength is derived from the count of *verified* signals the player
 * has accumulated. We count each of these (max 1 per category):
 *
 *   1. Aadhaar age verified                       (aadhaar_verification.age_verified)
 *   2. Guardian disclaimer signed (minors)        (guardian_consent.disclaimer_signed)
 *   3. Cricket profile filled                     (cricket_profile exists)
 *   4. At least one performance_stats row         (performance_stats)
 *   5. At least one OCR-verified match log        (match_logs.ocr_status = 'VERIFIED')
 *   6. Fitness data with fitness_score recorded   (fitness_data.fitness_score)
 *   7. Behavioral assessment with mindset_score   (behavioral_assessment.mindset_score)
 *   8. Video analysis completed                   (video_analysis.video_analysed)
 *   9. At least one approved coach endorsement    (coach_registry.coach_status = 'APPROVED')
 *
 * Thresholds: STRONG ≥ 7, MID ≥ 4, else WEAK.
 */
export async function calculateProfileStrength(
  userId: string,
): Promise<{ strength: ProfileStrength; verifiedCount: number; checks: Record<string, boolean> }> {
  if (!userId) throw new Error("calculateProfileStrength: userId is required");

  const rows = (await sql`
    SELECT
      EXISTS (
        SELECT 1 FROM aadhaar_verification WHERE user_id = ${userId} AND age_verified = true
      ) AS aadhaar_ok,
      EXISTS (
        SELECT 1 FROM guardian_consent WHERE user_id = ${userId} AND disclaimer_signed = true
      ) AS guardian_ok,
      EXISTS (
        SELECT 1 FROM cricket_profile WHERE user_id = ${userId}
      ) AS cricket_ok,
      EXISTS (
        SELECT 1 FROM performance_stats WHERE user_id = ${userId}
      ) AS stats_ok,
      EXISTS (
        SELECT 1 FROM match_logs WHERE user_id = ${userId} AND ocr_status = 'VERIFIED'
      ) AS match_log_ok,
      EXISTS (
        SELECT 1 FROM fitness_data WHERE user_id = ${userId} AND fitness_score IS NOT NULL
      ) AS fitness_ok,
      EXISTS (
        SELECT 1 FROM behavioral_assessment WHERE user_id = ${userId} AND mindset_score IS NOT NULL
      ) AS mindset_ok,
      EXISTS (
        SELECT 1 FROM video_analysis WHERE user_id = ${userId} AND video_analysed = true
      ) AS video_ok,
      EXISTS (
        SELECT 1 FROM coach_registry WHERE user_id = ${userId} AND coach_status = 'APPROVED'
      ) AS coach_ok
  `) as unknown as Array<{
    aadhaar_ok: boolean;
    guardian_ok: boolean;
    cricket_ok: boolean;
    stats_ok: boolean;
    match_log_ok: boolean;
    fitness_ok: boolean;
    mindset_ok: boolean;
    video_ok: boolean;
    coach_ok: boolean;
  }>;

  const r = rows[0] ?? ({} as any);
  const checks: Record<string, boolean> = {
    aadhaar: !!r.aadhaar_ok,
    guardian: !!r.guardian_ok,
    cricketProfile: !!r.cricket_ok,
    performanceStats: !!r.stats_ok,
    matchLogVerified: !!r.match_log_ok,
    fitness: !!r.fitness_ok,
    mindset: !!r.mindset_ok,
    videoAnalysis: !!r.video_ok,
    coachEndorsed: !!r.coach_ok,
  };
  const verifiedCount = Object.values(checks).filter(Boolean).length;

  let strength: ProfileStrength = "WEAK";
  if (verifiedCount >= 7) strength = "STRONG";
  else if (verifiedCount >= 4) strength = "MID";

  return { strength, verifiedCount, checks };
}
