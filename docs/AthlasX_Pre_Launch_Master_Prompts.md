# AthlasX — Pre-Launch Master Prompts (10)

Grounded in a live read-only audit of the real repo run just before this doc was written — every item below is a verified finding, not a guess. Ordered by launch risk: 1-3 are the ones I would not ship without fixing or explicitly accepting the risk in writing; 4-10 matter but are more judgment calls than landmines.

Paste each block into Claude Code as its own session/task — don't chain them, since several require you to make a product decision mid-task, not just code.

---

## 1. [HIGH] Fix the cross-association data leak in `/api/dashboard`

```
In src/app/api/dashboard/route.ts, several aggregate counts (registrations,
pendingIngest, formDropAlerts, and others — check the file for the full list)
are explicitly flagged in a code comment around line 27-33 as "NOT YET SCOPED."
The route requires auth, but an association_staff user currently sees GLOBAL
counts across every association, not just their own.

Fix: scope every one of these aggregates to the requesting user's
association_id (or the appropriate scope for their role), the same way
src/lib/association/verification-gate.ts already scopes other association
queries. Do not touch auth/session logic — only the query filters.

After fixing, write or extend an integration test (tests/integration/ already
has role-gates.test.ts and association-verification-gate.test.ts as examples
of the pattern to follow) that creates two associations and asserts one
association_staff user cannot see the other's counts.

Run npx tsc --noEmit and the integration test suite before calling this done.
```

## 2. [HIGH] Decide and finish Scout verification gating

```
src/app/(dashboard)/scout/page.tsx (~line 117-129) shows a banner telling
scouts their account is pending AthlasX Ops verification — but its own code
comment admits nothing in the codebase actually reads verification_status to
gate anything for scouts, and there is no Ops approval surface for scouts at
all (unlike associations, which have a real gate at
src/lib/association/verification-gate.ts plus an Ops approval page at
src/app/(dashboard)/ops/associations/pending/page.tsx).

This is a product decision, not just a code fix — tell me first which of
these you want before writing code:
(a) Build the real thing: a scout verification_status gate mirroring
    association's pattern, plus an Ops approval surface at something like
    ops/scouts/pending, OR
(b) Ship without gating for v1: remove the banner (it currently promises
    something that doesn't happen) and document that scout accounts are
    live immediately on signup, no review step, OR
(c) Keep the banner but make it honest: reword it to say review is
    informational only and does not currently restrict access.

Once I've told you which option, implement only that option.
```

## 3. [HIGH] Resolve TrendAlert — it has no live generation mechanism

```
Prisma model TrendAlert (schema.prisma ~line 1016-1030) is only ever written
by prisma/seed.ts — there is no .create or .upsert call anywhere in src/, and
no cron/scheduled job exists. Any UI showing "trend alerts" driven by this
table will show only stale seed data in production; new declining-performance
patterns will never surface.

By contrast, PlayerWeek (real write path: src/app/api/coach/[playerId]/evaluate/route.ts)
and Grade (src/app/api/grading/[sessionId]/grade/route.ts) DO have live write
paths and can honestly back trend/sparkline UI built on them.

Decide and tell me first:
(a) Build the real detection logic — a scheduled job (or an on-write trigger
    inside the PlayerWeek upsert route) that evaluates consecutive_declining_weeks
    and writes real TrendAlert rows, OR
(b) Drop TrendAlert-driven UI elements for launch and rebuild any "alert"
    surfaces directly off PlayerWeek's rolling_4week_average / score_delta
    fields instead, which are already live.

This directly answers the "should these dashboards show trend alerts" question
— option (b) is faster and still honest; option (a) is the fuller feature.
Implement only the option I confirm.
```

## 4. [MEDIUM-HIGH] Move the four feature flags to env vars and resolve the flag-doc conflicts

```
src/lib/feature-flags.ts hardcodes four flags as TypeScript booleans (not env
vars, despite the _ENABLED naming) — all currently true:
- FRANCHISE_SCOUT_ENABLED — comment says "Temporarily true — auditing /scout...
  revert to false once audit done." That audit is effectively complete now —
  confirm with me whether this should flip to false or stay true for launch.
- ACADEMY_SELF_SERVE_ENABLED — comment flags an unresolved conflict with the
  pivot doc, which says no individual-academy self-serve sales in phase 1.
  This needs a real answer from me before launch, not a default — ask me.
- SCOUT_SELF_SERVE_ENABLED, ASSOCIATION_SELF_SERVE_ENABLED — confirm intended
  launch state with me.

Once I've told you the intended value for each, two things:
1. Set them to their launch values.
2. Convert all four from hardcoded booleans to env-var-driven (default to
   their launch value if the env var is unset), so a future toggle is a
   config change + redeploy, not a code change + PR.
```

## 5. [MEDIUM] Fix env-var documentation drift before anyone else sets up this project

