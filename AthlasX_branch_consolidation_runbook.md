# AthlasX branch consolidation — Claude Code runbook

Run these prompts **in order**, in Claude Code, from `C:\Users\saura\Claude\Projects\AthlasX`.
Do not skip Prompt 1 — branch state may have changed since this was written (2026-09-05).
Review every diff Claude Code shows you before approving a commit, especially in Prompt 3 (the port).

---

## Prompt 0 — clean the stray lock files first (one-time, only if you haven't already)

```
Run: del .git\packed-refs.lock ; del .git\refs\tags\zzz-permtest.lock ; git tag -d zzz-permtest ; git status
Confirm git status is clean (or only shows expected local changes) before continuing.
```

---

## Prompt 1 — re-verify branch state before deleting anything

```
Fetch all remotes and prune deleted refs: git fetch --all --prune --tags

Then, for each of these branches, print: the commit it points to, how many commits
it is ahead/behind origin/main, and the result of `git diff --stat origin/main...<branch>`:
  - origin/feat/merge-w1-w8-onto-src
  - origin/feat/phase-1-working-session
  - origin/feat/w1-w8-and-association-auth
  - origin/v1-features-sparsh

For feat/merge-w1-w8-onto-src and feat/phase-1-working-session specifically, also run
`git merge-base --is-ancestor <branch> origin/main` and report the result.

Do not delete or modify anything yet. Just report findings and flag if anything differs
from: mergew1w8 = 0 commits ahead (pure ancestor), phase1 = tree-identical to commit
48927b03a05669b0a082a4b2275b33a686537fe4, w1w8auth = superseded, sparsh = genuinely
unmerged with ~36 unique files under app/academy, app/api/academy, lib/academy*,
lib/migrations/005-007, scripts/academy-*-api-test.mjs.

If any branch has NEW commits since what I described, stop and tell me before proceeding
to later prompts.
```

---

## Prompt 2 — decide the fate of v1-features-sparsh (read-only, produces a plan only)

```
Compare origin/v1-features-sparsh against origin/main. List every file that exists only
on v1-features-sparsh (not on main and not on any other branch). For each one, classify it:
  (a) academy batch/attendance/join-request feature code (app/, lib/, api routes)
  (b) SQL migrations (lib/migrations/005-007)
  (c) throwaway test harness scripts (scripts/academy-*-api-test.mjs)
  (d) other

Then produce a written port plan (do not write any code yet) for moving category (a) and (b)
onto main's current shape:
  - main's app code lives under src/app, src/lib, src/components (not app/, lib/, components/
    at repo root, which is the OLD shape this branch was built on)
  - main's data layer is prisma/schema.prisma (31 models currently) — check whether a Batch/
    AcademyBatch model needs to be added, and whether Registration/PlayerProfile need new
    relations for multi-batch membership
  - main has no Supabase usage anywhere; this branch may reference it — flag any such reference
  - list which of main's existing academy-related files (src/lib/academy-capture.ts,
    src/lib/academy-production.ts, src/app/(dashboard)/academy-matching/) would need to
    coexist with or absorb the ported batch logic, and call out any naming collisions

Output: a numbered plan with file-by-file source -> destination mapping and an estimate of
new Prisma models/migrations needed. Do not execute it. I will review and tell you whether
to proceed with the port or drop the branch.
```

**After reviewing that plan, tell me (or Claude Code) which way to go:**

- **Port it** → run Prompt 3.
- **Drop it** → skip to Prompt 5 and include `v1-features-sparsh` in the archive-tag-then-delete step instead of leaving it out.

---

## Prompt 3 — execute the port (only if you chose "port it")

```
Using the port plan from the previous step, implement the academy batch/attendance/
join-request subsystem on top of main's current src/ + Prisma structure:
  1. Add any new Prisma models/enums needed (e.g. for batches, attendance flags,
     join requests) to prisma/schema.prisma, consistent with the existing naming
     conventions in that file (snake_case columns, PascalCase models).
  2. Generate a new migration for it.
  3. Port the API routes into src/app/api/academy/... following the existing route.ts
     conventions used elsewhere in src/app/api (see src/app/api/coach/squad/route.ts
     for the auth/role-gating pattern to copy).
  4. Port the relevant lib/ helpers into src/lib/, adapting imports from the old
     app-root-relative paths to the @/* alias.
  5. Port UI pages into src/app/(dashboard)/academy/... consistent with how other
     dashboard pages are structured.
  6. Port the test harness scripts into tests/integration/ as proper vitest tests
     (using tests/helpers/test-db.ts and tests/helpers/auth.ts like the rest of the
     suite does), not as standalone .mjs scripts.

Do NOT touch anything under Old_SportX_Files_Initial/ — that's being deleted separately.
Run `npx tsc --noEmit`, `npm run lint`, and `npm run test:ci` after porting and show me
the results before committing. Commit only after those pass, with a clear commit message
describing what was ported from which branch.
```

