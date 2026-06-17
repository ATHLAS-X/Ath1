/**
 * Shared metadata for the 12-step onboarding journey.
 * Used by the layout, step router, StepShell timeline, and API routes.
 */

export interface OnboardingStepMeta {
  step: number;
  slug: string;
  name: string;
  short: string;
  componentName: string;
  /** Datastore fields surfaced in the green "system" bar at the bottom of StepShell. */
  systemFields: string[];
}

export const ONBOARDING_STEPS: OnboardingStepMeta[] = [
  { step: 1,  slug: "register",       name: "Register",        short: "Register",   componentName: "StepRegister",    systemFields: ["users.id", "users.email", "users.role"] },
  { step: 2,  slug: "aadhaar",        name: "Aadhaar Verify",  short: "Aadhaar",    componentName: "StepAadhaar",     systemFields: ["aadhaar_verification.masked_aadhaar", "verified_dob", "age_verified", "verification_pts"] },
  { step: 3,  slug: "minor-guard",    name: "Guardian Consent",short: "Guardian",   componentName: "StepMinorGuard",  systemFields: ["guardian_consent.parent_phone_verified", "disclaimer_signed", "minor_flag", "verification_pts"] },
  { step: 4,  slug: "role",           name: "Player Role",     short: "Role",       componentName: "StepRole",        systemFields: ["cricket_profile.player_role", "batting_style", "bowling_style", "dashboard_template"] },
  { step: 5,  slug: "stats",          name: "Performance Stats", short: "Stats",    componentName: "StepStats",       systemFields: ["performance_stats.matches", "runs", "wickets", "powerplay_sr", "economy"] },
  { step: 6,  slug: "match-log",      name: "Match Log",       short: "Match Log",  componentName: "StepMatchLog",    systemFields: ["match_logs.opponent", "match_date", "scorecard_url", "ocr_status", "mqi_tag"] },
  { step: 7,  slug: "fitness",        name: "Fitness",         short: "Fitness",    componentName: "StepFitness",     systemFields: ["fitness_data.sprint_time", "pushups_60s", "yoyo_level", "bmi", "fitness_score"] },
  { step: 8,  slug: "behaviour",      name: "Behaviour",       short: "Behaviour",  componentName: "StepBehaviour",   systemFields: ["behavioral_assessment.mcq_answers", "mental_rating", "mindset_score"] },
  { step: 9,  slug: "video-ai",       name: "Video AI",        short: "Video AI",   componentName: "StepVideoAI",     systemFields: ["video_analysis.batting_style", "wrist_movement", "foot_work", "strong_points", "weak_points"] },
  { step: 10, slug: "coach-verify",   name: "Coach Verify",    short: "Coach",      componentName: "StepCoachVerify", systemFields: ["coach_registry.coach_name", "official_id", "cert_url", "coach_status"] },
  { step: 11, slug: "score",          name: "SportX Score",    short: "Score",      componentName: "StepScore",       systemFields: ["sportx_score.total_score", "profile_strength", "roadmap", "score_history"] },
  { step: 12, slug: "discover",       name: "Discover",        short: "Discover",   componentName: "StepDiscover",    systemFields: ["onboarding_progress.status = COMPLETED", "/dashboard"] },
];

export const TOTAL_ONBOARDING_STEPS = ONBOARDING_STEPS.length;

export function getStepMeta(step: number): OnboardingStepMeta | null {
  return ONBOARDING_STEPS.find((s) => s.step === step) ?? null;
}
