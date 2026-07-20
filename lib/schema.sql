-- ============================================================
-- AthlasX — complete idempotent schema
-- Safe to run on a fresh DB or re-run on an existing one.
-- All ALTER TABLE columns are merged into their CREATE TABLE
-- so ordering never causes "relation does not exist" errors.
-- ============================================================

-- ── users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(100) NOT NULL,
  email            VARCHAR(255) UNIQUE NOT NULL,
  password_hash    VARCHAR(255) NOT NULL,
  role             VARCHAR(40)  DEFAULT 'player',
  phone            VARCHAR(20),
  phone_verified_at TIMESTAMPTZ,
  account_status   VARCHAR(20)  DEFAULT 'pending',
  status           VARCHAR(20)  DEFAULT 'ACTIVE',
  created_at       TIMESTAMP    DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_uidx        ON users(phone) WHERE phone IS NOT NULL;
CREATE INDEX       IF NOT EXISTS users_role_idx           ON users(role);
CREATE INDEX       IF NOT EXISTS users_account_status_idx ON users(account_status);

-- ── phone OTPs ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS phone_otps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  phone       VARCHAR(20)  NOT NULL,
  code_hash   VARCHAR(255) NOT NULL,
  attempts    INTEGER      DEFAULT 0,
  expires_at  TIMESTAMPTZ  NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS phone_otps_user_phone_idx ON phone_otps(user_id, phone);
CREATE INDEX IF NOT EXISTS phone_otps_expires_idx    ON phone_otps(expires_at);

