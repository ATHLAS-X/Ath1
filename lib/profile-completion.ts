/**
 * Profile completion model.
 *
 * Five required categories total to 100%. Optional categories give "bonus"
 * pills shown next to the meter but do not raise the bar past 100%.
 */

export interface ProfileSnapshot {
  /* Step 1 + 2 fields */
  first_name?: string | null;
  last_name?: string | null;
  date_of_birth?: string | Date | null;
  gender?: string | null;
  state?: string | null;
  height_cm?: number | string | null;
  weight_kg?: number | string | null;

  /* Step 3 */
  playing_role?: string | null;
  batting_style?: string | null;
  bowling_style?: string | null;

  /* Step 5 */
  media_count?: number;

  /* Step 6 (performance summary) */
  matches_played?: number | null;
  runs_scored?: number | null;
  wickets_taken?: number | null;

  /* Step 7 (optional bonus) */
  yoyo_score?: number | string | null;
  sprint_30m?: number | string | null;
  run_2km?: number | string | null;

  /* Other bonus signals */
  coach_evaluation_present?: boolean;
}

const REQUIRED_CATEGORIES = [
  "Basic Profile",
  "Cricket Profile",
  "Videos",
  "Performance Stats",
  "Height & Weight",
] as const;

const OPTIONAL_CATEGORIES = [
  "YoYo Score",
  "30m Sprint",
  "2km Run",
  "Coach Evaluation",
] as const;

export type CategoryName =
  | (typeof REQUIRED_CATEGORIES)[number]
  | (typeof OPTIONAL_CATEGORIES)[number];

export interface CompletionResult {
  pct: number;                            // 0-100 (required only)
  required: Array<{ name: string; done: boolean }>;
  optional: Array<{ name: string; done: boolean }>;
  done_required: number;
  total_required: number;
}

function isPresent(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return Number.isFinite(v);
  return Boolean(v);
}

export function calcProfileCompletion(s: ProfileSnapshot): CompletionResult {
  const checks: Record<CategoryName, boolean> = {
    "Basic Profile":
      isPresent(s.first_name) &&
      isPresent(s.last_name) &&
      isPresent(s.date_of_birth) &&
      isPresent(s.gender) &&
      isPresent(s.state),
    "Cricket Profile":
      isPresent(s.playing_role) &&
      isPresent(s.batting_style) &&
      isPresent(s.bowling_style),
    "Videos": (s.media_count ?? 0) > 0,
    "Performance Stats":
      isPresent(s.matches_played) &&
      (isPresent(s.runs_scored) || isPresent(s.wickets_taken)),
    "Height & Weight": isPresent(s.height_cm) && isPresent(s.weight_kg),
    "YoYo Score": isPresent(s.yoyo_score),
    "30m Sprint": isPresent(s.sprint_30m),
    "2km Run": isPresent(s.run_2km),
    "Coach Evaluation": Boolean(s.coach_evaluation_present),
  };

  const required = REQUIRED_CATEGORIES.map((n) => ({ name: n, done: checks[n] }));
  const optional = OPTIONAL_CATEGORIES.map((n) => ({ name: n, done: checks[n] }));
  const done_required = required.filter((r) => r.done).length;
  const pct = Math.round((done_required / required.length) * 100);

  return { pct, required, optional, done_required, total_required: required.length };
}

/* Doc verification ladder, mapped to the integer column on player_profiles. */
export const VERIFICATION_LEVELS = [
  { level: 1, name: "Self Registered",     desc: "Profile created" },
  { level: 2, name: "Identity Verified",   desc: "Aadhaar verified" },
  { level: 3, name: "Performance Verified", desc: "Scorecards approved by AthlasX" },
  { level: 4, name: "Scout Verified",      desc: "Endorsed by a verified scout" },
] as const;

export function getVerificationLevelMeta(level: number) {
  return VERIFICATION_LEVELS.find((v) => v.level === level) ?? VERIFICATION_LEVELS[0];
}

export function isMinor(dob: string | Date | null | undefined): boolean {
  if (!dob) return false;
  const d = typeof dob === "string" ? new Date(dob) : dob;
  if (isNaN(d.getTime())) return false;
  const ageMs = Date.now() - d.getTime();
  const ageYears = ageMs / (1000 * 60 * 60 * 24 * 365.25);
  return ageYears < 18;
}
