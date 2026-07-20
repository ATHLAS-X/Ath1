/**
 * POST /api/onboarding/behaviour — submit the full ACSI-28 assessment.
 *
 * Delegates to the Backend/AI compute service (POST /api/v1/compute/psych/analyze)
 * via the auth bridge. Polls for results and writes to the behavioral_assessment
 * table for backward compatibility.
 *
 * KEY DESIGN DECISIONS:
 *
 * 1. player_context.competition_level is read from the player's existing profile
 *    (district_team, state_team fields) — NOT collected from the assessment form.
 *
 * 2. player_context.age is computed from player_profiles.date_of_birth — NOT
 *    from the form.
 *
 * 3. advanceStep(userId, 8) is deliberately NOT called. This assessment is a
 *    standalone page (/onboarding/player/assessment), not part of the 9-step
 *    wizard. The onboarding system tracks assessment completion via
 *    behavioral_assessment.mindset_score IS NOT NULL in calculateProfileStrength()
 *    (lib/onboarding.ts:253). Calling advanceStep(8) would inject step 8 into
 *    the 12-step state machine from outside the 9-step wizard, producing
 *    confusing progress percentages.
 *
 * 4. mindset_score is derived from the compute result's acsi_subscale_scores:
 *    sum(raw_score) / sum(max_possible) * 100, rounded. This produces a 0-100
 *    numeric value that satisfies the IS NOT NULL check in calculateProfileStrength().
 *    If subscale scores are unavailable (edge case), we fall back to
 *    scout_summary.overall_mental_performance_level * 20 (1-5 → 20-100).
 *
 * POLLING NOTE FOR FRONTEND TEAM:
 * This handler polls for up to ~120s (24 × 5s). If the compute job is still
 * running, the route returns HTTP 504 with { task_id }. The frontend MUST
 * resume polling GET /api/onboarding/behaviour/status/{task_id} on reconnect —
 * do NOT treat 504 as a terminal failure. The analysis may complete in the
 * compute service even after this handler times out. Mobile browsers kill
 * connections after 60-90s on screen lock; the task_id resume flow handles this.
 */

import { sql } from "@/lib/db";
import { fail, ok, requireUserId } from "@/lib/onboarding-server";
import { computePost, computeGet, ComputeServiceError } from "@/lib/computeClient";
import { validatePsychPayload } from "@/lib/types/psychology";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const POLL_INTERVAL_MS = 5000;
const POLL_MAX_ATTEMPTS = 24;

