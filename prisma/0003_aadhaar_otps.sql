-- ── Aadhaar OTP table — mirrors phone_otps for the Aadhaar verify step ────
-- Idempotent — safe to re-run against existing databases.

CREATE TABLE IF NOT EXISTS aadhaar_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  aadhaar_last4 VARCHAR(4) NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  attempts INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS aadhaar_otps_user_id_idx ON aadhaar_otps(user_id);
CREATE INDEX IF NOT EXISTS aadhaar_otps_expires_idx ON aadhaar_otps(expires_at);
