/**
 * Full ACSI-28 based psychological assessment payload sent to the compute service.
 * Matches the compute service's PsychSubmissionPayload schema exactly.
 */
export interface PsychSubmissionPayload {
  /** 28 ACSI items (q1–q28), each scored 1 (Almost Never) – 4 (Almost Always) */
  acsi_responses: Record<string, 1 | 2 | 3 | 4>;
  /** 10 cricket scenarios (s1–s10) — selected option + optional free text if OTHER */
  scenario_responses: Record<string, { selected_option: "A" | "B" | "C" | "D"; open_ended_text?: string }>;
  /** 5 open-ended reflection responses (q1–q5), each ≥ 50 chars */
  open_ended_responses: Record<string, string>;
  /** 5 lie-scale items (l1–l5) embedded in Section A — kept separate for compute service */
  lie_scale_responses: Record<string, 1 | 2 | 3 | 4>;
  /** Player context sent alongside the assessment for Gemini's interpretation */
  player_context: {
    age: number;
    primary_role: string;
    years_playing: number;
    competition_level: string;
  };
}

export interface ComputeTaskResponse {
  task_id: string;
  status: "PENDING" | "PROCESSING" | "COMPLETE" | "FAILED";
  result?: unknown;
  error_code?: string;
  message?: string;
}
