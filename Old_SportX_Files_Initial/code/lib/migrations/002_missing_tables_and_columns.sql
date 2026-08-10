-- Migration 002: missing tables and columns
-- Run in Neon SQL Editor → Run (not Explain). Safe to re-run.

-- ── academies: onboarding tracking columns ──────────────────
ALTER TABLE academies
  ADD COLUMN IF NOT EXISTS onboarding_step         INTEGER     DEFAULT 1,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- ── scout_profiles ───────────────────────────────────────────
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

-- ── player_performance_summary ───────────────────────────────
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
