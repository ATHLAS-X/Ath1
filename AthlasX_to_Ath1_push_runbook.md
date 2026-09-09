# AthlasX → Ath1 — consolidate to one main branch, push to new repo

Supersedes Prompts 2 onward from the earlier `AthlasX_branch_consolidation_runbook.md`.
Prompts 0 and 1 from that file are already done — skip them.

Decisions locked in for this run:
- Port Sparsh's academy batch/attendance/join-request work onto main before pushing.
- Push full commit history to Ath1 (no squashing).
- `Athlasx.git` (`origin`) is left untouched — nothing gets deleted or force-pushed there.
  All new commits below go onto local `main` and get pushed only to the new `ath1` remote.

Run in order. Review every diff before approving a commit.

---

## Prompt 2 — inspect Ath1 and wire it up as a second remote

```
Check the destination repo before touching it: run
  git ls-remote https://github.com/ATHLAS-X/Ath1.git
and report what comes back — empty (brand new repo), or does it already have refs
(a README-only initial commit, an existing main, other branches)?

If it's empty or only has a trivial auto-generated initial commit (e.g. just a README
from repo creation), proceed:
  git remote add ath1 https://github.com/ATHLAS-X/Ath1.git
  git remote -v   (confirm origin still points to Athlasx.git and ath1 points to Ath1.git)

If ls-remote shows anything beyond a trivial init commit — real code, other branches,
commits from someone else — STOP and show me exactly what's there before adding the
remote or pushing anything. Do not force-push over content you haven't shown me first.
```

---

## Prompt 3 — Sparsh's academy work: read-only port plan

```
Compare origin/v1-features-sparsh against origin/main. List every file that exists only
on v1-features-sparsh (not on main, not on any other branch). For each, classify it:
  (a) academy batch/attendance/join-request feature code (app/, lib/, api routes)
  (b) SQL migrations (lib/migrations/005-007)
  (c) throwaway test harness scripts (scripts/academy-*-api-test.mjs)
  (d) other

Produce a written port plan (no code yet) for moving (a) and (b) onto main's current shape:
  - main's app code lives under src/app, src/lib, src/components — NOT app/, lib/,
    components/ at repo root, which is the old shape v1-features-sparsh was built on
  - main's data layer is prisma/schema.prisma (31 models currently); determine whether
    a Batch/AcademyBatch model needs adding, and whether Registration/PlayerProfile need
    new relations for multi-batch membership
  - main has zero Supabase usage anywhere; flag any Supabase reference in the Sparsh branch
  - list which of main's existing academy files (src/lib/academy-capture.ts,
    src/lib/academy-production.ts, src/app/(dashboard)/academy-matching/) would need to
    coexist with or absorb the ported logic, and flag any naming collisions

Output a numbered file-by-file source -> destination mapping plus an estimate of new
Prisma models/migrations needed. Show me the plan before writing any code.
```

---

## Prompt 4 — execute the port

```
Using the approved port plan, implement the academy batch/attendance/join-request
subsystem on main's current src/ + Prisma structure:
  1. Add new Prisma models/enums to prisma/schema.prisma, matching the file's existing
     naming conventions (snake_case columns, PascalCase models), and generate the migration.
  2. Port the API routes into src/app/api/academy/..., following the auth/role-gating
     pattern already used in src/app/api/coach/squad/route.ts.
  3. Port lib/ helpers into src/lib/, converting root-relative imports to the @/* alias.
  4. Port UI pages into src/app/(dashboard)/academy/..., matching the structure of the
     other dashboard pages.
  5. Port the test harness scripts into tests/integration/ as real vitest tests using
     tests/helpers/test-db.ts and tests/helpers/auth.ts, not standalone .mjs scripts.

Do not touch Old_SportX_Files_Initial/ — that's handled separately in Prompt 5.
Run npx tsc --noEmit, npm run lint, and npm run test:ci after porting. Show me the results.
Commit only once all three pass, with a commit message describing what was ported from
v1-features-sparsh and why.
```

---

## Prompt 5 — delete the archived pre-pivot codebase

