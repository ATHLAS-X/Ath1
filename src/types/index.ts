// ─── Roles ────────────────────────────────────────────────────────────────────
export type UserRole =
  | 'player'
  | 'selection_panel'
  | 'coach'
  | 'association'
  | 'athlasx_ops'
  | 'academy_admin'

// ─── Cricket enums ────────────────────────────────────────────────────────────
export type BattingStyle = 'Right-handed' | 'Left-handed'
export type BowlingStyle =
  | 'Right-arm Fast'
  | 'Right-arm Medium'
  | 'Right-arm Off-spin'
  | 'Right-arm Leg-spin'
  | 'Left-arm Fast'
  | 'Left-arm Medium'
  | 'Left-arm Orthodox'
  | 'Left-arm Unorthodox'
  | 'None'
export type PlayingRole = 'Batsman' | 'Bowler' | 'All-rounder' | 'Wicket-keeper Batsman'
export type Format = 'T20' | 'ODI' | 'Test' | 'T10'
export type TournamentLevel = 'local' | 'district' | 'state' | 'national'
export type AssociationType = 'state' | 'district'
export type IngestMethod = 'api_sync' | 'structured_parser' | 'ocr' | 'excel_mapper' | 'manual'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'
export type ClaimStatus = 'unclaimed' | 'pending_verification' | 'claimed'
export type ConsentStatus = 'not_required' | 'pending' | 'granted' | 'withdrawn'
export type GradeStatus = 'not_started' | 'in_progress' | 'submitted'
export type SelectionStatus = 'open' | 'grading' | 'converging' | 'locked'
export type FlagType = 'form_drop' | 'skill_below_threshold' | 'on_form' | 'none'

// ─── User account (optional — most players never have one) ────────────────────
export interface User {
  id: string
  email: string
  role: UserRole
  linked_player_id?: string   // set when role = player
  linked_staff_id?: string    // set when role = coach | selection_panel | association | athlasx_ops
  created_at: string
}

// ─── Association ──────────────────────────────────────────────────────────────
export interface Association {
  id: string
  name: string
  type: AssociationType
  parent_id?: string          // district → state parent
  state: string
  affiliated_districts?: string[]
  cricheroes_association_id?: string
  data_sharing_signed: boolean
  created_at: string
}

// ─── Player — exists independently of any User account ───────────────────────
export interface PlayerProfile {
  id: string
  user_id?: string            // nullable — shadow profiles have no account
  full_name: string
  dob: string
  district: string
  state: string
  claim_status: ClaimStatus
  consent_status: ConsentStatus
  guardian_phone?: string     // required when under-18
  playing_role?: PlayingRole
  batting_style?: BattingStyle
  bowling_style?: BowlingStyle
  preferred_formats?: Format[]
  academy?: string
  avatar_url?: string
  footage_urls?: string[]     // batting / bowling / keeping clips
  bio?: string
  athlasx_score?: number      // TQI-weighted composite score
  profile_source: 'ingest' | 'self_registered'
  association_id?: string     // supplying association for shadow profiles
  created_at: string
  updated_at: string
}

// ─── Academy registry ─────────────────────────────────────────────────────────
export interface Academy {
  id: string
  name: string                // canonical name
  name_variants: string[]     // abbreviations, Hindi/English variants, branch suffixes
  district: string
  state: string
  verified: boolean
  players_at_district_plus: number  // production record
  created_at: string
}

// ─── Tournament / Match / Performance — provenance on every row ───────────────
export interface Tournament {
  id: string
  association_id: string
  name: string
  season: string
  format: Format
  age_category: string        // U14 / U16 / U19 / U23 / Open
  level: TournamentLevel
  start_date: string
  end_date?: string
}

export interface Match {
  id: string
  tournament_id: string
  date: string
  home_team: string
  away_team: string
  venue: string
  source: string              // cricheroes | scorecard_pdf | manual
  confidence: number          // 0–1
  ingest_method: IngestMethod
  association_approval_status: ApprovalStatus
}

export interface Performance {
  id: string
  match_id: string
  player_id: string
  // Batting
  batting_runs?: number
  batting_balls?: number
  batting_fours?: number
  batting_sixes?: number
  batting_dismissed?: boolean
  // Bowling
  bowling_overs?: number
  bowling_wickets?: number
  bowling_runs_conceded?: number
  bowling_maidens?: number
  // Fielding (successes only — misses/drops not tracked in scorecards)
  catches?: number
  stumpings?: number
  run_outs?: number
  // Provenance — travels with every row
  source: string
  ingest_method: IngestMethod
  confidence_score: number    // 0–1
  association_approval_status: ApprovalStatus
}

export interface BattingStats {
  id: string
  player_id: string
  format: Format
  matches: number
  innings: number
  runs: number
  highest_score: number
  average: number
  strike_rate: number
  hundreds: number
  fifties: number
  fours: number
  sixes: number
  not_outs: number
}

