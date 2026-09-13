# AthlasX — apply the 5 pending migrations (fixes the Scout signup 500)

## Why the Scout signup fails right now

`POST /api/scout/onboard` tries to insert a `User` with `role: 'scout'` and a
`ScoutProfile` row. The live database has never had `scout` added to the
`UserRole` enum, so Postgres rejects the insert, the route's catch block only
special-cases the duplicate-email case, and the unhandled 500 comes back with
an empty body — which is what makes the wizard's `res.json()` throw
"Unexpected end of JSON input". Root cause: none of the 5 non-trivial pending
migrations below have been applied to the live DB yet, even though all 3
self-serve flags (`ACADEMY_SELF_SERVE_ENABLED`, `SCOUT_SELF_SERVE_ENABLED`,
`ASSOCIATION_SELF_SERVE_ENABLED`) are already `true`.

## I cannot run this myself — confirmed, not a caution

Checked both execution environments I have access to, just now:
- The cloud container has no DNS route to the Supabase DB host and gets 403
  from Prisma's binary CDN (documented earlier this session).
- **This device's sandboxed shell also cannot reach the DB host** —
  `getent hosts db.haexxhxjcwjpnnyoxcnq.supabase.co` returns "Temporary
  failure in name resolution", and `binaries.prisma.sh` /
  `checkpoint.prisma.io` both time out (curl exit 000), which is also why
  plain `prisma --version` hangs here. npm's registry is reachable (200), so
  it's specifically the DB host and Prisma's own CDN that are blocked, not
  the network in general.

This means the app's dev server that you tested the wizard against is
running in a context I can't shell into (your native Windows terminal, not
this VM). **Run the commands below yourself**, in the terminal where
`npm run dev` already works.

## A real bug in the naive apply order

`player_phase1_high.sql` adds `player_profiles.batch_id` with a foreign key
to `academy_batches`. That table doesn't exist yet — it's created by
`academy_batches_and_related.sql`. Applying `player_phase1_high.sql` before
`academy_batches_and_related.sql` will fail with `relation "academy_batches"
does not exist`. **Order matters**; everything else here is independent.

`academy_admin_role.sql` already succeeded against this DB earlier in this
session — skip it, it's not in the list below.

## The fix — run in order

All 5 are additive (new nullable/defaulted columns, new enum values, new
tables) — nothing here drops or rewrites existing data.

```bash
cd path/to/AthlasX   # wherever this repo actually sits on your machine

# Load DATABASE_DIRECT_URL from .env.local into this shell
set -a; source <(grep -E '^DATABASE_DIRECT_URL=' .env.local); set +a

# 1. MUST run before player_phase1_high.sql (creates academy_batches, which
#    that file's batch_id foreign key points at)
npx prisma db execute --file prisma/manual_migrations/academy_batches_and_related.sql --url "$DATABASE_DIRECT_URL"

# 2. Depends on #1 (batch_id -> academy_batches fk)
npx prisma db execute --file prisma/manual_migrations/player_phase1_high.sql --url "$DATABASE_DIRECT_URL"

# 3-5: independent of each other and of #1/#2, order among these 3 doesn't matter
npx prisma db execute --file prisma/manual_migrations/academy_phase1_high.sql --url "$DATABASE_DIRECT_URL"
npx prisma db execute --file prisma/manual_migrations/association_verification_status.sql --url "$DATABASE_DIRECT_URL"
npx prisma db execute --file prisma/manual_migrations/scout_role_and_profile.sql --url "$DATABASE_DIRECT_URL"

# Regenerate the client so TypeScript/runtime see the new columns, tables,
# and the 'scout' enum value
npx prisma generate
```

If any single command fails partway, stop and show me the exact error before
re-running anything — don't retry a failed `CREATE TYPE`/`CREATE TABLE`
blind, since none of these files have `IF NOT EXISTS` guards and a partial
failure can leave the next statement in the same file half-applied.

## After it succeeds

1. Restart `npm run dev` (picks up the regenerated Prisma client).
2. Retry the Scout onboarding wizard end to end — Step 1 (OTP) through
   Step 2 submit — and confirm a `scout_profiles` row and a `users` row with
   `role='scout'` actually land in the DB.
3. Worth a quick pass on the Academy and Association wizards too, since
   `academy_phase1_high.sql` and `association_verification_status.sql` are
   in this same batch and haven't been exercised end-to-end against live
   data yet either.

## What NOT to do

- Don't run these against `DATABASE_URL` (the pooler) — DDL like
  `CREATE TYPE`/`ALTER TABLE` should go through `DATABASE_DIRECT_URL`
  (direct connection), same convention as every other migration this
  session.
- Don't re-run `academy_admin_role.sql` — it already succeeded.
- If you have Supabase point-in-time recovery or can take a quick backup
  first, do it — these are additive and low-risk, but they're still live
  schema changes with no rollback script written.
