CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(40) DEFAULT 'player',
  created_at TIMESTAMP DEFAULT NOW()
);

-- ── auth extensions ──────────────────────────────────────────────────────
-- Idempotent ALTERs so this can run against existing databases.
ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(40);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone           VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status  VARCHAR(20) DEFAULT 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_uidx ON users(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);
CREATE INDEX IF NOT EXISTS users_account_status_idx ON users(account_status);

-- Allowed roles (CHECK enforced softly via app layer; CHECK constraint
-- avoided here so old rows with legacy values don't block migrations):
--   player, parent, academy_admin, coach, scout, tournament_organizer, athlasx_admin
-- Allowed account_status values: pending, active, suspended

-- Phone OTP table — short-lived 6-digit codes
CREATE TABLE IF NOT EXISTS phone_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  phone VARCHAR(20) NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  attempts INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS phone_otps_user_phone_idx ON phone_otps(user_id, phone);
CREATE INDEX IF NOT EXISTS phone_otps_expires_idx ON phone_otps(expires_at);

-- ── player profile spec-aligned additions ───────────────────────────────
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS first_name        VARCHAR(80);
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS last_name         VARCHAR(80);
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS gender            VARCHAR(20);
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS country           VARCHAR(60) DEFAULT 'India';
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS height_cm         DECIMAL(5,2);
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS weight_kg         DECIMAL(5,2);
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS dominant_hand     VARCHAR(20);
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS secondary_role    VARCHAR(30);
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS wicket_keeper     BOOLEAN DEFAULT false;
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS school_team       VARCHAR(120);
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS club_team         VARCHAR(120);
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS district_team     VARCHAR(120);
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS state_team        VARCHAR(120);
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS academy_id        UUID;
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS aspirations       TEXT;
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS strengths         TEXT;
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS improvement_areas TEXT;
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS profile_status    VARCHAR(40) DEFAULT 'Draft';
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS visibility        VARCHAR(20) DEFAULT 'Private';
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS verification_level INTEGER  DEFAULT 1;
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS submitted_at      TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS player_profiles_status_idx     ON player_profiles(profile_status);
CREATE INDEX IF NOT EXISTS player_profiles_visibility_idx ON player_profiles(visibility);
CREATE INDEX IF NOT EXISTS player_profiles_academy_idx    ON player_profiles(academy_id);
CREATE INDEX IF NOT EXISTS player_profiles_state_idx      ON player_profiles(state);

-- ── academies (lightweight, for the searchable dropdown in step 3) ──────
CREATE TABLE IF NOT EXISTS academies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  academy_name VARCHAR(160) NOT NULL,
  city VARCHAR(120),
  state VARCHAR(120),
  country VARCHAR(60) DEFAULT 'India',
  verification_status VARCHAR(20) DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS academies_name_idx ON academies USING gin (to_tsvector('simple', academy_name));
CREATE INDEX IF NOT EXISTS academies_state_idx ON academies(state);

-- ── player media (videos, photos, certificates) ─────────────────────────
CREATE TABLE IF NOT EXISTS player_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  media_type VARCHAR(20) NOT NULL,    -- video | photo | scorecard | certificate
  url TEXT NOT NULL,
  youtube_video_id VARCHAR(40),
  title VARCHAR(200),
  description TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS player_media_user_idx ON player_media(user_id, media_type);

-- ── player consents (one row per consent event) ─────────────────────────
CREATE TABLE IF NOT EXISTS player_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  parent_name VARCHAR(120),
  parent_phone VARCHAR(20),
  parent_email VARCHAR(255),
  profile_visibility_ok BOOLEAN DEFAULT false,
  media_upload_ok       BOOLEAN DEFAULT false,
  scout_contact_ok      BOOLEAN DEFAULT false,
  data_usage_ok         BOOLEAN DEFAULT false,
  minor_flag            BOOLEAN DEFAULT false,
  signed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS player_consents_user_idx ON player_consents(user_id);

-- ── academy profile spec-aligned additions ──────────────────────────────
ALTER TABLE academies ADD COLUMN IF NOT EXISTS description     TEXT;
ALTER TABLE academies ADD COLUMN IF NOT EXISTS logo_url        TEXT;
ALTER TABLE academies ADD COLUMN IF NOT EXISTS founded_year    INTEGER;
ALTER TABLE academies ADD COLUMN IF NOT EXISTS contact_email   VARCHAR(255);
ALTER TABLE academies ADD COLUMN IF NOT EXISTS contact_phone   VARCHAR(40);
ALTER TABLE academies ADD COLUMN IF NOT EXISTS website         TEXT;
ALTER TABLE academies ADD COLUMN IF NOT EXISTS social_links    JSONB;     -- { instagram, twitter, youtube, linkedin }
ALTER TABLE academies ADD COLUMN IF NOT EXISTS age_groups      TEXT[];    -- ['U-12','U-14','U-16','U-19','Senior']
ALTER TABLE academies ADD COLUMN IF NOT EXISTS facilities      TEXT[];    -- ['Indoor nets','Floodlights','Gym','Hostel']
ALTER TABLE academies ADD COLUMN IF NOT EXISTS specialties     TEXT[];    -- ['Pace bowling','Spin','Batting','WK']
ALTER TABLE academies ADD COLUMN IF NOT EXISTS profile_status  VARCHAR(40) DEFAULT 'Draft';
ALTER TABLE academies ADD COLUMN IF NOT EXISTS submitted_at    TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS academies_status_idx ON academies(verification_status);

-- ── player_profiles attribution fields (who created the draft) ──────────
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS source_channel       VARCHAR(40) DEFAULT 'Independent Player';
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS created_by_user_id   UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS claimed_at           TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS player_profiles_source_idx ON player_profiles(source_channel);

-- ── player invites (CSV bulk-upload) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS player_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(48) UNIQUE NOT NULL,
  academy_id UUID REFERENCES academies(id) ON DELETE CASCADE,
  player_profile_id UUID REFERENCES player_profiles(id) ON DELETE CASCADE,
  invited_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  email VARCHAR(255),
  phone VARCHAR(40),
  invited_name VARCHAR(120),
  status VARCHAR(20) DEFAULT 'Pending', -- Pending | Sent | Claimed | Expired
  sent_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  claimed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS player_invites_academy_idx ON player_invites(academy_id);
CREATE INDEX IF NOT EXISTS player_invites_status_idx ON player_invites(status);
CREATE INDEX IF NOT EXISTS player_invites_email_idx ON player_invites(email);

-- ── scout views (for dashboard "scout engagement" metrics) ──────────────
CREATE TABLE IF NOT EXISTS scout_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  player_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS scout_views_player_idx ON scout_views(player_user_id);
CREATE INDEX IF NOT EXISTS scout_views_scout_idx  ON scout_views(scout_user_id);

-- ── verifications (trust layer — one row per claim) ─────────────────────
CREATE TABLE IF NOT EXISTS verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  verification_type VARCHAR(20) NOT NULL,   -- IDENTITY | PERFORMANCE | SCOUT | FITNESS
  status VARCHAR(20) DEFAULT 'Pending',     -- Pending | Approved | Rejected
  evidence_url TEXT,
  evidence_metadata JSONB,
  submitted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS verifications_status_idx ON verifications(status);
CREATE INDEX IF NOT EXISTS verifications_player_idx ON verifications(player_user_id);

CREATE TABLE IF NOT EXISTS player_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  city VARCHAR(100),
  state VARCHAR(100),
  district VARCHAR(100),
  date_of_birth DATE,
  playing_role VARCHAR(50),
  batting_style VARCHAR(50),
  bowling_style VARCHAR(50),
  matches_played INTEGER DEFAULT 0,
  runs_scored INTEGER DEFAULT 0,
  wickets_taken INTEGER DEFAULT 0,
  highest_score INTEGER DEFAULT 0,
  best_bowling VARCHAR(20),
  bio TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS player_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  youtube_url VARCHAR(500) NOT NULL,
  youtube_video_id VARCHAR(50),
  category VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE player_videos ADD COLUMN IF NOT EXISTS youtube_video_id VARCHAR(50);

-- =====================================================================
-- 12-step Player Onboarding Workflow
-- =====================================================================

CREATE TABLE IF NOT EXISTS onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  current_step INTEGER DEFAULT 1,
  status VARCHAR(20) DEFAULT 'DRAFT',
  completed_steps INTEGER[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS onboarding_progress_user_id_uidx ON onboarding_progress(user_id);

CREATE TABLE IF NOT EXISTS aadhaar_verification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  masked_aadhaar VARCHAR(20),
  verified_dob DATE,
  age_verified BOOLEAN DEFAULT false,
  aadhaar_token VARCHAR(255),
  discrepancy_flag BOOLEAN DEFAULT false,
  verification_pts INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS aadhaar_verification_user_id_idx ON aadhaar_verification(user_id);

CREATE TABLE IF NOT EXISTS guardian_consent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  parent_phone VARCHAR(20),
  parent_phone_verified BOOLEAN DEFAULT false,
  guardian_id_doc_url VARCHAR(500),
  disclaimer_signed BOOLEAN DEFAULT false,
  signed_at TIMESTAMP,
  signed_ip VARCHAR(50),
  minor_flag BOOLEAN DEFAULT true,
  verification_pts INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS guardian_consent_user_id_idx ON guardian_consent(user_id);

CREATE TABLE IF NOT EXISTS cricket_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  player_role VARCHAR(30),
  batting_style VARCHAR(30),
  bowling_style VARCHAR(50),
  phase_specialty VARCHAR(50),
  dashboard_template VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS cricket_profile_user_id_uidx ON cricket_profile(user_id);

CREATE TABLE IF NOT EXISTS performance_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  format VARCHAR(10),
  matches INTEGER DEFAULT 0,
  innings INTEGER DEFAULT 0,
  runs INTEGER DEFAULT 0,
  not_outs INTEGER DEFAULT 0,
  highest_score INTEGER DEFAULT 0,
  fifties INTEGER DEFAULT 0,
  hundreds INTEGER DEFAULT 0,
  powerplay_sr DECIMAL(6,2),
  middle_avg DECIMAL(6,2),
  death_sr DECIMAL(6,2),
  overs_bowled DECIMAL(6,1) DEFAULT 0,
  wickets INTEGER DEFAULT 0,
  economy DECIMAL(5,2),
  bowl_avg DECIMAL(6,2),
  bowl_sr DECIMAL(6,2),
  best_figures VARCHAR(10),
  bpi DECIMAL(6,2),
  cbr DECIMAL(6,2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS performance_stats_user_id_idx ON performance_stats(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS performance_stats_user_format_uidx ON performance_stats(user_id, format);

CREATE TABLE IF NOT EXISTS match_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  opponent VARCHAR(100),
  match_date DATE,
  format VARCHAR(10),
  competition_level VARCHAR(50),
  mqi_tag VARCHAR(20),
  mqi_weight DECIMAL(3,2),
  runs_scored INTEGER,
  wickets_taken INTEGER,
  scorecard_url VARCHAR(500),
  ocr_status VARCHAR(20) DEFAULT 'PENDING',
  verification_pts INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS match_logs_user_id_idx ON match_logs(user_id);

CREATE TABLE IF NOT EXISTS fitness_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  sprint_time DECIMAL(4,2),
  pushups_60s INTEGER,
  resting_hr_bpm INTEGER,
  yoyo_level DECIMAL(4,1),
  run_2km_time DECIMAL(5,2),
  height_cm DECIMAL(5,1),
  weight_kg DECIMAL(5,1),
  bmi DECIMAL(4,1),
  fitness_score INTEGER,
  medical_cert_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS fitness_data_user_id_uidx ON fitness_data(user_id);

CREATE TABLE IF NOT EXISTS behavioral_assessment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  mcq_answers JSONB,
  free_text TEXT,
  strengths TEXT[],
  gaps TEXT[],
  mental_rating INTEGER,
  coaching_tip TEXT,
  mindset_score INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS behavioral_assessment_user_id_idx ON behavioral_assessment(user_id);

CREATE TABLE IF NOT EXISTS video_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  video_url VARCHAR(500),
  youtube_video_id VARCHAR(50),
  batting_style TEXT,
  wrist_movement TEXT,
  foot_work TEXT,
  bowling_action TEXT,
  strong_points TEXT[],
  weak_points TEXT[],
  style_classification TEXT,
  technique_notes TEXT,
  video_analysed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS video_analysis_user_id_idx ON video_analysis(user_id);

CREATE TABLE IF NOT EXISTS coach_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  coach_name VARCHAR(100),
  academy_club VARCHAR(100),
  official_id VARCHAR(100),
  cert_url VARCHAR(500),
  coach_status VARCHAR(20) DEFAULT 'PENDING_REVIEW',
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS coach_registry_user_id_idx ON coach_registry(user_id);

CREATE TABLE IF NOT EXISTS athlasx_score (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  total_score INTEGER DEFAULT 0,
  performance_score INTEGER DEFAULT 0,
  experience_score INTEGER DEFAULT 0,
  fitness_score INTEGER DEFAULT 0,
  verification_score INTEGER DEFAULT 0,
  mindset_score INTEGER DEFAULT 0,
  profile_score INTEGER DEFAULT 0,
  verification_pts INTEGER DEFAULT 0,
  trajectory_boost BOOLEAN DEFAULT false,
  coach_verified BOOLEAN DEFAULT false,
  profile_strength VARCHAR(10) DEFAULT 'WEAK',
  roadmap JSONB,
  score_history JSONB DEFAULT '[]',
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS athlasx_score_user_id_uidx ON athlasx_score(user_id);

-- Score-weight configuration captured at Step 4 (role).
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS score_weights JSONB;

-- Roadmap deltas computed at Step 5 (stats).
ALTER TABLE performance_stats ADD COLUMN IF NOT EXISTS roadmap_gaps JSONB;

-- Coach invitations issued by players in Step 10.
CREATE TABLE IF NOT EXISTS coach_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  coach_name VARCHAR(100),
  coach_email VARCHAR(255),
  coach_phone VARCHAR(20),
  token VARCHAR(64) UNIQUE,
  status VARCHAR(20) DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT NOW(),
  redeemed_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS coach_invites_user_id_idx ON coach_invites(user_id);

-- Quick boolean denormalisation so the dashboard can filter without a join.
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS coach_verified BOOLEAN DEFAULT false;

-- coach_registry → link back to which invite redeemed it (for traceability).
ALTER TABLE coach_registry ADD COLUMN IF NOT EXISTS invite_id UUID REFERENCES coach_invites(id) ON DELETE SET NULL;
ALTER TABLE coach_registry ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;

-- Score / discovery surface added in Steps 11 + 12.
ALTER TABLE athlasx_score ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'IN_PROGRESS';
ALTER TABLE athlasx_score ADD COLUMN IF NOT EXISTS elasticsearch_indexed BOOLEAN DEFAULT false;
ALTER TABLE athlasx_score ADD COLUMN IF NOT EXISTS calculated_at TIMESTAMP;
ALTER TABLE athlasx_score ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP;

-- Player avatar (uploaded photo for the profile card).
ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);

-- Scout interactions: shortlists, trial invites, private notes.
CREATE TABLE IF NOT EXISTS scout_shortlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  player_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (scout_user_id, player_user_id)
);
CREATE INDEX IF NOT EXISTS scout_shortlist_player_idx ON scout_shortlist(player_user_id);

CREATE TABLE IF NOT EXISTS scout_trial_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  player_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  message TEXT,
  status VARCHAR(20) DEFAULT 'SENT',
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS scout_trial_invites_player_idx ON scout_trial_invites(player_user_id);

CREATE TABLE IF NOT EXISTS scout_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  player_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  body TEXT,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (scout_user_id, player_user_id)
);

-- Admin moderation surface.
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE';
ALTER TABLE match_logs ADD COLUMN IF NOT EXISTS ocr_confidence DECIMAL(4,3);
ALTER TABLE match_logs ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id);
ALTER TABLE match_logs ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;
ALTER TABLE match_logs ADD COLUMN IF NOT EXISTS reject_reason TEXT;
ALTER TABLE coach_registry ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id);
ALTER TABLE coach_registry ADD COLUMN IF NOT EXISTS reject_reason TEXT;