```
Confirm first: run grep -rl "Old_SportX" src/ prisma/ package.json tsconfig.json
.github/ docs/ — it should return nothing except tsconfig.json's own exclude entry.

If confirmed:
  1. Delete Old_SportX_Files_Initial/ entirely.
  2. Remove "Old_SportX_Files_Initial" from tsconfig.json's "exclude" array (dead
     entry once the folder is gone).
  3. Run npx tsc --noEmit and npm run build to confirm nothing broke.
  4. Commit: "chore: remove archived pre-pivot SportX codebase"
```

---

## Prompt 6 — final pre-push verification

```
Run the full CI-equivalent locally before this goes anywhere:
  npx tsc --noEmit
  npm run lint
  npm run build
  npm run test:ci

Show me all four results. If anything fails, stop and fix it before Prompt 7 — this
is the last checkpoint before the new repo's history is written.

Also confirm: git log --oneline -10 (sanity-check the port and cleanup commits landed
as expected on top of main), and git status is clean.
```

---

## Prompt 7 — push full history to Ath1 as its main branch

```
Push local main, with full history, to the new remote as its main branch:
  git push ath1 main:main

If Ath1 was completely empty, this should be a clean fast-forward push (or the initial
push to an empty ref) with no force needed. If Prompt 2 found a trivial auto-generated
README-only commit there, this push will be rejected as non-fast-forward because the
histories are unrelated — in that case use:
  git push ath1 main:main --force
but only after you've shown me that Ath1 genuinely contains nothing but that trivial
init commit. Never use --force if Ath1 has anything else in it.

After pushing, confirm on GitHub (or via git ls-remote https://github.com/ATHLAS-X/Ath1.git)
that main is there and its tip commit sha matches your local main's tip sha.
```

---

## Prompt 8 — set Ath1 up as a single-branch repo

```
Confirm Ath1's default branch is main:
  git remote show ath1 | grep "HEAD branch"

If Ath1 has any other branches (e.g. a leftover from repo creation), list them and ask
me before deleting any. Otherwise, note as a manual step for me: enable branch protection
on Ath1's main (Settings > Branches on GitHub) requiring the CI workflow to pass before
merge, and set the CI-required secrets (DATABASE_URL etc. for test:ci) in Ath1's repo
settings — the existing .github/workflows/ci.yml has now moved to Ath1 along with
everything else, but Athlasx.git's configured secrets don't automatically carry over
to a different repository.
```

---

## Prompt 9 — optional, do this on Ath1 once the push is confirmed good

```
Three inconsistencies worth reconciling now that Ath1 is the canonical repo:

1. .env.local.example references NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
   but grep -rn "supabase" src/ returns zero matches — the app uses Prisma + Neon only.
   Remove the dead Supabase keys, or tell me if they're used somewhere I haven't checked.

2. infra/docker-compose.yml builds against a root Dockerfile and Dockerfile.worker that
   no longer exist (they were only inside Old_SportX_Files_Initial/, now deleted). Either
   write new Dockerfiles for the current src/ app, or delete infra/ if Vercel-only
   deployment (vercel.json already exists) is the plan. Tell me which.

3. Backend/AI/ (61 Python/FastAPI files: OCR, video analysis, psych scoring via Gemini)
   has zero references from src/. Confirm whether it's planned-but-unwired or dead, and
   either wire it in or split it into its own repository.

4. Add .gitattributes with `* text=auto eol=lf` to stop Windows/Linux checkouts from
   showing the whole tree as modified.

5. Optional, non-destructive: add .mailmap to unify Harshit's two commit identities
   (harshitjain382005@gmail.com and the typo'd harshitjain382005@mail.com) into one
   author on GitHub's contributor graph, without rewriting any commit.
```

---

## What NOT to do

- Don't add `ath1` as a remote or push anything until Prompt 2 confirms what's already there.
- Don't force-push to `ath1` unless Prompt 2 showed you exactly what you'd be overwriting.
- Don't push these new commits back to `origin` (Athlasx.git) — they're only meant for `ath1`.
  If you want them on Athlasx.git's main too, that's a separate explicit decision, not a
  side effect of this push.