-- ── academies ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS academies (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES users(id) ON DELETE SET NULL,
  academy_name        VARCHAR(160) NOT NULL,
  city                VARCHAR(120),
  state               VARCHAR(120),
  country             VARCHAR(60)  DEFAULT 'India',
  verification_status VARCHAR(20)  DEFAULT 'PENDING',
  description         TEXT,
  logo_url            TEXT,
  founded_year        INTEGER,
  contact_email       VARCHAR(255),
  contact_phone       VARCHAR(40),
  website             TEXT,
  social_links        JSONB,
  age_groups          TEXT[],
  facilities          TEXT[],
  specialties         TEXT[],
  profile_status          VARCHAR(40)  DEFAULT 'Draft',
  submitted_at            TIMESTAMPTZ,
  onboarding_step         INTEGER      DEFAULT 1,
  onboarding_completed_at TIMESTAMPTZ,
  created_at              TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS academies_name_idx   ON academies USING gin (to_tsvector('simple', academy_name));
CREATE INDEX IF NOT EXISTS academies_state_idx  ON academies(state);
CREATE INDEX IF NOT EXISTS academies_status_idx ON academies(verification_status);

-- ── player profiles ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS player_profiles (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID REFERENCES users(id) ON DELETE CASCADE,
  city               VARCHAR(100),
  state              VARCHAR(100),
  district           VARCHAR(100),
  date_of_birth      DATE,
  playing_role       VARCHAR(50),
  batting_style      VARCHAR(50),
  bowling_style      VARCHAR(50),
  matches_played     INTEGER DEFAULT 0,
  runs_scored        INTEGER DEFAULT 0,
  wickets_taken      INTEGER DEFAULT 0,
  highest_score      INTEGER DEFAULT 0,
  best_bowling       VARCHAR(20),
  bio                TEXT,
  first_name         VARCHAR(80),
  last_name          VARCHAR(80),
  gender             VARCHAR(20),
  country            VARCHAR(60)  DEFAULT 'India',
  height_cm          DECIMAL(5,2),
  weight_kg          DECIMAL(5,2),
  dominant_hand      VARCHAR(20),
  secondary_role     VARCHAR(30),
  wicket_keeper      BOOLEAN      DEFAULT false,
  school_team        VARCHAR(120),
  club_team          VARCHAR(120),
  district_team      VARCHAR(120),
  state_team         VARCHAR(120),
  academy_id         UUID,
  aspirations        TEXT,
  strengths          TEXT,
  improvement_areas  TEXT,
  profile_status     VARCHAR(40)  DEFAULT 'Draft',
  visibility         VARCHAR(20)  DEFAULT 'Private',
  verification_level INTEGER      DEFAULT 1,
  submitted_at       TIMESTAMPTZ,
  source_channel     VARCHAR(40)  DEFAULT 'Independent Player',
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  claimed_at         TIMESTAMPTZ,
  score_weights      JSONB,
  coach_verified     BOOLEAN      DEFAULT false,
  avatar_url         VARCHAR(500),
  invite_token       VARCHAR(100),
  invite_sent_at     TIMESTAMPTZ,
  created_at         TIMESTAMP    DEFAULT NOW(),
  updated_at         TIMESTAMP    DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS player_profiles_status_idx     ON player_profiles(profile_status);
CREATE INDEX IF NOT EXISTS player_profiles_visibility_idx ON player_profiles(visibility);
CREATE INDEX IF NOT EXISTS player_profiles_academy_idx    ON player_profiles(academy_id);
CREATE INDEX IF NOT EXISTS player_profiles_state_idx      ON player_profiles(state);
CREATE INDEX IF NOT EXISTS player_profiles_source_idx     ON player_profiles(source_channel);

-- ── player videos ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS player_videos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES users(id) ON DELETE CASCADE,
  title            VARCHAR(200) NOT NULL,
  youtube_url      VARCHAR(500) NOT NULL,
  youtube_video_id VARCHAR(50),
  category         VARCHAR(50),
  created_at       TIMESTAMP DEFAULT NOW()
);

-- ── player media ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS player_media (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES users(id) ON DELETE CASCADE,
  media_type       VARCHAR(20) NOT NULL,
  url              TEXT NOT NULL,
  youtube_video_id VARCHAR(40),
  title            VARCHAR(200),
  description      TEXT,
  uploaded_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS player_media_user_idx ON player_media(user_id, media_type);

-- ── player consents ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS player_consents (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID REFERENCES users(id) ON DELETE CASCADE,
  parent_name          VARCHAR(120),
  parent_phone         VARCHAR(20),
  parent_email         VARCHAR(255),
  profile_visibility_ok BOOLEAN DEFAULT false,
  media_upload_ok      BOOLEAN DEFAULT false,
  scout_contact_ok     BOOLEAN DEFAULT false,
  data_usage_ok        BOOLEAN DEFAULT false,
  minor_flag           BOOLEAN DEFAULT false,
  signed_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS player_consents_user_idx ON player_consents(user_id);

-- ── onboarding progress ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS onboarding_progress (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  current_step    INTEGER   DEFAULT 1,
  status          VARCHAR(20) DEFAULT 'DRAFT',
  completed_steps INTEGER[] DEFAULT '{}',
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS onboarding_progress_user_id_uidx ON onboarding_progress(user_id);

-- ── aadhaar verification ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS aadhaar_verification (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES users(id) ON DELETE CASCADE,
  masked_aadhaar   VARCHAR(20),
  verified_dob     DATE,
  age_verified     BOOLEAN DEFAULT false,
  aadhaar_token    VARCHAR(255),
  discrepancy_flag BOOLEAN DEFAULT false,
  verification_pts INTEGER DEFAULT 0,
  created_at       TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS aadhaar_verification_user_id_idx ON aadhaar_verification(user_id);

-- ── guardian consent ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS guardian_consent (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES users(id) ON DELETE CASCADE,
  parent_phone          VARCHAR(20),
  parent_phone_verified BOOLEAN DEFAULT false,
  guardian_id_doc_url   VARCHAR(500),
  disclaimer_signed     BOOLEAN DEFAULT false,
  signed_at             TIMESTAMP,
  signed_ip             VARCHAR(50),
  minor_flag            BOOLEAN DEFAULT true,
  verification_pts      INTEGER DEFAULT 0,
  created_at            TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS guardian_consent_user_id_idx ON guardian_consent(user_id);

-- ── cricket profile ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cricket_profile (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID REFERENCES users(id) ON DELETE CASCADE,
  player_role        VARCHAR(30),
  batting_style      VARCHAR(30),
  bowling_style      VARCHAR(50),
  phase_specialty    VARCHAR(50),
  dashboard_template VARCHAR(20),
  created_at         TIMESTAMP DEFAULT NOW(),
  updated_at         TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS cricket_profile_user_id_uidx ON cricket_profile(user_id);

-- ── performance stats ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS performance_stats (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  format        VARCHAR(10),
  matches       INTEGER     DEFAULT 0,
  innings       INTEGER     DEFAULT 0,
  runs          INTEGER     DEFAULT 0,
  not_outs      INTEGER     DEFAULT 0,
  highest_score INTEGER     DEFAULT 0,
  fifties       INTEGER     DEFAULT 0,
  hundreds      INTEGER     DEFAULT 0,
  powerplay_sr  DECIMAL(6,2),
  middle_avg    DECIMAL(6,2),
  death_sr      DECIMAL(6,2),
  overs_bowled  DECIMAL(6,1) DEFAULT 0,
  wickets       INTEGER     DEFAULT 0,
  economy       DECIMAL(5,2),
  bowl_avg      DECIMAL(6,2),
  bowl_sr       DECIMAL(6,2),
  best_figures  VARCHAR(10),
  bpi           DECIMAL(6,2),
  cbr           DECIMAL(6,2),
  roadmap_gaps  JSONB,
  created_at    TIMESTAMP   DEFAULT NOW(),
  updated_at    TIMESTAMP   DEFAULT NOW()
);
CREATE INDEX       IF NOT EXISTS performance_stats_user_id_idx        ON performance_stats(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS performance_stats_user_format_uidx  ON performance_stats(user_id, format);

-- ── match logs ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES users(id) ON DELETE CASCADE,
  opponent          VARCHAR(100),
  match_date        DATE,
  format            VARCHAR(10),
  competition_level VARCHAR(50),
  mqi_tag           VARCHAR(20),
  mqi_weight        DECIMAL(3,2),
  runs_scored       INTEGER,
  wickets_taken     INTEGER,
  scorecard_url     VARCHAR(500),
  ocr_status        VARCHAR(20)  DEFAULT 'PENDING',
  ocr_confidence    DECIMAL(4,3),
  verification_pts  INTEGER      DEFAULT 0,
  reviewed_by       UUID REFERENCES users(id),
  reviewed_at       TIMESTAMP,
  reject_reason     TEXT,
  rejection_reason  TEXT,
  -- compute service integration
  compute_task_id   TEXT,
  compute_status    TEXT,
  review_status     TEXT         DEFAULT 'PENDING_REVIEW',
  is_stub           BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMP    DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS match_logs_user_id_idx ON match_logs(user_id);

-- ── fitness data ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fitness_data (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  sprint_time     DECIMAL(4,2),
  pushups_60s     INTEGER,
  resting_hr_bpm  INTEGER,
  yoyo_level      DECIMAL(4,1),
  run_2km_time    DECIMAL(5,2),
  height_cm       DECIMAL(5,1),
  weight_kg       DECIMAL(5,1),
  bmi             DECIMAL(4,1),
  fitness_score   INTEGER,
  medical_cert_url VARCHAR(500),
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS fitness_data_user_id_uidx ON fitness_data(user_id);

-- ── behavioral assessment (player self-assessment) ───────────
CREATE TABLE IF NOT EXISTS behavioral_assessment (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
  mcq_answers         JSONB,
  free_text           TEXT,
  strengths           TEXT[],
  gaps                TEXT[],
  mental_rating       INTEGER,
  coaching_tip        TEXT,
  mindset_score       INTEGER,
  -- compute service integration
  acsi_raw_responses  JSONB,
  compute_task_id     TEXT,
  compute_status      TEXT,
  compute_result      JSONB,
  is_stub             BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS behavioral_assessment_user_id_idx ON behavioral_assessment(user_id);

-- ── video analysis ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS video_analysis (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID REFERENCES users(id) ON DELETE CASCADE,
  video_url            VARCHAR(500),
  youtube_video_id     VARCHAR(50),
  batting_style        TEXT,
  wrist_movement       TEXT,
  foot_work            TEXT,
  bowling_action       TEXT,
  strong_points        TEXT[],
  weak_points          TEXT[],
  style_classification TEXT,
  technique_notes      TEXT,
  video_analysed       BOOLEAN DEFAULT false,
  -- compute service integration
  compute_task_id      TEXT,
  compute_status       TEXT,
  is_stub              BOOLEAN NOT NULL DEFAULT false,
  created_at           TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS video_analysis_user_id_idx ON video_analysis(user_id);

-- ── coach registry ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coach_registry (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES users(id) ON DELETE CASCADE,
  coach_name       VARCHAR(100),
  academy_club     VARCHAR(100),
  official_id      VARCHAR(100),
  cert_url         VARCHAR(500),
  coach_status     VARCHAR(20) DEFAULT 'PENDING_REVIEW',
  approved_at      TIMESTAMP,
  reviewed_by      UUID REFERENCES users(id),
  reject_reason    TEXT,
  rejection_reason TEXT,
  players_waiting  INTEGER DEFAULT 0,
  created_at       TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS coach_registry_user_id_idx ON coach_registry(user_id);

-- ── AthlasX score ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS athlasx_score (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID REFERENCES users(id) ON DELETE CASCADE,
  total_score            INTEGER     DEFAULT 0,
  performance_score      INTEGER     DEFAULT 0,
  experience_score       INTEGER     DEFAULT 0,
  fitness_score          INTEGER     DEFAULT 0,
  verification_score     INTEGER     DEFAULT 0,
  mindset_score          INTEGER     DEFAULT 0,
  profile_score          INTEGER     DEFAULT 0,
  verification_pts       INTEGER     DEFAULT 0,
  trajectory_boost       BOOLEAN     DEFAULT false,
  coach_verified         BOOLEAN     DEFAULT false,
  profile_strength       VARCHAR(10) DEFAULT 'WEAK',
  roadmap                JSONB,
  score_history          JSONB       DEFAULT '[]',
  status                 VARCHAR(20) DEFAULT 'IN_PROGRESS',
  elasticsearch_indexed  BOOLEAN     DEFAULT false,
  calculated_at          TIMESTAMP,
  activated_at           TIMESTAMP,
  updated_at             TIMESTAMP   DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS athlasx_score_user_id_uidx ON athlasx_score(user_id);

-- ── coach invites (issued by players in onboarding step 10) ──
CREATE TABLE IF NOT EXISTS coach_invites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  coach_name   VARCHAR(100),
  coach_email  VARCHAR(255),
  coach_phone  VARCHAR(20),
  token        VARCHAR(64) UNIQUE,
  status       VARCHAR(20) DEFAULT 'PENDING',
  created_at   TIMESTAMP DEFAULT NOW(),
  redeemed_at  TIMESTAMP
);
CREATE INDEX IF NOT EXISTS coach_invites_user_id_idx ON coach_invites(user_id);

-- coach_registry → link back to which invite redeemed it
ALTER TABLE coach_registry ADD COLUMN IF NOT EXISTS invite_id UUID REFERENCES coach_invites(id) ON DELETE SET NULL;

-- ── player invites (academy CSV bulk-upload) ─────────────────
CREATE TABLE IF NOT EXISTS player_invites (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token               VARCHAR(48) UNIQUE NOT NULL,
  academy_id          UUID REFERENCES academies(id) ON DELETE CASCADE,
  player_profile_id   UUID REFERENCES player_profiles(id) ON DELETE CASCADE,
  invited_by_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  email               VARCHAR(255),
  phone               VARCHAR(40),
  invited_name        VARCHAR(120),
  status              VARCHAR(20) DEFAULT 'Pending',
  sent_at             TIMESTAMPTZ,
  claimed_at          TIMESTAMPTZ,
  claimed_by_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS player_invites_academy_idx ON player_invites(academy_id);
CREATE INDEX IF NOT EXISTS player_invites_status_idx  ON player_invites(status);
CREATE INDEX IF NOT EXISTS player_invites_email_idx   ON player_invites(email);

-- ── scout views ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scout_views (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_user_id  UUID REFERENCES users(id) ON DELETE CASCADE,
  player_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  viewed_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS scout_views_player_idx ON scout_views(player_user_id);
CREATE INDEX IF NOT EXISTS scout_views_scout_idx  ON scout_views(scout_user_id);

-- ── verifications ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS verifications (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_user_id        UUID REFERENCES users(id) ON DELETE CASCADE,
  verification_type     VARCHAR(20) NOT NULL,
  status                VARCHAR(20) DEFAULT 'Pending',
  evidence_url          TEXT,
  evidence_metadata     JSONB,
  submitted_by_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by_user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at           TIMESTAMPTZ,
  rejection_reason      TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS verifications_status_idx ON verifications(status);
CREATE INDEX IF NOT EXISTS verifications_player_idx ON verifications(player_user_id);

-- ── scout shortlist ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scout_shortlist (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_user_id  UUID REFERENCES users(id) ON DELETE CASCADE,
  player_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  notes          TEXT,
  created_at     TIMESTAMP DEFAULT NOW(),
  UNIQUE (scout_user_id, player_user_id)
);
CREATE INDEX IF NOT EXISTS scout_shortlist_player_idx ON scout_shortlist(player_user_id);

-- ── scout trial invites ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS scout_trial_invites (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_user_id  UUID REFERENCES users(id) ON DELETE CASCADE,
  player_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  message        TEXT,
  status         VARCHAR(20) DEFAULT 'SENT',
  created_at     TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS scout_trial_invites_player_idx ON scout_trial_invites(player_user_id);

-- ── scout notes ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scout_notes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_user_id  UUID REFERENCES users(id) ON DELETE CASCADE,
  player_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  body           TEXT,
  updated_at     TIMESTAMP DEFAULT NOW(),
  UNIQUE (scout_user_id, player_user_id)
);

-- ── fraud flags ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fraud_flags (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID REFERENCES users(id) ON DELETE CASCADE,
  affected_user_id     UUID REFERENCES users(id),
  affected_account_type VARCHAR(20),
  flag_type            VARCHAR(40) NOT NULL,
  reason               TEXT,
  flagged_reason       TEXT,
  status               VARCHAR(20) DEFAULT 'OPEN',
  created_at           TIMESTAMP DEFAULT NOW(),
  resolved_at          TIMESTAMP,
  resolved_by          UUID REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS fraud_flags_user_id_idx ON fraud_flags(user_id);
CREATE INDEX IF NOT EXISTS fraud_flags_status_idx  ON fraud_flags(status);

-- ── player notifications ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS player_notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  kind       VARCHAR(40),
  title      VARCHAR(200),
  body       TEXT,
  read_at    TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS player_notifications_user_id_idx ON player_notifications(user_id);

-- ── admin notifications ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_notifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type              VARCHAR(50),
  message           TEXT,
  sent_at           TIMESTAMP DEFAULT NOW(),
  read              BOOLEAN DEFAULT false
);
CREATE INDEX IF NOT EXISTS admin_notifications_recipient_idx ON admin_notifications(recipient_user_id);

-- ── academy coaches (staff added by academy admin) ───────────
CREATE TABLE IF NOT EXISTS academy_coaches (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id             UUID REFERENCES academies(id) ON DELETE CASCADE,
  coach_name             VARCHAR(120) NOT NULL,
  specialization         VARCHAR(60),
  years_experience       INTEGER,
  certifications         TEXT,
  can_submit_fitness     BOOLEAN DEFAULT false,
  can_submit_evaluations BOOLEAN DEFAULT false,
  coach_status           VARCHAR(20) DEFAULT 'ACTIVE',
  created_by_user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_at             TIMESTAMPTZ,
  updated_at             TIMESTAMPTZ DEFAULT NOW(),
  created_at             TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS academy_coaches_academy_idx ON academy_coaches(academy_id);

-- ── player fitness assessments ───────────────────────────────
CREATE TABLE IF NOT EXISTS player_fitness_assessments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
  assessment_date     DATE NOT NULL,
  yoyo_score          DECIMAL(5,2),
  sprint_30m          DECIMAL(5,2),
  run_2km             DECIMAL(5,2),
  notes               TEXT,
  is_supervised       BOOLEAN DEFAULT false,
  assessed_by_coach_id UUID REFERENCES academy_coaches(id) ON DELETE SET NULL,
  created_by_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS player_fitness_assessments_user_idx  ON player_fitness_assessments(user_id);
CREATE INDEX IF NOT EXISTS player_fitness_assessments_coach_idx ON player_fitness_assessments(assessed_by_coach_id);

-- ── coach evaluations (written by approved self-registered coaches) ──
CREATE TABLE IF NOT EXISTS coach_evaluations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  player_user_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  discipline       INTEGER CHECK (discipline       BETWEEN 1 AND 10),
  coachability     INTEGER CHECK (coachability     BETWEEN 1 AND 10),
  work_ethic       INTEGER CHECK (work_ethic       BETWEEN 1 AND 10),
  leadership       INTEGER CHECK (leadership       BETWEEN 1 AND 10),
  mental_toughness INTEGER CHECK (mental_toughness BETWEEN 1 AND 10),
  communication    INTEGER CHECK (communication    BETWEEN 1 AND 10),
  notes            TEXT,
  coaching_tip     TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (coach_user_id, player_user_id)
);
CREATE INDEX IF NOT EXISTS coach_evaluations_coach_idx  ON coach_evaluations(coach_user_id);
CREATE INDEX IF NOT EXISTS coach_evaluations_player_idx ON coach_evaluations(player_user_id);

-- ── scout profiles ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scout_profiles (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  designation          TEXT,
  organization_name    TEXT,
  org_type             TEXT,
  region               TEXT,
  years_experience     INTEGER,
  proof_url            TEXT,
  preferred_age_groups TEXT[],
  preferred_roles      TEXT[],
  preferred_regions    TEXT[],
  profile_status       VARCHAR(40) DEFAULT 'Draft',
  submitted_at         TIMESTAMPTZ,
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id)
);
CREATE INDEX IF NOT EXISTS scout_profiles_user_idx   ON scout_profiles(user_id);
CREATE INDEX IF NOT EXISTS scout_profiles_status_idx ON scout_profiles(profile_status);

-- ── player performance summary (academy-managed stats) ───────
CREATE TABLE IF NOT EXISTS player_performance_summary (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  matches            INTEGER,
  innings            INTEGER,
  runs               INTEGER,
  batting_average    DECIMAL(6,2),
  strike_rate        DECIMAL(6,2),
  highest_score      INTEGER,
  fifties            INTEGER,
  hundreds           INTEGER,
  bowling_matches    INTEGER,
  wickets            INTEGER,
  overs              DECIMAL(6,1),
  economy            DECIMAL(5,2),
  bowling_average    DECIMAL(6,2),
  catches            INTEGER,
  stumpings          INTEGER,
  runouts            INTEGER,
  best_figures       VARCHAR(10),
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (user_id)
);
CREATE INDEX IF NOT EXISTS player_performance_summary_user_idx ON player_performance_summary(user_id);

-- ── email verifications ──
CREATE TABLE IF NOT EXISTS email_verifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS email_verifications_user_idx  ON email_verifications(user_id);
CREATE INDEX IF NOT EXISTS email_verifications_token_idx ON email_verifications(token);

-- ── batches ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS batches (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id        UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  coach_id          UUID REFERENCES academy_coaches(id) ON DELETE SET NULL,
  batch_name        VARCHAR(120) NOT NULL,
  age_group         VARCHAR(20),
  schedule_days     TEXT[],
  schedule_time     VARCHAR(40),
  max_players       INTEGER,
  batch_status      VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS batches_academy_idx ON batches(academy_id);
CREATE INDEX IF NOT EXISTS batches_coach_idx   ON batches(coach_id);
CREATE INDEX IF NOT EXISTS batches_status_idx  ON batches(batch_status);

-- ── batch_players ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS batch_players (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id          UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  player_profile_id UUID NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  joined_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (batch_id, player_profile_id)
);
CREATE INDEX IF NOT EXISTS batch_players_batch_idx  ON batch_players(batch_id);
CREATE INDEX IF NOT EXISTS batch_players_player_idx ON batch_players(player_profile_id);
