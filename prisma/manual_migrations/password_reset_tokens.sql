-- Password reset tokens, plus users.password_changed_at, for the self-serve
-- password reset and signed-in change-password flows.
--
-- NOT YET APPLIED to the live database. Requires explicit go-ahead, like every
-- schema change on this project.
--
-- Safe to re-run: every statement is guarded, and the whole file runs in one
-- transaction, so a failure part-way through leaves nothing half-applied.
--
-- Apply with the direct (unpooled) connection — DDL needs a real session:
--   npx prisma db execute --file prisma/manual_migrations/password_reset_tokens.sql --url "$DATABASE_DIRECT_URL"
--
-- After applying, redeploy (or restart the server): session-role-refresh.ts
-- remembers per process that the column was missing and won't re-check.

BEGIN;

-- CreateTable
CREATE TABLE IF NOT EXISTS "athlasx"."password_reset_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_token_hash_key" ON "athlasx"."password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "password_reset_tokens_user_id_idx" ON "athlasx"."password_reset_tokens"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "password_reset_tokens_expires_at_idx" ON "athlasx"."password_reset_tokens"("expires_at");

-- AddForeignKey — Postgres has no ADD CONSTRAINT IF NOT EXISTS, so check the catalog.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'password_reset_tokens_user_id_fkey'
      AND conrelid = '"athlasx"."password_reset_tokens"'::regclass
  ) THEN
    ALTER TABLE "athlasx"."password_reset_tokens"
      ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id")
      REFERENCES "athlasx"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddColumn — stamped on every password change; privileged sessions signed in
-- before it are rejected (src/lib/session-role-refresh.ts).
ALTER TABLE "athlasx"."users" ADD COLUMN IF NOT EXISTS "password_changed_at" TIMESTAMPTZ(6);

COMMIT;
