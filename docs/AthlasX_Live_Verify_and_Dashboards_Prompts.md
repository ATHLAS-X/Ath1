# AthlasX — Push, Run Live, Full-Site Audit, Role Dashboards

## 0. Two corrections before the prompts

**"Run everything frontend and backend live on localhost"** — [Certain] Next.js App Router doesn't have separate frontend/backend dev servers. `npm run dev` boots one process that serves both the pages and the `/api` routes on the same port. There's nothing to run twice here — Prompt L-1 is just "start the app."

**Building out a real Academy dashboard right now extends the exact feature that's still paused.** [Certain] `src/app/(dashboard)/academy/` only exists as the uncommitted `academy_admin` pile from a few turns ago — built while `ACADEMY_SELF_SERVE_ENABLED=false`, never cleared through the AC-1 decision, and its `academy_batches` table isn't even in the live DB yet. I'm not refusing to build it, but I'm not shipping it unflagged either: Prompt L-6 below builds it behind the existing flag, same pattern as everything else Academy-related this session. If you want it live and visible now, that's a separate, explicit call to flip `ACADEMY_SELF_SERVE_ENABLED` — say so and I'll fold that in.

Association has no dashboard page at all today (only the Ops-side `ops/associations` creation tool) — that's a genuine new build, not a restyle, and it doesn't conflict with the earlier A-1 decision: A-1 was about who *creates* an Association record, not about whether an Association user gets to log in and see anything. Player (`/record`) and Coach (`/coach`) already exist — those are restyle/verify passes.

## Prompts, in order

### Prompt L-0 — Push the missing academy-subsystem tables (introspect first, then push)

```
Before pushing anything: run a raw query against information_schema (or
`prisma db pull` into a scratch schema file, don't overwrite the real one)
to list every table that actually exists in the live DB under the athlasx
schema. Compare that against every model in prisma/schema.prisma. Confirm
DATABASE_URL points at project haexxhxjcwjpnnyoxcnq before doing anything
else.

If the ONLY gap is the expected academy-subsystem tables (AcademyBatch,
AcademyBatchMembership, AcademyJoinRequest, AcademyAttendanceFlag, and
anything else from that same Sparsh-ported group) — proceed with
`npx prisma db push` to create exactly those tables. This project has
never used `prisma migrate` (db-push only, confirmed), so db push is the
right tool here, not migrate.

If you find ANY other drift beyond that expected set — any other model
missing, or any existing table with a different shape than schema.prisma
declares — STOP and report it instead of pushing. That would mean the
live DB has diverged in ways nobody's accounted for, and that needs a
conversation, not an automatic push.

After a successful push, re-run the information_schema check to confirm
all expected tables now exist, and report table names + row counts (0 is
fine, this just confirms they're real tables).
```

### Prompt L-1 — Run it locally

```
Start the app with `npm run dev`. Confirm it boots without errors (both
page rendering and API routes come from this one process — there is no
separate backend server to start). Report the port and confirm the DB
connection works from the running app (hit any page that queries the DB,
e.g. /auth, and confirm no P1000 or connection errors in the server log).
If it fails to boot, report the exact error rather than retrying blindly.
```

### Prompt L-2 — Full-site crawl for data and design consistency

```
With the dev server running, use Playwright (install it if it's not
already a dependency) to visit every page below, logged in as the
appropriate role where auth is required, and for each one report: (a) any
console errors, (b) any field showing obviously wrong/stale/placeholder
data instead of real DB-backed values, (c) any element still using the
old green color scheme instead of the ax.* orange/black tokens, (d) any
element not using the shared Button/Card/Input/Label/StepRail components
where a plain <button>/<div> was used instead, (e) any broken link or
404. Do NOT fix anything in this pass — just produce a findings report,
one row per issue, page + description + severity.

Pages to visit:
Public: /, /auth
Player: /player/onboarding, /record, /profile, /claim
Academy: /academy/onboarding (if ACADEMY_SELF_SERVE_ENABLED is on),
  /academy (only if reachable)
Coach: /coach/onboarding, /coach
Association: /onboarding/association (should show the "not self-serve"
  notice, confirm it does, don't treat that as a bug), /ops/associations
Ops/shared: /dashboard, /trial-cycles (and its subroutes), /ingest,
  /identity-exceptions, /academy-matching, /selection, /grading,
  /convergence, /tracking, /notifications, /settings, /coach-signups

Report back as a single markdown table. Don't skip a page because it
looks fine at a glance — check the actual rendered DOM/classes, not just
whether it loads.
```

### Prompt L-3 — Player dashboard (`/record`) to spec

```
Restyle /record and /profile onto the ax.* design tokens and shared
components (Button/Card/Input/Label/StepRail), matching the same
orange/black/Anton-Barlow system already applied to player onboarding.
Remove any remaining green-scheme classes. Don't change the data these
pages fetch or display — this is a styling pass only, using the findings
from Prompt L-2 for /record and /profile specifically.
```

### Prompt L-4 — Coach dashboard (`/coach`) verification

```
Check whether /coach already matches the ax.* design system (it may have
been restyled already in commit 871b5b9 — confirm, don't assume). If any
part of it still uses the old glass-card/zinc dark theme or green
accents, bring it in line with the shared components, same as the
onboarding wizards. Use the Prompt L-2 findings for /coach as your
checklist.
```

### Prompt L-5 — Association dashboard (new build)

```
Build a new Association-facing dashboard page. This is a genuine new page
— there's nothing to restyle here since it doesn't exist yet. Scope it to
what the pivot document's role table actually gives an Association: view
of their region's trial cycles and status, selection/convergence results
for their players, season tracking for their squads. Read-only — an
Association does not create records here (that's the Ops-only tool at
/ops/associations) and does not get selection authority. Use the shared
ax.* tokens and Button/Card/StepRail components from the start — don't
build it in the old style and restyle later. Gate access to
`athlasx_association` sessions only, same auth pattern as the existing
role-gated dashboard pages.

Before writing any code, tell me which existing API routes already expose
this data (trial-cycles, tracking, convergence APIs likely already have
association-scoped queries from the W1-W5 backend work) versus what needs
a new endpoint — I'd rather know the real gap before you build against
assumed data.
```

### Prompt L-6 — Academy dashboard (build, but keep it flag-gated)

```
Continue building out the Academy admin dashboard at
src/app/(dashboard)/academy/ using the ax.* design tokens and shared
components from the start. But: do not remove or bypass the
ACADEMY_SELF_SERVE_ENABLED flag check anywhere in this feature, do not add
an Academy link to nav or auth for accounts where the flag is off, and do
not expose it to any account that wasn't created through the existing
academy-onboarding path. This keeps the same posture as everything else
Academy-related this session — the code can exist and be reviewed, but it
stays invisible until there's an explicit decision to turn the flag on.
If you hit a point where finishing this requires exposing something the
flag currently hides, stop and tell me rather than routing around it.
```

### Prompt L-7 — Verification

```
Run `npx tsc --noEmit`, `npm run build`, and the test suite. Re-run the
Prompt L-2 crawl on whichever pages changed (L-3/L-4/L-5/L-6) and confirm
the issues found there are actually resolved, not just that the page
loads. Report pass/fail per step.
```
