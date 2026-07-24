/**
 * Typed dashboard data layer — one contract per role.
 *
 * Every dashboard page (Player / Scout / Coach / Admin) reads its props from
 * this module via `load*Dashboard(userId)`. Today those loaders return mock
 * data so the UI can be developed and demoed without a DB. Each `MOCK_*` block
 * has a TODO marking exactly where to swap in the SQL/Prisma call later —
 * the existing live SQL in each role's app/dashboard/<role>/page.tsx and app/scout/dashboard/page.tsx
 * and `app/admin/page.tsx` is the reference implementation for those swaps.
 *
 * Why this layer exists:
 *   • One source of truth for view-model shapes — UI never invents its own props.
 *   • Mock implementations let the Coach dashboard (which has no live loader yet)
 *     ship with the same contract the others will adopt.
 *   • Lets us mock specific roles in tests/Storybook without touching the DB.
 *
 * Scope rules (set by spec):
 *   • UI + typed layer only. No new API routes are created here.
 *   • No existing API route is modified.
 *
 * Convention:
 *   • `VerificationLevel` is INTEGER 1–4 (matches live schema, NOT the Prisma enum).
 *   • `ProfileStatus` and `Visibility` are string literals (matches live schema).
 */

// ─── Shared primitives ──────────────────────────────────────────────────────

export type Role = "player" | "coach" | "scout" | "academy_admin" | "athlasx_admin";

export type VerificationLevel = 1 | 2 | 3 | 4;
export type ProfileStatus = "Draft" | "Pending Approval" | "Approved" | "Rejected";
export type Visibility = "Private" | "Scout Visible" | "Public";
export type AccountStatus = "pending" | "active" | "suspended";
export type PlayingRole = "Batter" | "Bowler" | "All-Rounder" | "WK" | "Player";

