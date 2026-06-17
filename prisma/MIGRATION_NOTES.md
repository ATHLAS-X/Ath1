# Prisma migration notes

## Current state

- `prisma/schema.prisma` — 14 models + 13 enums, generated from the V1 data model doc
- `prisma/0001_initial.sql` — the SQL Prisma would emit for a fresh database
- `prisma validate` ✅ passes
- `prisma generate` ✅ Prisma Client built into `node_modules/@prisma/client`

The migration has **not been applied** to your Neon DB.

## Why we didn't auto-apply

Your live Neon DB already has 14 tables from `lib/schema.sql`. Running
`prisma migrate dev` against it would either:
- error out on conflicting tables, or
- destroy existing data (with `--force`).

## Three options for applying

### Option A — Fresh staging DB (lowest risk)
1. Create a second Neon branch or DB (e.g. `sportx_v2`).
2. Set its URL in `.env.local` as `DATABASE_URL`.
3. Run `npx prisma migrate dev --name initial`.
4. Port lib/db.ts queries to Prisma incrementally.
5. Cut over when ready.

### Option B — Baseline against existing tables
The current `lib/schema.sql` tables and the new Prisma models have
different names and shapes (e.g. our `users` table vs Prisma's `users`
with a different column set). Baselining will surface diffs.

```bash
# Generate a snapshot of what's actually in the DB
npx prisma db pull --print > prisma/current_db.prisma
# Compare against schema.prisma — manually reconcile
```

Then create a baseline migration that captures the current state, and a
second migration that morphs it into the new schema.

### Option C — Phased rewrite (recommended)
Don't migrate the schema yet. Instead:
1. Keep `lib/schema.sql` as the source of truth for the running app.
2. Use Prisma Client for **new** features only (e.g. Academy, Tournament
   Organizer flows the doc adds).
3. Migrate tables one at a time as we touch them, using `prisma db pull`
   on each table to keep schemas in sync.
4. Eventually retire `lib/db.ts` and `lib/schema.sql` once all queries
   move to Prisma.

## Env var loading

Prisma CLI reads `.env`, not `.env.local`. Either:
- Copy `DATABASE_URL=...` into a top-level `.env` for CLI use, or
- Run Prisma commands with the var inlined:
  `DATABASE_URL="$(grep DATABASE_URL .env.local | cut -d= -f2-)" npx prisma <cmd>`

## Field-level changes vs the doc

A few small interpretations:

- `User.role` and `User.source_channel` are both enums; the doc lumps
  scout/academy/etc. under both "user type" and "source channel" without
  a clean split. Kept both — `role` controls permissions; `source_channel`
  controls funnel attribution.
- `PlayerProfile.school_team/club_team/district_team/state_team` are
  free-text fields per the doc rather than FKs to a teams table. V2 can
  promote them.
- Fitness/Behavioural assessments are time-series (1:many per player) so
  cached "latest" snapshots live on `PlayerProfile` for fast list views.
- `Verification` is per-claim — multiple rows per player, one per
  verification type (`SELF`, `IDENTITY`, `PERFORMANCE`, `SCOUT`).
