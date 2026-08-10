-- Migration 004: training_sessions, session_attendance, session_notes, session_note_players
-- Run in Neon SQL Editor → Run (not Explain). Safe to re-run.

-- ── training_sessions ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS training_sessions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id         UUID NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  batch_id           UUID REFERENCES batches(id) ON DELETE SET NULL,
  coach_id           UUID REFERENCES academy_coaches(id) ON DELETE SET NULL,
  session_date       DATE NOT NULL,
  start_time         VARCHAR(10),
  end_time           VARCHAR(10),
  session_type       VARCHAR(40) DEFAULT 'Practice',
  venue              VARCHAR(120),
  title              VARCHAR(160),
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS training_sessions_academy_idx ON training_sessions(academy_id);
CREATE INDEX IF NOT EXISTS training_sessions_batch_idx   ON training_sessions(batch_id);
CREATE INDEX IF NOT EXISTS training_sessions_date_idx    ON training_sessions(session_date);

-- ── session_attendance ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session_attendance (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  player_profile_id UUID NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  status            VARCHAR(10) NOT NULL DEFAULT 'UNMARKED',
  marked_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  marked_at         TIMESTAMPTZ,
  remarks           TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (session_id, player_profile_id),
  CONSTRAINT session_attendance_status_chk CHECK (status IN ('PRESENT', 'ABSENT', 'LATE', 'UNMARKED'))
);
CREATE INDEX IF NOT EXISTS session_attendance_session_idx ON session_attendance(session_id);
CREATE INDEX IF NOT EXISTS session_attendance_player_idx  ON session_attendance(player_profile_id);
CREATE INDEX IF NOT EXISTS session_attendance_status_idx  ON session_attendance(status);

-- ── session_notes ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session_notes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  coach_id           UUID REFERENCES academy_coaches(id) ON DELETE SET NULL,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  body               TEXT NOT NULL,
  visibility         VARCHAR(20) NOT NULL DEFAULT 'COACHES',
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT session_notes_visibility_chk CHECK (visibility IN ('COACHES', 'PLAYERS', 'PRIVATE'))
);
CREATE INDEX IF NOT EXISTS session_notes_session_idx ON session_notes(session_id);
CREATE INDEX IF NOT EXISTS session_notes_coach_idx   ON session_notes(coach_id);

-- ── session_note_players ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS session_note_players (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id           UUID NOT NULL REFERENCES session_notes(id) ON DELETE CASCADE,
  player_profile_id UUID NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  UNIQUE (note_id, player_profile_id)
);
CREATE INDEX IF NOT EXISTS session_note_players_note_idx   ON session_note_players(note_id);
CREATE INDEX IF NOT EXISTS session_note_players_player_idx ON session_note_players(player_profile_id);
