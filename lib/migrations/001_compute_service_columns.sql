-- Migration: Add compute service columns
-- Run this in the Neon SQL editor (neon.tech → your project → SQL Editor)
-- Safe to run multiple times — all ADD COLUMN IF NOT EXISTS

-- ── behavioral_assessment ───────────────────────────────────────────────────
ALTER TABLE behavioral_assessment
  ADD COLUMN IF NOT EXISTS acsi_raw_responses JSONB,
  ADD COLUMN IF NOT EXISTS compute_task_id    TEXT,
  ADD COLUMN IF NOT EXISTS compute_status     TEXT,
  ADD COLUMN IF NOT EXISTS compute_result     JSONB,
  ADD COLUMN IF NOT EXISTS is_stub            BOOLEAN NOT NULL DEFAULT false;

-- ── video_analysis ─────────────────────────────────────────────────────────
ALTER TABLE video_analysis
  ADD COLUMN IF NOT EXISTS compute_task_id TEXT,
  ADD COLUMN IF NOT EXISTS compute_status  TEXT,
  ADD COLUMN IF NOT EXISTS is_stub         BOOLEAN NOT NULL DEFAULT false;

-- ── match_logs ─────────────────────────────────────────────────────────────
ALTER TABLE match_logs
  ADD COLUMN IF NOT EXISTS compute_task_id TEXT,
  ADD COLUMN IF NOT EXISTS compute_status  TEXT,
  ADD COLUMN IF NOT EXISTS review_status   TEXT DEFAULT 'PENDING_REVIEW',
  ADD COLUMN IF NOT EXISTS is_stub         BOOLEAN NOT NULL DEFAULT false;

-- Mark old hardcoded-verified scorecards as stub data so they don't
-- pollute real OCR-verified records going forward.
UPDATE match_logs
SET review_status = 'STUB_DATA', is_stub = true
WHERE ocr_status = 'VERIFIED'
  AND (review_status IS NULL OR review_status = 'PENDING_REVIEW');
