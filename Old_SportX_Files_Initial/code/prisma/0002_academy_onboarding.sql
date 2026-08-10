-- ── Academy onboarding: extend academies table ──────────────────────────
-- Idempotent ALTERs — safe to run against existing databases.

ALTER TABLE academies ADD COLUMN IF NOT EXISTS academy_logo        TEXT;
ALTER TABLE academies ADD COLUMN IF NOT EXISTS academy_description TEXT;
ALTER TABLE academies ADD COLUMN IF NOT EXISTS founded_year        INTEGER;
ALTER TABLE academies ADD COLUMN IF NOT EXISTS address             TEXT;
ALTER TABLE academies ADD COLUMN IF NOT EXISTS website             TEXT;
ALTER TABLE academies ADD COLUMN IF NOT EXISTS contact_name        TEXT;
ALTER TABLE academies ADD COLUMN IF NOT EXISTS contact_email       TEXT;
ALTER TABLE academies ADD COLUMN IF NOT EXISTS contact_phone       TEXT;
ALTER TABLE academies ADD COLUMN IF NOT EXISTS age_groups          TEXT[]  DEFAULT '{}';
ALTER TABLE academies ADD COLUMN IF NOT EXISTS facilities          TEXT[]  DEFAULT '{}';
ALTER TABLE academies ADD COLUMN IF NOT EXISTS specialties         TEXT[]  DEFAULT '{}';
ALTER TABLE academies ADD COLUMN IF NOT EXISTS academy_verified    BOOLEAN DEFAULT false;
ALTER TABLE academies ADD COLUMN IF NOT EXISTS profile_status      TEXT    DEFAULT 'Draft'
  CHECK (profile_status IN ('Draft','Live','Suspended'));
ALTER TABLE academies ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMPTZ DEFAULT now();

-- Rename verification_status → profile_status if old column still exists
-- (safe no-op if already done)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'academies' AND column_name = 'verification_status'
  ) THEN
    UPDATE academies SET profile_status = CASE verification_status
      WHEN 'PENDING'  THEN 'Draft'
      WHEN 'APPROVED' THEN 'Live'
      WHEN 'REJECTED' THEN 'Suspended'
      ELSE 'Draft'
    END WHERE profile_status IS NULL OR profile_status = 'Draft';
  END IF;
END $$;

-- ── Academy coaches ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS academy_coaches (
  coach_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id       UUID REFERENCES academies(id) ON DELETE CASCADE,
  user_id          UUID REFERENCES users(id),
  coach_name       TEXT NOT NULL,
  specialization   TEXT CHECK (specialization IN (
                     'Batting','Bowling','Fitness',
                     'Wicketkeeping','Mental Conditioning')),
  years_experience INTEGER,
  certifications   TEXT,
  profile_photo    TEXT,
  bio              TEXT,
  can_submit_evaluations        BOOLEAN DEFAULT false,
  can_submit_fitness_assessments BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS academy_coaches_academy_idx ON academy_coaches(academy_id);

-- ── Email verification tokens ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_verifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_verifications_token_idx ON email_verifications(token);