CREATE TABLE IF NOT EXISTS fraud_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  flag_type VARCHAR(40) NOT NULL,
  reason TEXT,
  status VARCHAR(20) DEFAULT 'OPEN',
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  resolved_by UUID REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS fraud_flags_user_id_idx ON fraud_flags(user_id);
CREATE INDEX IF NOT EXISTS fraud_flags_status_idx ON fraud_flags(status);

CREATE TABLE IF NOT EXISTS player_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  kind VARCHAR(40),
  title VARCHAR(200),
  body TEXT,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS player_notifications_user_id_idx ON player_notifications(user_id);

-- Spec-aligned additions
ALTER TABLE match_logs ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE coach_registry ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE coach_registry ADD COLUMN IF NOT EXISTS players_waiting INTEGER DEFAULT 0;

ALTER TABLE fraud_flags ADD COLUMN IF NOT EXISTS affected_user_id UUID REFERENCES users(id);
ALTER TABLE fraud_flags ADD COLUMN IF NOT EXISTS affected_account_type VARCHAR(20);
ALTER TABLE fraud_flags ADD COLUMN IF NOT EXISTS flagged_reason TEXT;
-- Backfill new columns from existing ones (one-time, idempotent).
UPDATE fraud_flags SET affected_user_id = user_id WHERE affected_user_id IS NULL AND user_id IS NOT NULL;
UPDATE fraud_flags SET flagged_reason  = reason  WHERE flagged_reason  IS NULL AND reason  IS NOT NULL;

