/**
 * Shared data shapes consumed by the PlayerDashboard sections.
 * All rows are the raw NeonDB shapes — sections format/derive as needed.
 */

export interface DashboardUser {
  id: string;
  name: string;
  email?: string | null;
  created_at?: string | null;
}

export interface DashboardGuardian {
  parent_phone_verified: boolean | null;
  disclaimer_signed: boolean | null;
  verification_pts: number | null;
}

export interface DashboardPlayerProfile {
  city: string | null;
  state: string | null;
  district: string | null;
  date_of_birth: string | null;
  playing_role: string | null;
  batting_style: string | null;
  bowling_style: string | null;
  matches_played: number;
  runs_scored: number;
  wickets_taken: number;
  highest_score: number;
  best_bowling: string | null;
  bio: string | null;
  avatar_url: string | null;
  coach_verified: boolean | null;
  score_weights: Record<string, number> | null;
}

export interface DashboardCricketProfile {
  player_role: string | null;
  batting_style: string | null;
  bowling_style: string | null;
  phase_specialty: string | null;
}

export interface DashboardPerformanceStat {
  format: string;
  matches: number;
  innings: number;
  runs: number;
  not_outs: number;
  highest_score: number;
  fifties: number;
  hundreds: number;
  powerplay_sr: number | null;
  middle_avg: number | null;
  death_sr: number | null;
  overs_bowled: number;
  wickets: number;
  economy: number | null;
  bowl_avg: number | null;
  bowl_sr: number | null;
  best_figures: string | null;
  bpi: number | null;
  cbr: number | null;
}

export interface DashboardMatchLog {
  id: string;
  opponent: string;
  match_date: string;
  format: string;
  competition_level: string;
  mqi_tag: string;
  mqi_weight: number;
  runs_scored: number | null;
  wickets_taken: number | null;
  scorecard_url: string;
  ocr_status: string;
  verification_pts: number;
  created_at: string;
}

export interface DashboardFitness {
  sprint_time: number | null;
  pushups_60s: number | null;
  resting_hr_bpm: number | null;
  yoyo_level: number | null;
  run_2km_time: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  bmi: number | null;
  fitness_score: number | null;
  medical_cert_url: string | null;
}

export interface DashboardBehaviour {
  strengths: string[] | null;
  gaps: string[] | null;
  mental_rating: number | null;
  coaching_tip: string | null;
  mindset_score: number | null;
}

export interface DashboardVideo {
  video_url: string | null;
  youtube_video_id: string | null;
  batting_style: string | null;
  wrist_movement: string | null;
  foot_work: string | null;
  bowling_action: string | null;
  strong_points: string[] | null;
  weak_points: string[] | null;
  style_classification: string | null;
  technique_notes: string | null;
}

export interface DashboardScore {
  total_score: number;
  performance_score: number;
  experience_score: number;
  fitness_score: number;
  verification_score: number;
  mindset_score: number;
  profile_score: number;
  verification_pts: number;
  trajectory_boost: boolean;
  coach_verified: boolean;
  profile_strength: "STRONG" | "MID" | "WEAK" | null;
  roadmap: Array<{ title: string; reward: string }> | null;
  status?: string | null;
}

export interface DashboardAadhaar {
  age_verified: boolean | null;
  verified_dob: string | null;
  verification_pts: number | null;
}

export interface DashboardCoach {
  coach_name: string | null;
  academy_club: string | null;
  coach_status: string | null;
  approved_at: string | null;
}

export interface DashboardData {
  user: DashboardUser;
  profile: DashboardPlayerProfile | null;
  cricket: DashboardCricketProfile | null;
  performance: DashboardPerformanceStat[];
  matches: DashboardMatchLog[];
  fitness: DashboardFitness | null;
  behaviour: DashboardBehaviour | null;
  video: DashboardVideo | null;
  score: DashboardScore | null;
  aadhaar: DashboardAadhaar | null;
  guardian: DashboardGuardian | null;
  coach: DashboardCoach | null;
  isOwner: boolean;
}

/**
 * Sporting palette tokens — punched-up neons against deep navy/black.
 *
 *   primary    Lime/sport-court green (signature)
 *   secondary  Electric track-blue
 *   tertiary   Stadium-floodlight amber
 *   accent     Hot magenta (mindset / momentum)
 *   gold       Trophy gold (achievements + highlights)
 *   danger     Crimson red (warnings)
 *
 * The three gradient strings are reused across hero rings, category bars,
 * and section accent stripes so the visual language reads as one system.
 */
export const DASH_THEME = {
  /**
   * SWATCH PALETTE
   *   #0485F7  azure blue   — info / secondary
   *   #EF4444 red          — danger
   *   #F59E0B  amber        — warning
   *   #10B981 emerald      — primary / success
   *   #D946EF fuchsia      — accent / mindset
   */
  bg: "#050D18",
  card: "#0A1424",
  cardSunken: "#070E1C",
  border: "#1E3A5F",
  borderHover: "#2D4F7C",
  primary: "#10B981",      // emerald — success
  primaryDeep: "#059669",
  secondary: "#0485F7",    // azure — info/secondary
  secondaryDeep: "#0369A1",
  tertiary: "#F59E0B",     // amber — warning
  accent: "#D946EF",       // fuchsia — accent
  gold: "#F59E0B",
  text: "#F1F5F9",
  textSecondary: "#94A3B8",
  textMuted: "#475569",
  danger: "#EF4444",       // red
  /* Signature gradients — all built from the 5 swatch colours */
  gradPrimary: "linear-gradient(135deg, #10B981 0%, #0485F7 100%)",
  gradHot: "linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)",
  gradCool: "linear-gradient(135deg, #0485F7 0%, #D946EF 100%)",
  gradGold: "linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)",
  /**
   * SOLID PALETTE — flat colours used for tags, badges, notes, buttons.
   * Every value comes from the 5-colour swatch palette.
   */
  solidSuccess: "#10B981",       // emerald
  solidSuccessBorder: "#059669",
  solidWarning: "#F59E0B",       // amber
  solidWarningBorder: "#B45309",
  solidInfo: "#0485F7",          // azure
  solidInfoBorder: "#0369A1",
  solidBlue: "#0485F7",          // alias for info
  solidBlueBorder: "#0369A1",
  solidDestructive: "#EF4444",   // red
  solidDestructiveBorder: "#B91C1C",
  solidPink: "#D946EF",          // fuchsia
  solidPinkBorder: "#A21CAF",
  solidNeutral: "#475569",       // slate (derived neutral)
  solidNeutralBorder: "#334155",
  solidFg: "#FFFFFF",
} as const;