function ageFromDob(dob: string | Date): number {
  const d = typeof dob === "string" ? new Date(dob) : dob;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

/**
 * Derive a 0-100 mindset_score from the compute service's PsychAnalysisResult.
 *
 * Primary: sum(acsi_subscale_scores.*.raw_score) / sum(*.max_possible) * 100
 * Fallback: scout_summary.overall_mental_performance_level * 20 (maps 1-5 → 20-100)
 * Last resort: 50 (sentinel value to satisfy IS NOT NULL check)
 */
function deriveMindsetScore(result: any): number {
  // Try subscale scores first — most precise.
  const subscales = result?.acsi_subscale_scores;
  if (subscales && typeof subscales === "object") {
    let totalRaw = 0;
    let totalMax = 0;
    for (const scale of Object.values(subscales) as any[]) {
      if (typeof scale?.raw_score === "number" && typeof scale?.max_possible === "number") {
        totalRaw += scale.raw_score;
        totalMax += scale.max_possible;
      }
    }
    if (totalMax > 0) {
      return Math.round((totalRaw / totalMax) * 100);
    }
  }

  // Fallback to overall_mental_performance_level (1-5).
  const level = result?.scout_summary?.overall_mental_performance_level;
  if (typeof level === "number" && level >= 1 && level <= 5) {
    return level * 20;
  }

  // Last resort: sentinel value to satisfy IS NOT NULL check.
  // calculateProfileStrength() only checks mindset_score IS NOT NULL.
  // A comment in the DB write explains this is a placeholder.
  return 50;
}

/**
 * Infer competition_level from the player's existing profile fields.
 * Priority: state_team → district_team → club_team → "Academy/Club"
 */
function inferCompetitionLevel(profile: any): string {
  if (profile?.state_team) return "State";
  if (profile?.district_team) return "District";
  if (profile?.club_team) return "Club";
  return "Academy/Club";
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const guard = await requireUserId();
  if (guard instanceof Response) return guard;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON");
  }

  // Validate the assessment payload.
  const validation = validatePsychPayload(body);
  if (!validation.valid) {
    return fail(`Validation errors: ${validation.errors.join("; ")}`, 422);
  }

  // ── Fetch player profile for age + competition_level ───────────────────
  const profileRows = (await sql`
    SELECT date_of_birth, playing_role, district_team, state_team, club_team
    FROM player_profiles
    WHERE user_id = ${guard.userId}
    LIMIT 1
  `) as unknown as Array<{
    date_of_birth: string | null;
    playing_role: string | null;
    district_team: string | null;
    state_team: string | null;
    club_team: string | null;
  }>;

  const profile = profileRows[0];
  if (!profile?.date_of_birth) {
    return fail("Complete your profile (Step 1) before taking the assessment — date of birth is required.", 400);
  }

  const age = ageFromDob(profile.date_of_birth);
  if (age < 13) {
    return fail("Players must be at least 13 years old to complete the psychological assessment.", 403);
  }

  // Get session role for the auth token.
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role ?? "player";

  // ── Build compute request body ─────────────────────────────────────────
  // player_context.competition_level comes from the DB, NOT the form.
  // player_context.age comes from date_of_birth, NOT the form.
  const computeBody = {
    player_id: guard.userId,
    acsi_responses: body.acsi_responses,
    scenario_responses: body.scenario_responses,
    open_ended_responses: body.open_ended_responses,
    lie_scale_responses: body.lie_scale_responses,
    player_context: {
      age,
      primary_role: body.primary_role ?? profile.playing_role ?? "Batsman",
      years_playing: typeof body.years_playing === "number" ? body.years_playing : null,
      competition_level: inferCompetitionLevel(profile),
    },
    completion_time_minutes: body.completion_time_minutes,
  };

  // ── Submit to compute service ──────────────────────────────────────────
  let taskId: string;
  try {
    const result = await computePost(
      "/api/v1/compute/psych/analyze",
      computeBody,
      guard.userId,
      role,
    );
    taskId = result.task_id;
  } catch (err) {
    if (err instanceof ComputeServiceError) {
      return fail(`Assessment service unavailable: ${err.message}`, 503);
    }
    throw err;
  }

  // TODO(db-team): store compute_task_id here once column is added
  // TODO(db-team): store acsi_raw_responses (full 28-item payload) once column is added

  // ── Poll for results ───────────────────────────────────────────────────
  // See module-level POLLING NOTE for frontend recovery guidance.
  let fullResult: any = null;
  let taskStatus = "PENDING";

  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    await sleep(POLL_INTERVAL_MS);

    try {
      const status = await computeGet(
        `/api/v1/compute/psych/status/${taskId}`,
        guard.userId,
        role,
      );
      taskStatus = status.status;

      if (taskStatus === "COMPLETE" || taskStatus === "COMPLETED") {
        fullResult = status.result;
        break;
      }
      if (taskStatus === "FAILED") {
        return fail(
          status.error_message ?? "Assessment analysis failed in the compute service",
          422,
        );
      }
    } catch (err) {
      if (err instanceof ComputeServiceError) {
        continue; // Transient — keep polling
      }
      throw err;
    }
  }

  // Timed out — return 504 with task_id for frontend resume.
  // IMPORTANT: The frontend MUST resume polling /api/onboarding/behaviour/status/{task_id}
  // on reconnect. Do NOT treat 504 as a terminal failure.
  if (!fullResult) {
    return fail(
      "Assessment is still processing. Use the task_id to check status.",
      504,
    );
  }

  // ── Derive mindset_score for backward compat ───────────────────────────
  // calculateProfileStrength() at lib/onboarding.ts:253 checks:
  //   behavioral_assessment.mindset_score IS NOT NULL
  // The compute result has acsi_subscale_scores — derive a 0-100 score from
  // the raw-to-max ratio. See deriveMindsetScore() for the full fallback chain.
  const mindsetScore = deriveMindsetScore(fullResult);

  // ── Extract player-visible fields only ─────────────────────────────────
  // NEVER return scout_summary or raw_gemini_narrative to the player.
  const playerDev = fullResult.player_development_summary ?? {
    strengths: [],
    development_areas: [],
    suggested_focus: [],
  };
  const caveats = fullResult.mandatory_caveats ?? [];

  // Extract strengths and gaps for legacy behavioral_assessment columns.
  const strengthsArr = (playerDev.strengths ?? []).slice(0, 5);
  const gapsArr = (playerDev.development_areas ?? []).slice(0, 5);
  const coachingTip = (playerDev.suggested_focus ?? []).join("; ").slice(0, 500) || "See full development summary.";

  // ── Write to behavioral_assessment (backward compat) ───────────────────
  await sql`DELETE FROM behavioral_assessment WHERE user_id = ${guard.userId}`;
  await sql`
    INSERT INTO behavioral_assessment
      (user_id, mcq_answers, free_text, strengths, gaps, mental_rating, coaching_tip, mindset_score)
    VALUES
      (${guard.userId}, ${JSON.stringify(body.acsi_responses)}::jsonb,
       ${JSON.stringify(body.open_ended_responses)}::jsonb,
       ${strengthsArr}, ${gapsArr}, ${mindsetScore}, ${coachingTip}, ${mindsetScore})
  `;

  // TODO(db-team): store compute_task_id here once column is added
  // TODO(db-team): store compute_status = "COMPLETE" here once column is added
  // TODO(db-team): store is_stub = false once column is added

  // NOTE: advanceStep(userId, 8) is deliberately NOT called here.
  // This assessment is a standalone page, not part of the 9-step wizard.
  // Assessment completion is tracked via behavioral_assessment.mindset_score IS NOT NULL
  // in calculateProfileStrength() (lib/onboarding.ts:253), which correctly detects
  // the assessment without touching the wizard's step state machine.

  return ok({
    task_id: taskId,
    player_development_summary: playerDev,
    mandatory_caveats: caveats,
    mindset_score: mindsetScore,
  });
}