---

## Prompt 4 — delete the archived old codebase from main

```
Confirm first: run `grep -rl "Old_SportX" src/ prisma/ package.json tsconfig.json
.github/ docs/` and show me the output — it should be empty except for the exclude
entry in tsconfig.json itself.

If that's confirmed empty, then:
  1. Delete the Old_SportX_Files_Initial/ directory entirely.
  2. Remove "Old_SportX_Files_Initial" from the "exclude" array in tsconfig.json
     (it'll be a dead entry once the folder is gone).
  3. Run npx tsc --noEmit and npm run build to confirm nothing broke.
  4. Commit with message: "chore: remove archived pre-pivot SportX codebase"
```

---

## Prompt 5 — archive-tag and delete the fully-merged branches

```
For each of these branches — feat/merge-w1-w8-onto-src, feat/phase-1-working-session,
feat/w1-w8-and-association-auth — and, if I told you to drop it, v1-features-sparsh:

  1. Create an annotated tag pointing at the branch tip before deleting it, named
     archive/<branch-name-with-slashes-replaced-by-dashes>, e.g.
     git tag -a archive/feat-merge-w1-w8-onto-src <sha> -m "archived before branch cleanup"
  2. Push the tag: git push origin archive/feat-merge-w1-w8-onto-src
  3. Delete the local branch: git branch -D <branch>
  4. Delete the remote branch: git push origin --delete <branch>

Do this one branch at a time and show me confirmation after each remote delete succeeds
before moving to the next. Do not delete v1-features-sparsh unless I explicitly said to
drop it in Prompt 2's follow-up.

After all deletions, run `git branch -a` and confirm only main (plus the new archive/*
tags, which are tags not branches) remains.
```

---

## Prompt 6 — set main as the only branch going forward

```
Confirm GitHub's default branch is main (git remote show origin | grep "HEAD branch").
If GitHub repo settings allow it from the CLI (they usually don't — this may need the
GitHub web UI under Settings > Branches), note that as a manual step for me: enable
branch protection on main requiring the CI workflow (.github/workflows/ci.yml) to pass
before merge, so future work happens on short-lived feature branches that get deleted
immediately after merging instead of accumulating like these did.
```

---

## Prompt 7 — optional cleanup, bundle with the above if you want "cleaner and up to date"

```
Three inconsistencies to reconcile, do them as separate commits:

1. Env files disagree with the actual stack. .env.local.example references
   NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY but grep -rn "supabase" src/
   returns zero matches — the app uses Prisma + Neon (DATABASE_URL) exclusively.
   Remove the dead Supabase keys from .env.local.example, or tell me if they're used
   somewhere I haven't checked.

2. infra/docker-compose.yml builds against Dockerfile and Dockerfile.worker at repo
   root, but those files were moved into Old_SportX_Files_Initial/code/ by the Aug 10
   restructure (now being deleted in Prompt 4) and were never recreated at root.
   Either write new Dockerfiles for the current src/ app, or delete infra/ entirely
   if you're deploying via Vercel only (vercel.json already exists) and don't need
   docker-compose. Tell me which.

3. Backend/AI/ (61 Python/FastAPI files: OCR, video analysis, psych scoring via
   Gemini) has zero references from src/ — nothing in the Next.js app calls it.
   Confirm whether this is planned-but-unwired or genuinely dead, and either wire
   it in or move it to its own repository so it stops distorting audits of this one.

4. Add a .gitattributes file with `* text=auto eol=lf` — right now every file this
   Windows checkout touches shows as modified when diffed from a Linux/Mac checkout,
   pure CRLF noise (confirmed via git diff --ignore-all-space returning empty).

5. Optional, non-destructive: add a .mailmap file to unify Harshit's two commit
   identities (harshitjain382005@gmail.com and the typo'd harshitjain382005@mail.com)
   so `git shortlog` and GitHub's contributor graph show one person instead of two.
   This doesn't rewrite history, just display.
```

---

## What NOT to do

- Don't run any of Prompt 5's deletions before Prompt 1 confirms nothing changed.
- Don't skip the archive tags — a bare `git push origin --delete` with no tag is the
  one step here with no undo once GitHub garbage-collects the dangling commit.
- Don't let Prompt 3 (the port) touch Old_SportX_Files_Initial — that's a separate,
  unrelated deletion in Prompt 4.