export interface BowlingStats {
  id: string
  player_id: string
  format: Format
  matches: number
  innings: number
  wickets: number
  economy: number
  average: number
  strike_rate: number
  best_bowling: string
  five_wickets: number
  four_wickets: number
  maidens: number
  overs: number
}

// ─── Trial cycle ──────────────────────────────────────────────────────────────
export interface TrialCycle {
  id: string
  association_id: string
  age_category: string
  dob_window_start: string
  dob_window_end: string
  fee_amount: number
  registration_opens: string
  registration_closes: string
  venues: TrialVenue[]
  status: 'upcoming' | 'registration_open' | 'registration_closed' | 'in_progress' | 'completed'
  created_at: string
}

export interface TrialVenue {
  id: string
  trial_cycle_id: string
  name: string
  district: string
  date: string
  mandal?: string
}

// ─── Registration (player → trial cycle) ─────────────────────────────────────
export interface Registration {
  id: string
  trial_cycle_id: string
  player_id: string
  venue_id: string
  fee_status: 'pending' | 'paid' | 'waived'
  documents_uploaded: boolean
  footage_attached: boolean
  checked_in: boolean
  created_at: string
}

// ─── Dossier ──────────────────────────────────────────────────────────────────
export interface Dossier {
  id: string
  registration_id: string
  player_id: string
  trial_cycle_id: string
  generated_at: string        // immutable once issued
  has_match_history: boolean
  percentile_vs_cohort?: number
  contents_snapshot: DossierContents
}

export interface DossierContents {
  batting_0_to_10?: number    // derived from verified scorecard data only
  bowling_0_to_10?: number    // derived from verified scorecard data only
  // fielding/keeping deliberately excluded — scorecard data incomplete
  match_count: number
  data_sources: string[]      // e.g. ["CricHeroes · 12 matches", "District scorecard · 3 matches"]
  cohort_size: number
  recent_form?: string        // last 4 matches summary
}

// ─── Selection committee (W4) ─────────────────────────────────────────────────
export interface SelectionSession {
  id: string
  trial_cycle_id: string
  association_id: string
  status: SelectionStatus
  chair_id: string            // the selector who can unlock convergence
  squad_size_target: number   // typically 20–30
  convergence_unlocked_at?: string
  squad_locked_at?: string
  created_at: string
}

export interface Grade {
  id: string
  selection_session_id: string
  selector_id: string         // User id of the selector
  player_id: string
  overall_grade: number       // 1–10
  notes?: string
  status: GradeStatus
  submitted_at?: string
  // Blind until convergence — only visible after convergence_unlocked_at is set
}

export interface ConvergenceView {
  player_id: string
  grades: number[]            // all submitted grades
  average: number
  distribution: Record<string, number>  // "9": 2, "7": 1 — show distribution not just avg
  consensus: 'unanimous' | 'split' | 'contested'
}

export interface Selection {
  id: string
  selection_session_id: string
  player_id: string
  rationale: string           // required, 1-2 sentences
  decided_at: string          // immutable
  decided_by: string[]        // selector user ids
}

export interface OmissionRationale {
  id: string
  selection_session_id: string
  player_id: string
  rationale: string
  decided_at: string
  // Optional — off by default, association-controlled toggle
}

// ─── In-season weekly tracking (W5) ──────────────────────────────────────────
export interface PlayerWeek {
  id: string
  player_id: string
  week_start: string          // ISO date of Monday
  matches_played: number
  runs_this_week?: number
  wickets_this_week?: number
  rolling_4week_average?: number
  score_delta?: number        // change vs previous week
  flag_type: FlagType
  coach_note?: string         // 200 char max, advisory only
  coach_note_at?: string
}

export interface TrendAlert {
  id: string
  player_id: string
  triggered_at: string
  flag_type: FlagType
  consecutive_declining_weeks?: number
  skill_dimension?: string    // which dimension is below threshold
  notified_coach: boolean
  notified_selector: boolean
}

// ─── Coach staff profile ──────────────────────────────────────────────────────
export interface CoachProfile {
  id: string
  user_id: string
  full_name: string
  association_id: string
  squad_ids: string[]         // which squads they manage
  avatar_url?: string
  created_at: string
}

// ─── Selector staff profile ───────────────────────────────────────────────────
export interface SelectorProfile {
  id: string
  user_id: string
  full_name: string
  association_id: string
  avatar_url?: string
  created_at: string
}

// ─── Opportunity (kept for player-facing trial notifications) ─────────────────
export interface Opportunity {
  id: string
  trial_cycle_id: string
  association_id: string
  title: string
  description: string
  age_category: string
  format: Format[]
  roles_needed: PlayingRole[]
  deadline: string
  is_active: boolean
  created_at: string
}
