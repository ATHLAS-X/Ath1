/**
 * TypeScript types for the full ACSI-28 Cricket Development Profile submission.
 *
 * Mirrors the compute service's PsychAnalyzeRequest (psychology.py) and the
 * question bank structure (question_bank.py). Used by:
 *   - POST /api/onboarding/behaviour (server-side validation)
 *   - components/onboarding/PsychAssessmentForm.tsx (client-side form state)
 *
 * NOTE: player_context.competition_level and player_context.age are NOT included
 * in the submission payload — they are injected server-side from the player's
 * existing profile record. The frontend never needs to collect or send them.
 */

// ---------------------------------------------------------------------------
// Question bank types (returned by GET /api/onboarding/behaviour/questionnaire)
// ---------------------------------------------------------------------------

export interface ACSIItem {
  number: number;
  text: string;
  subscale: string;
  reverse_scored: boolean;
}

export interface SubscaleDef {
  name: string;
  item_numbers: number[];
  min_score: number;
  max_score: number;
  low_max: number;
  moderate_max: number;
}

export interface LieScaleItem {
  id: string;
  text: string;
}

export interface Scenario {
  id: string;
  title: string;
  prompt: string;
  options: Record<string, string>; // A, B, C, D → text
}

export interface OpenEndedQuestion {
  id: string;
  text: string;
  min_words: number;
}

export interface QuestionBank {
  instructions: string;
  response_scale: Record<number, string>; // 1-4 → label
  acsi_items: ACSIItem[];
  subscales: Record<string, SubscaleDef>;
  lie_scale_items: LieScaleItem[];
  scenarios: Scenario[];
  open_ended_questions: OpenEndedQuestion[];
}

// ---------------------------------------------------------------------------
// Submission payload (sent by frontend to POST /api/onboarding/behaviour)
// ---------------------------------------------------------------------------

export interface ScenarioResponse {
  selected: "A" | "B" | "C" | "D" | "Other";
  other_text?: string;
}

/**
 * The payload the frontend submits. The server injects additional fields
 * (player_id, player_context.age, player_context.competition_level) before
 * forwarding to the compute service.
 */
export interface PsychSubmissionPayload {
  /** Raw ACSI-28 responses: item number (1-28) → Likert value (1-4). */
  acsi_responses: Record<number, number>;

  /** Scenario selections: scenario_1..scenario_10 → { selected, other_text }. */
  scenario_responses: Record<string, ScenarioResponse>;

  /** Open-ended answers: q1..q5 → text. */
  open_ended_responses: Record<string, string>;

  /** Lie scale: 5 values in order (L1-L5), each 1-4. */
  lie_scale_responses: number[];

  /** Player's primary role (from their profile). */
  primary_role: string;

  /** How many years the player has been playing (optional). */
  years_playing?: number;

  /** Time in minutes the player took to complete the assessment. */
  completion_time_minutes: number;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const VALID_LIKERT = new Set([1, 2, 3, 4]);
const VALID_SELECTIONS = new Set(["A", "B", "C", "D", "Other"]);

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePsychPayload(payload: any): ValidationResult {
  const errors: string[] = [];

  // ACSI-28: exactly items 1-28, each value 1-4
  const acsi = payload?.acsi_responses;
  if (!acsi || typeof acsi !== "object") {
    errors.push("acsi_responses is required");
  } else {
    const keys = Object.keys(acsi).map(Number).sort((a, b) => a - b);
    const expected = Array.from({ length: 28 }, (_, i) => i + 1);
    if (JSON.stringify(keys) !== JSON.stringify(expected)) {
      const missing = expected.filter((k) => !keys.includes(k));
      errors.push(`acsi_responses must cover items 1-28 (missing: ${missing.join(", ")})`);
    }
    for (const [k, v] of Object.entries(acsi)) {
      if (!VALID_LIKERT.has(v as number)) {
        errors.push(`acsi_responses[${k}] must be 1-4, got ${v}`);
      }
    }
  }

  // Scenarios: 10 required
  const scenarios = payload?.scenario_responses;
  if (!scenarios || typeof scenarios !== "object") {
    errors.push("scenario_responses is required");
  } else {
    for (let i = 1; i <= 10; i++) {
      const key = `scenario_${i}`;
      const resp = scenarios[key];
      if (!resp) {
        errors.push(`scenario_responses.${key} is required`);
      } else if (!VALID_SELECTIONS.has(resp.selected)) {
        errors.push(`scenario_responses.${key}.selected must be A, B, C, D, or Other`);
      } else if (resp.selected === "Other" && !resp.other_text?.trim()) {
        errors.push(`scenario_responses.${key}.other_text is required when selected is "Other"`);
      }
    }
  }

  // Open-ended: 5 required, 50 chars minimum
  const openEnded = payload?.open_ended_responses;
  if (!openEnded || typeof openEnded !== "object") {
    errors.push("open_ended_responses is required");
  } else {
    for (let i = 1; i <= 5; i++) {
      const key = `q${i}`;
      const text = openEnded[key];
      if (!text || typeof text !== "string") {
        errors.push(`open_ended_responses.${key} is required`);
      } else if (text.trim().length < 50) {
        errors.push(`open_ended_responses.${key} must be at least 50 characters`);
      }
    }
  }

  // Lie scale: exactly 5 values, each 1-4
  const lie = payload?.lie_scale_responses;
  if (!Array.isArray(lie) || lie.length !== 5) {
    errors.push("lie_scale_responses must be an array of exactly 5 values");
  } else {
    for (let i = 0; i < 5; i++) {
      if (!VALID_LIKERT.has(lie[i])) {
        errors.push(`lie_scale_responses[${i}] must be 1-4, got ${lie[i]}`);
      }
    }
  }

  // completion_time_minutes
  if (typeof payload?.completion_time_minutes !== "number" || payload.completion_time_minutes < 1) {
    errors.push("completion_time_minutes must be a number >= 1");
  }

  return { valid: errors.length === 0, errors };
}