CREATE TABLE IF NOT EXISTS admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50),
  message TEXT,
  sent_at TIMESTAMP DEFAULT NOW(),
  read BOOLEAN DEFAULT false
);
CREATE INDEX IF NOT EXISTS admin_notifications_recipient_idx ON admin_notifications(recipient_user_id);

-- ── Coach evaluations (written by approved self-registered coaches) ─────────
-- One row per coach-player pair; updated in place on re-submission.
CREATE TABLE IF NOT EXISTS coach_evaluations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  player_user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  discipline        INTEGER CHECK (discipline BETWEEN 1 AND 10),
  coachability      INTEGER CHECK (coachability BETWEEN 1 AND 10),
  work_ethic        INTEGER CHECK (work_ethic BETWEEN 1 AND 10),
  leadership        INTEGER CHECK (leadership BETWEEN 1 AND 10),
  mental_toughness  INTEGER CHECK (mental_toughness BETWEEN 1 AND 10),
  communication     INTEGER CHECK (communication BETWEEN 1 AND 10),
  notes             TEXT,
  coaching_tip      TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (coach_user_id, player_user_id)
);
CREATE INDEX IF NOT EXISTS coach_evaluations_coach_idx  ON coach_evaluations(coach_user_id);
CREATE INDEX IF NOT EXISTS coach_evaluations_player_idx ON coach_evaluations(player_user_id);
