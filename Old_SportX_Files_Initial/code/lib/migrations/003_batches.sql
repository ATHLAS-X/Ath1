-- Migration 003: batches and batch_players
-- Run in Neon SQL Editor → Run (not Explain). Safe to re-run.

-- ── batches ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS batches (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id         UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  coach_id           UUID REFERENCES academy_coaches(id) ON DELETE SET NULL,
  batch_name         VARCHAR(120) NOT NULL,
  age_group          VARCHAR(20),
  schedule_days      TEXT[],
  schedule_time      VARCHAR(40),
  max_players        INTEGER,
  batch_status       VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  created_at         TIMESTAMPTZ DEFAULT NOW()
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