export interface PlayerSummary {
  user_id: string;
  name: string;
  playing_role: PlayingRole;
  age: number | null;
  city: string;
  state: string;
  academy_name: string;
  verification_level: VerificationLevel;
  profile_pct: number;
  latest_yoyo: number | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// PLAYER
// ═══════════════════════════════════════════════════════════════════════════

export interface PlayerDashboardData {
  user_name: string;
  profile_id: string;
  profile_status: ProfileStatus;
  visibility: Visibility;
  account_status: AccountStatus;
  verification: { level: VerificationLevel; name: string; desc: string };
  completion: {
    pct: number;
    done_required: number;
    total_required: number;
    required: Array<{ name: string; done: boolean }>;
    optional: Array<{ name: string; done: boolean }>;
  };
  recent_scout_views: number;
  recent_trial_invites: number;
}

const MOCK_PLAYER: PlayerDashboardData = {
  user_name: "Arjun Patel",
  profile_id: "00000000-0000-0000-0000-000000000001",
  profile_status: "Pending Approval",
  visibility: "Scout Visible",
  account_status: "active",
  verification: { level: 2, name: "Identity Verified", desc: "Aadhaar verified · DOB confirmed" },
  completion: {
    pct: 78, done_required: 7, total_required: 9,
    required: [
      { name: "Personal info", done: true },
      { name: "Date of birth", done: true },
      { name: "Role & style", done: true },
      { name: "Performance stats", done: true },
      { name: "Fitness", done: true },
      { name: "Aadhaar", done: true },
      { name: "Profile photo", done: true },
      { name: "Highlight video", done: false },
      { name: "Coach endorsement", done: false },
    ],
    optional: [
      { name: "Behavioural assessment", done: true },
      { name: "Bowling clip", done: false },
      { name: "Match scorecard", done: false },
    ],
  },
  recent_scout_views: 12,
  recent_trial_invites: 1,
};

export async function loadPlayerDashboard(_userId: string): Promise<PlayerDashboardData> {
  // TODO swap to: see app/dashboard/player/page.tsx (already live).
  return MOCK_PLAYER;
}

// ═══════════════════════════════════════════════════════════════════════════
// COACH
// ═══════════════════════════════════════════════════════════════════════════

export type CoachStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED";

export interface CoachAssignedPlayer extends PlayerSummary {
  /* Newest pending action this coach owes the player. */
  pending_action: "fitness" | "behaviour" | "milestone" | null;
  last_assessment_at: string | null;          // ISO date
}

export interface CoachSubmission {
  id: string;
  player_user_id: string;
  player_name: string;
  kind: "fitness" | "behaviour" | "milestone";
  summary: string;                            // "YoYo 17.4 · 30m 4.21s"
  submitted_at: string;                       // ISO
}

export interface CoachDashboardData {
  coach_name: string;
  coach_status: CoachStatus;
  academy_name: string | null;
  can_submit_fitness: boolean;                // = coach_status==='APPROVED' && academy bound
  counts: {
    assigned: number;
    pending_fitness: number;                  // assigned with last_yoyo > 30d ago
    pending_behaviour: number;
    submissions_30d: number;
  };
  assigned_players: CoachAssignedPlayer[];
  recent_submissions: CoachSubmission[];
}

const MOCK_COACH_PLAYERS: CoachAssignedPlayer[] = [
  { user_id: "p-001", name: "Rohan Mehta",   playing_role: "Batter",      age: 17, city: "Pune",       state: "Maharashtra",   academy_name: "Khel Vidya CA",  verification_level: 2, profile_pct: 72, latest_yoyo: 15.4, pending_action: "fitness",  last_assessment_at: "2026-04-12" },
  { user_id: "p-002", name: "Vihaan Iyer",   playing_role: "All-Rounder", age: 16, city: "Bengaluru",  state: "Karnataka",     academy_name: "Khel Vidya CA",  verification_level: 3, profile_pct: 88, latest_yoyo: 17.2, pending_action: "behaviour",last_assessment_at: "2026-05-22" },
  { user_id: "p-003", name: "Aarav Singh",   playing_role: "Bowler",      age: 18, city: "Mumbai",     state: "Maharashtra",   academy_name: "Khel Vidya CA",  verification_level: 2, profile_pct: 64, latest_yoyo: 14.1, pending_action: "fitness",  last_assessment_at: "2026-03-30" },
  { user_id: "p-004", name: "Karthik Rao",   playing_role: "WK",          age: 15, city: "Hyderabad",  state: "Telangana",     academy_name: "Khel Vidya CA",  verification_level: 1, profile_pct: 41, latest_yoyo: null, pending_action: "fitness",  last_assessment_at: null },
  { user_id: "p-005", name: "Dev Sharma",    playing_role: "Batter",      age: 17, city: "Delhi",      state: "Delhi",         academy_name: "Khel Vidya CA",  verification_level: 3, profile_pct: 91, latest_yoyo: 18.0, pending_action: null,       last_assessment_at: "2026-06-02" },
  { user_id: "p-006", name: "Ishaan Kapoor", playing_role: "All-Rounder", age: 16, city: "Pune",       state: "Maharashtra",   academy_name: "Khel Vidya CA",  verification_level: 2, profile_pct: 70, latest_yoyo: 16.3, pending_action: "milestone",last_assessment_at: "2026-05-10" },
];

const MOCK_COACH_SUBMISSIONS: CoachSubmission[] = [
  { id: "s-1", player_user_id: "p-005", player_name: "Dev Sharma",    kind: "fitness",   summary: "YoYo 18.0 · 30m 4.05s · 2km 7:42",            submitted_at: "2026-06-02T09:30:00Z" },
  { id: "s-2", player_user_id: "p-002", player_name: "Vihaan Iyer",   kind: "behaviour", summary: "Discipline 8 · Coachability 9 · Work ethic 8", submitted_at: "2026-05-22T11:10:00Z" },
  { id: "s-3", player_user_id: "p-001", player_name: "Rohan Mehta",   kind: "fitness",   summary: "YoYo 15.4 · 30m 4.18s",                        submitted_at: "2026-04-12T08:00:00Z" },
  { id: "s-4", player_user_id: "p-006", player_name: "Ishaan Kapoor", kind: "milestone", summary: "Selected — U-19 state probables",              submitted_at: "2026-05-10T14:20:00Z" },
];

const MOCK_COACH: CoachDashboardData = {
  coach_name: "Coach R. Verma",
  coach_status: "APPROVED",
  academy_name: "Khel Vidya CA",
  can_submit_fitness: true,
  counts: {
    assigned: MOCK_COACH_PLAYERS.length,
    pending_fitness:   MOCK_COACH_PLAYERS.filter((p) => p.pending_action === "fitness").length,
    pending_behaviour: MOCK_COACH_PLAYERS.filter((p) => p.pending_action === "behaviour").length,
    submissions_30d:   MOCK_COACH_SUBMISSIONS.length,
  },
  assigned_players: MOCK_COACH_PLAYERS,
  recent_submissions: MOCK_COACH_SUBMISSIONS,
};

export async function loadCoachDashboard(_userId: string): Promise<CoachDashboardData> {
  // TODO swap to live SQL:
  //   SELECT cr.coach_status, a.academy_name FROM coach_registry cr
  //   LEFT JOIN academies a ON a.user_id = cr.user_id WHERE cr.user_id = $1;
  //   SELECT pp.*, u.name FROM player_profiles pp JOIN users u ON u.id=pp.user_id
  //     WHERE pp.academy_id = $academy AND pp.profile_status='Active';
  //   SELECT * FROM fitness_data WHERE recorded_by_user_id = $1 ORDER BY created_at DESC LIMIT 20;
  // can_submit_fitness = (coach_status='APPROVED' AND academy_name IS NOT NULL)
  return MOCK_COACH;
}

// ═══════════════════════════════════════════════════════════════════════════
// SCOUT
// ═══════════════════════════════════════════════════════════════════════════

export interface ScoutDashboardData {
  scout_name: string;
  featured_player: PlayerSummary | null;
  players: PlayerSummary[];
  shortlist_ids: string[];
  recent_notes: Array<{ player_user_id: string; player_name: string; updated_at: string }>;
  watchlist: { shortlist: number; notes: number; invites: number; accepted: number };
}

const MOCK_SCOUT: ScoutDashboardData = {
  scout_name: "Scout — A. Khan",
  featured_player: { user_id: "p-005", name: "Dev Sharma", playing_role: "Batter", age: 17, city: "Delhi", state: "Delhi", academy_name: "Khel Vidya CA", verification_level: 3, profile_pct: 91, latest_yoyo: 18.0 },
  players: MOCK_COACH_PLAYERS.map(({ pending_action, last_assessment_at, ...rest }) => rest),
  shortlist_ids: ["p-002", "p-005"],
  recent_notes: [
    { player_user_id: "p-005", player_name: "Dev Sharma",  updated_at: "2026-06-05T10:00:00Z" },
    { player_user_id: "p-002", player_name: "Vihaan Iyer", updated_at: "2026-06-04T16:00:00Z" },
  ],
  watchlist: { shortlist: 2, notes: 2, invites: 1, accepted: 0 },
};

export async function loadScoutDashboard(_userId: string): Promise<ScoutDashboardData> {
  // TODO swap to: see app/scout/dashboard/page.tsx (already live).
  return MOCK_SCOUT;
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN
// ═══════════════════════════════════════════════════════════════════════════

export interface AdminDashboardData {
  stats: {
    total_players: number;
    scout_visible: number;
    active_scouts: number;
    pending_verifications: number;
    consent_blocked: number;
  };
  verification_queue: Array<{
    id: string;
    verification_type: "IDENTITY" | "PERFORMANCE" | "SCOUT" | "FITNESS";
    player_name: string;
    submitted_by: string;
    evidence_url: string | null;
    created_at: string;
  }>;
  pending_players:   Array<{ id: string; name: string; state: string; submitted_at: string | null; source_channel: string }>;
  pending_academies: Array<{ id: string; name: string; state: string; player_count: number; submitted_at: string | null }>;
  pending_scouts:    Array<{ id: string; name: string; email: string; created_at: string }>;
  consent:           { minors: number; minors_with_consent: number };
  consent_blocked:   Array<{ name: string; age: number }>;
  level_distribution: Array<{ lvl: VerificationLevel; c: number }>;
  recent_signups:    Array<{ id: string; name: string; playing_role: string; source_channel: string; state: string; verification_level: VerificationLevel; profile_status: ProfileStatus; created_at: string }>;
  activity_30d:      Array<{ day: string; players: number; scouts: number }>;
}

function genActivity(): AdminDashboardData["activity_30d"] {
  const out: AdminDashboardData["activity_30d"] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    out.push({
      day: d.toISOString().slice(0, 10),
      players: 4 + ((i * 7) % 11),
      scouts:  1 + ((i * 3) % 4),
    });
  }
  return out;
}

const MOCK_ADMIN: AdminDashboardData = {
  stats: { total_players: 412, scout_visible: 137, active_scouts: 28, pending_verifications: 6, consent_blocked: 3 },
  verification_queue: [
    { id: "v-1", verification_type: "IDENTITY",    player_name: "Karthik Rao",  submitted_by: "Karthik Rao",  evidence_url: "https://example/aadhaar.pdf", created_at: "2026-06-08T10:00:00Z" },
    { id: "v-2", verification_type: "PERFORMANCE", player_name: "Rohan Mehta",  submitted_by: "Khel Vidya CA", evidence_url: "https://example/scorecard.png", created_at: "2026-06-09T11:00:00Z" },
    { id: "v-3", verification_type: "PERFORMANCE", player_name: "Dev Sharma",   submitted_by: "Khel Vidya CA", evidence_url: "https://example/scorecard2.png", created_at: "2026-06-09T15:00:00Z" },
  ],
  pending_players: [
    { id: "pp-1", name: "Karthik Rao",   state: "Telangana",   submitted_at: "2026-06-08T10:00:00Z", source_channel: "Academy" },
    { id: "pp-2", name: "Ishaan Kapoor", state: "Maharashtra", submitted_at: "2026-06-09T08:00:00Z", source_channel: "Independent Player" },
  ],
  pending_academies: [
    { id: "a-1", name: "Sunrise Cricket Academy", state: "Tamil Nadu", player_count: 23, submitted_at: "2026-06-07T09:00:00Z" },
  ],
  pending_scouts: [
    { id: "s-1", name: "M. Nair",  email: "m.nair@scoutmail.in", created_at: "2026-06-09T07:00:00Z" },
    { id: "s-2", name: "P. Reddy", email: "preddy@scoutmail.in", created_at: "2026-06-09T09:00:00Z" },
  ],
  consent: { minors: 41, minors_with_consent: 38 },
  consent_blocked: [
    { name: "Karthik Rao", age: 15 },
    { name: "A. Verma",    age: 14 },
    { name: "S. Joshi",    age: 16 },
  ],
  level_distribution: [
    { lvl: 1, c: 184 }, { lvl: 2, c: 142 }, { lvl: 3, c: 71 }, { lvl: 4, c: 15 },
  ],
  recent_signups: [
    { id: "u-1", name: "Karthik Rao",   playing_role: "WK",          source_channel: "Academy",           state: "Telangana",   verification_level: 1, profile_status: "Pending Approval", created_at: "2026-06-09T08:00:00Z" },
    { id: "u-2", name: "Ishaan Kapoor", playing_role: "All-Rounder", source_channel: "Independent Player",state: "Maharashtra", verification_level: 2, profile_status: "Approved",         created_at: "2026-06-09T07:00:00Z" },
  ],
  activity_30d: genActivity(),
};

export async function loadAdminDashboard(_userId: string): Promise<AdminDashboardData> {
  // TODO swap to: see app/admin/page.tsx (already live).
  return MOCK_ADMIN;
}

// ═══════════════════════════════════════════════════════════════════════════
// Convenience: single entry-point so tests can swap mocks per role.
// ═══════════════════════════════════════════════════════════════════════════

export async function loadDashboard(role: Role, userId: string) {
  switch (role) {
    case "player":         return loadPlayerDashboard(userId);
    case "coach":          return loadCoachDashboard(userId);
    case "scout":          return loadScoutDashboard(userId);
    case "athlasx_admin":   return loadAdminDashboard(userId);
    case "academy_admin":  return loadAdminDashboard(userId); // separate loader can replace this
  }
}