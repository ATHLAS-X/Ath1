# AthlasX Folder Restructure — Prompts

## 0. Stop conditions — check both before running anything below

**[Certain] There is a live `.git/index.lock` in the repo right now** (`.git/index.lock`, timestamped today). That means either a git command is actively mid-run on your machine (most likely local Claude Code finishing a commit) or a previous one crashed and left a stale lock. Running any git command while this sits there risks a corrupted index. Do not touch git until you've confirmed no git process is running, then delete the lock file yourself if it's stale (I can't delete files through the bridge).

**[Certain] There's an entire undecided feature sitting uncommitted in the tree.** `git status` shows ~27 new untracked paths for an academy admin/roster feature that was never cleared for build: `src/app/(dashboard)/academy/`, `src/app/(dashboard)/coach-signups/`, `src/app/api/academy/{attendance-flags,batches,dashboard,join-requests,join,players}/`, `src/app/api/association/`, `src/app/join/`, `src/lib/academy/{attendance-flags,batches,guardian-otp,join-requests,players,profile-fields,scope}.ts`, `tests/integration/academy/`. Two commits already landed adding an `academy_admin` role and nav sections (`90bdbd6`, `8ad5f52`). This is the exact scope I flagged earlier as unaddressed (the pre-existing `AcademyBatch`/`AcademyJoinRequest`/`AcademyAttendanceFlag` models predating the pivot doc) — it looks like it got built anyway while `ACADEMY_SELF_SERVE_ENABLED` is still `false`.

**Do not fold any of this into a "restructure" commit.** A mass rename on top of an unresolved, undecided feature buries it — nobody reviewing the restructure diff will notice a whole admin surface rode along inside it. Get a decision from you on the academy admin feature (ship it behind the flag, hold it, or revert it) and get the tree clean — commit or explicitly shelve — before starting Prompt R-1 below.

## 1. Why "frontend folder / backend folder" isn't the right shape here

**[Certain]** This is a Next.js App Router project. Route files (`page.tsx`, `route.ts`, `layout.tsx`) are not just organized under `src/app` — Next.js *derives the URL routing itself* from that directory's structure. Moving `src/app/api/academy/route.ts` into a top-level `backend/` folder, or `src/app/(dashboard)/academy/page.tsx` into a top-level `frontend/` folder, doesn't reorganize the app — it breaks routing outright. There's no config flag that changes this; it's the framework's addressing scheme.

**[Certain]** Your `src/app` tree is already named by functionality, not generically: `academy/`, `coach/`, `trial-cycles/`, `identity-exceptions/`, `academy-matching/`, `selection/`, `grading/`, `convergence/`, `tracking/` on the page side; matching names under `src/app/api/`. There isn't a naming problem here to fix.

**[Certain]** `src/components/` is 5 files in `ui/` (Button, Card, Input, Label, StepRail), 1 in `shared/`, 1 in `layout/`, 1 in `marketing/`. That's not a mess — `ui/` is cross-cutting primitives every domain page imports. Renaming `ui/` into per-domain folders would force you to duplicate Button/Card per feature, which is worse, not more consistent.

**[Likely]** What you're actually reacting to is `src/lib/` — 27 files sitting flat at the top level, roughly half of them already domain-prefixed by filename (`academy-capture.ts`, `academy-onboarding-otp.ts`, `academy-production.ts`, `association-scope.ts`, `identity-normalize.ts`, `identity-resolution.ts`, `identity-exception-attach.ts`, `player-cohort.ts`, `player-visibility.ts`) but not folder-scoped, next to genuinely cross-cutting infra (`auth.ts`, `db.ts`, `otp.ts`, `rate-limit.ts`, `require-auth.ts`, `upload.ts`, `password.ts`, `utils.ts`) that shouldn't be forced into a functionality folder at all — `db.ts` isn't a "functionality," it's the Prisma client singleton.

**Disagreement, structured:** I disagree with restructuring into `frontend/` and `backend/` top-level folders. Here's what I'd do instead: leave `src/app` and `src/components` alone (they're already functionality-named or correctly cross-cutting), and only reorganize `src/lib` into domain subfolders for the files that are actually domain-specific, leaving true infra at the root. The risk in the frontend/backend split is concrete — it either breaks Next.js routing (if you move route files) or produces cosmetic folders with no routing effect and 60+ files' worth of import churn for zero functional gain (if you don't).

## 2. Target `src/lib` layout

```
src/lib/
  academy/          (existing: attendance-flags, batches, guardian-otp, join-requests, players, profile-fields, scope
                      + move in: academy-capture.ts, academy-onboarding-otp.ts, academy-production.ts)
  association/       association-scope.ts
  identity/           identity-normalize.ts, identity-resolution.ts, identity-exception-attach.ts
  player/             player-cohort.ts, player-visibility.ts, verified-performances.ts, mock-performance-seed.ts
  ingest/            (existing — no change)
  scoring/            athlasx-score.ts, dossier.ts
  verification/       aadhaar-verification.ts, otp.ts, otp-log.ts
  # stays at src/lib root — cross-cutting infra, not a "functionality"
  auth.ts, db.ts, feature-flags.ts, password.ts, rate-limit.ts,
  require-auth.ts, squad-access.ts, string-similarity.ts, upload.ts, utils.ts, chrome.ts
```

`string-similarity.ts` and `squad-access.ts` are judgment calls — Claude Code should check actual call sites before deciding whether they're single-domain (move) or shared (leave at root), not just go by filename.

## 3. Prompts, in order

### Prompt R-0 — Safety check (run first, expect it to stop and report, not touch anything)

```
Before any restructuring work: check if a git process is currently running
(the repo has a .git/index.lock timestamped today). Do NOT run any git
command if one is active. If the lock is stale, tell me and wait for my
go-ahead before removing it — do not delete it yourself without confirming
first.

Then run `git status --short` and list every untracked path related to
academy/batches/join-requests/attendance-flags/academy_admin. Do not stage,
commit, or modify any of these files. Just report: what exists, whether it
compiles, and whether ACADEMY_SELF_SERVE_ENABLED still gates all of it at
the request level. Stop after reporting — this needs a decision from me
before anything else happens, restructuring included.
```

### Prompt R-1 — Reorganize `src/lib` by domain (only run after R-0 is resolved and the tree is clean)

```
Reorganize src/lib/ by domain, using git mv (not delete+recreate) so file
history is preserved. Target layout:

- src/lib/academy/  — move in academy-capture.ts, academy-onboarding-otp.ts,
  academy-production.ts (existing academy/ subfolder files stay put)
- src/lib/association/ — association-scope.ts
- src/lib/identity/ — identity-normalize.ts, identity-resolution.ts,
  identity-exception-attach.ts
- src/lib/player/ — player-cohort.ts, player-visibility.ts,
  verified-performances.ts, mock-performance-seed.ts
- src/lib/scoring/ — athlasx-score.ts, dossier.ts
- src/lib/verification/ — aadhaar-verification.ts, otp.ts, otp-log.ts

Leave at src/lib root (do not move): auth.ts, db.ts, feature-flags.ts,
password.ts, rate-limit.ts, require-auth.ts, upload.ts, utils.ts, chrome.ts.

For squad-access.ts and string-similarity.ts: check actual import call
sites first. If a file is only imported from one domain's routes/lib, move
it into that domain folder; if imported from 2+ unrelated domains, leave it
at root and tell me which case it was.

After each domain folder's moves, update every import path referencing the
moved files (grep for the old relative/alias paths — don't rely on the
IDE catching all of them), then run `npx tsc --noEmit` before moving to the
next domain. Do not proceed to the next domain group if typecheck fails —
fix it first. Do not touch src/app or src/components in this pass.

Commit each domain group separately (e.g. "refactor: group identity lib
files by domain") rather than one giant commit, same discipline as the
earlier commit-grouping work.
```

### Prompt R-2 — Audit-only pass on `src/app` naming (report, don't rename yet)

```
List every folder name under src/app/(dashboard)/ and src/app/api/ and flag
any that you think is unclear or doesn't describe its functionality. Do not
rename anything yet — just report the list with your reasoning per folder.
Remember: renaming here changes live URL routes (e.g. /academy-matching),
so anything renamed needs a corresponding check for hardcoded links, nav
config, and any redirects, and I need to sign off on the URL changes before
you touch them.
```

### Prompt R-3 — Verification (run after R-1, and after any renames from R-2 I approve)

```
Run the full verification pass: `npx tsc --noEmit`, `npm run build`, and the
test suite. Then grep the whole src/ and tests/ trees for any remaining
import paths that reference the old src/lib file locations (pre-reorg) to
catch anything the IDE didn't update. Report pass/fail per step — do not
tell me it's done if any step failed.
```

## 4. What NOT to do

- Do not create top-level `frontend/` or `backend/` directories — Next.js App Router doesn't support pulling route files out of `src/app`.
- Do not rename `src/components/ui/*` into per-domain folders — they're shared primitives, not a "functionality."
- Do not run this while the git lock is unresolved or the academy-admin pile is undecided.
- Do not run `prisma db push`/`migrate` as part of this — none of the above touches the schema, and that constraint still stands.