```
.env.local.example has three real problems, verified by reading it against
actual usage:
1. DATABASE_DIRECT_URL is required (schema.prisma line 39, directUrl) but is
   MISSING from the example file entirely — add it.
2. The file's comment claims the DB is "Neon Postgres" but
   docs/AthlasX_DB2_Pending_Migrations_Apply_Fix.md confirms the real host is
   Supabase (db.haexxhxjcwjpnnyoxcnq.supabase.co) — fix the comment.
3. AADHAAR_HMAC_SECRET and NEXT_PUBLIC_APP_URL are documented but grep finds
   ZERO usages anywhere in src/ — src/lib/aadhaar-verification.ts is an
   explicit dev-stub with no real UIDAI/eKYC vendor wired up.

For #3, tell me first: is real Aadhaar/eKYC verification required before
launch (this is presumably a compliance-relevant claim if it's shown to
users), or is the stub acceptable for v1? If the stub is acceptable, make
sure nothing in onboarding UI copy implies verification actually happened —
grep onboarding pages for "verified"/"Aadhaar" copy and report what you find
before changing anything.
```

## 6. [MEDIUM] Get a definitive answer on whether the 5 pending migrations are actually live

```
prisma/manual_migrations/ has 7 SQL files; docs/AthlasX_DB2_Pending_Migrations_Apply_Fix.md
says 5 of them (academy_batches_and_related.sql, player_phase1_high.sql,
academy_phase1_high.sql, association_verification_status.sql,
scout_role_and_profile.sql) were not yet applied to the live DB as of when
that doc was written. schema.prisma already reflects all 5 migrations' target
state, but that only proves file intent — nobody has confirmed the LIVE
database actually has these tables/columns, because neither this Claude Code
session nor the cloud sandbox that audited this can reach the DB host.

You can reach it. Run this before anything else in this task:
  npx prisma migrate status
(or, if that doesn't apply since these are manual SQL not prisma migrations,
connect directly — e.g. psql "$DATABASE_URL" -c "\d association" — and check
for the verification_status column, and similarly spot-check one column from
each of the other 4 migrations).

Report definitively: applied or not, for each of the 5. If any are missing,
apply them in the order the doc specifies (academy_batches_and_related.sql
before player_phase1_high.sql) and re-verify.
```

## 7. [MEDIUM] Add App Router error/loading/not-found boundaries

```
find confirms there is no error.tsx, loading.tsx, or not-found.tsx anywhere
in src/app. Every dashboard page currently handles its own loading/error/empty
states manually with useState — which works for known, handled failure paths,
but an unexpected exception (a bug, a null-pointer on unexpected API shape)
currently has no framework-level fallback and will show Next.js's raw error
overlay or a blank screen in production.

Add:
- A root src/app/error.tsx (client component) with a generic "something went
  wrong" screen styled on the existing ax.* token system, with a retry button.
- A root src/app/not-found.tsx for unmatched routes, same visual system.
- Per-role loading.tsx only where a dashboard's initial data fetch is slow
  enough to benefit from a route-level skeleton instead of the current
  client-side spinner — check with me which routes actually need this rather
  than adding it everywhere by default.

Don't change the existing manual error/loading handling inside pages — this
is a safety net underneath it, not a replacement.
```

## 8. [MEDIUM] Add error tracking before launch

```
Grep confirms there is no Sentry, Datadog, LogRocket, Bugsnag, or Rollbar
integration anywhere in this codebase, and package.json has no such
dependency. Right now, a production error is invisible unless a user reports
it manually.

Add Sentry (or ask me first if you have a different preference) for both the
Next.js server and client sides, following their official Next.js SDK setup.
Wire it into the new error.tsx from task 7 so unhandled exceptions are both
shown to the user AND reported. Do not add any other new dependency without
confirming with me first — this is the one exception I'm pre-approving because
shipping with zero error visibility is the risk I most want closed before we
go live.
```

## 9. [MEDIUM] Harden login against brute force; decide on password reset

```
src/lib/rate-limit.ts is used on 15 routes (signup, onboarding, OTP, etc.) but
NOT on the NextAuth credentials login route
(src/app/api/auth/[...nextauth]/route.ts) — that's handled by NextAuth
internals with no custom rate limiting layered on top, so repeated failed
logins against one account are currently unmitigated.

Also: there is no forgot-password/password-reset route anywhere in this
codebase — it's an absent feature, not a bug. Confirm with me whether that's
acceptable for v1 (many B2B-ish launches ship without it and add it fast
after) or launch-blocking.

Once confirmed:
1. Add rate limiting to the credentials login callback (per-email and/or
   per-IP) using the existing rate-limit.ts helper/pattern.
2. If password reset is needed for launch, scope it as its own follow-up
   task rather than bolting it on here — tell me and I'll write that prompt
   separately once this one's done.
```

## 10. [LOW-MEDIUM, but do it last before go-live] Actually run the test suite

```
This repo has a real, structured test setup that has never been executed in
any audit so far — only confirmed to exist: vitest.config.mts,
playwright.config.ts, tests/unit/ (6 files), tests/integration/ (14 files
including role-gates.test.ts and association-verification-gate.test.ts),
tests/security/auth-and-consent.test.ts, tests/known-defects/
engine-and-matching.test.ts, tests/e2e/workflows.spec.ts, and granular
package.json scripts (test:unit, test:integration, test:security, test:ci,
test:e2e, test:coverage, test:setup-db).

Run test:setup-db if needed, then run test:ci (or each granular script if
test:ci doesn't exist) end to end against a real test database. Report every
failure with the actual assertion output, not a summary. Fix genuine bugs the
tests catch; if a test itself looks wrong or outdated (e.g. testing behavior
that was intentionally changed later in this engagement), flag it to me
rather than deleting or loosening the assertion.

This should be the last of the 10 you run, after tasks 1-9 land, so the suite
is testing the launch-ready state rather than an interim one.
```
