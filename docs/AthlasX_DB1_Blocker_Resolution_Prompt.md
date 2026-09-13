# AthlasX — DB-1 blocker resolution: live-diff, apply, verify

Supersedes Prompt DB-1 in `AthlasX_Followup_Fix_Prompts.md`. That prompt assumed
the `academy_admin` enum migration still needed drafting — it doesn't anymore.
A Cowork session (2026-09-09/10, working directly against your machine's checkout)
found both pending-migration files already exist **and are already committed**,
in the most recent commit on `main`:

```
f2969e2 feat: security hardening, page-level auth gates, dashboard fixes, and academy/coach onboarding work
  prisma/manual_migrations/player_phase1_high.sql   (already existed, per your notes)
  prisma/manual_migrations/academy_admin_role.sql   (new — not mentioned in
                                                       AthlasX_Engagement_Context_Summary.md,
                                                       which predates this commit by ~5 hours)
```

Two corrections to carry forward from that review:

1. `player_phase1_high.sql` adds `gender` to **`player_profiles` only** — there is
   no `gender` field on the `User` model anywhere in `prisma/schema.prisma`. The
   "User/PlayerProfile" phrasing in the engagement summary overstates the scope
   by one table; don't go looking for a `users.gender` column that was never
   specced.
2. `player_phase1_high.sql` has no `IF NOT EXISTS` / idempotency guard on any of
   its `CREATE TYPE` or `ADD COLUMN` statements. If it's ever run twice, or run
   after a partial prior attempt, it will error out mid-statement rather than
   no-op. That's exactly why step 1 below (the live diff) isn't optional — it's
   the only way to know whether this is a clean apply or a partial-state cleanup.

The Cowork session could not pull a fresh live-DB diff itself — its shell
resolves this repo through a sandboxed Linux VM with no DNS route to
`*.pooler.supabase.com` (blocked at the network layer, not a permissions
question) and no cached Postgres schema-engine binary for that platform. Your
Claude Code CLI, running natively, has already proven real DB connectivity this
engagement (`SELECT 1` succeeded) — so Prompt 1 below needs to run there, not
in Cowork.

---

## Prompt 1 — fresh live-DB diff (read-only, confirms nothing is silently already applied)

```
Run, from C:\Users\saura\Claude\Projects\AthlasX:

  npx prisma migrate diff --from-url "%DATABASE_DIRECT_URL%" --to-schema-datamodel prisma/schema.prisma --script

(or the equivalent for your shell — read DATABASE_DIRECT_URL from .env.local,
never type the credential inline). This prints the SQL needed to bring the live
DB in line with prisma/schema.prisma as it stands right now on main, which
already includes both pending changes (gender + related Player Phase-1-HIGH
columns, and academy_admin in the UserRole enum).

Show me the full output. Do not run anything else yet — this is read-only.

If the diff is empty or doesn't mention `gender` and `academy_admin`, stop and
tell me — it would mean one or both were already applied by someone/something
outside this record, and re-running the manual migration files would error.

If the diff matches (or is a superset of) the two manual migration files below,
proceed to Prompt 2.
```

## Prompt 2 — print both migrations for final review

```
Print the full contents of:
  - prisma/manual_migrations/player_phase1_high.sql
  - prisma/manual_migrations/academy_admin_role.sql

Also print `git log -1 --format='%H %ad %s' -- <each file>` for both, so I can
see they're the same versions committed in f2969e2 and nothing local has
diverged from what's on main.

Do not apply anything. Wait for my explicit "apply both" as its own message.
```

## Prompt 3 — apply (only after I send "apply both" as its own separate message)

```
Apply both migrations against DATABASE_DIRECT_URL only (never the pooler URL),
in this order — enum first, then the player_profiles columns:

  1. psql "%DATABASE_DIRECT_URL%" -f prisma/manual_migrations/academy_admin_role.sql
  2. psql "%DATABASE_DIRECT_URL%" -f prisma/manual_migrations/player_phase1_high.sql

(or npx prisma db execute --file=<path> --url="%DATABASE_DIRECT_URL%" for each,
whichever this environment has working — confirm which before running).

Sequencing rationale: the enum add has no dependency on the column changes: if
something goes wrong partway, the alter-table (which touches more columns and
adds a real FK to academy_batches) isn't the one left half-applied.

Stop and show me the exact error if either step fails partway — do not attempt
a cleanup or retry on your own judgment.
```

## Prompt 4 — verify live, then re-attempt the two flows this was blocking

```
After both migrations apply cleanly:

1. Confirm live: SELECT unnest(enum_range(NULL::"athlasx"."UserRole")) — confirm
   academy_admin is present. SELECT column_name FROM information_schema.columns
   WHERE table_schema='athlasx' AND table_name='player_profiles' AND
   column_name='gender' — confirm it exists.
2. Re-attempt a real academy_admin account creation through actual signup
   (not a DB insert) — this is the flow the engagement summary flagged as
   never having fully succeeded because the enum value it needed didn't exist.
3. Re-attempt player onboarding completion end-to-end (the flow blocked on the
   missing gender column) and confirm the player-dashboard redirect now works.

Report pass/fail on both flows explicitly — "the migration applied" is not the
same claim as "the flow works," and this engagement's standing rule is that
self-reported "done" gets an independent check, not just a migration exit code.
```

---

## What NOT to do

- Don't run Prompt 3 until Prompt 1's diff has actually been shown and reviewed
  — a migration file matching what's in git is not the same guarantee as a
  migration that matches what's live, especially with no idempotency guards.
- Don't run Prompt 3 on a casual "sounds good" — it needs "apply both" as its
  own explicit message, per the standing engagement rule.
- Don't touch the pooler URL (`DATABASE_URL`) for either apply step.
- Don't "fix" the missing idempotency guards in the migration files as a side
  effect of this — that's a separate, smaller decision (rewrite as
  IF-NOT-EXISTS-guarded SQL) worth its own explicit yes/no, not something to
  bundle into an unrelated apply.
