# AthlasX — Pivot Plan vs. Built Product: Flow, Button Interactions & Claude Code Prompts

_Cross-references `Pivot_Document_Finalized.pdf` (v1.0, July 2026 — the W1–W9 workflow spec, roles, phasing, and validation backlog) against the actual `main` branch as documented in `docs/AthlasX_System_Design_and_Functionality_Reference.md`. Every page/button/route claim below was verified against the live repo, not inferred from either document alone._

## 0. Three things to settle before writing more code

**The first screen a new player sees is broken.** `src/app/page.tsx` redirects every signed-in user to `/dashboard` with no role branching — `if (session?.user?.id) redirect('/dashboard')`. But `/api/dashboard` gates on `requireRole(req, ['association', 'selection_panel', 'coach', 'athlasx_ops'])` — `player` is not in that list. Every path that creates a player account routes here: `/claim`'s final "done" step links to `/dashboard`; `/player/onboarding`'s successful submit does `router.push('/dashboard')`. A dead function, `rootDestination()` in `src/lib/chrome.ts`, already contains the fix (route by session existence, and by extension could route by role) — it's defined and never called anywhere. This isn't a hypothetical gap, it's a verified 403 on literally every new player's first authenticated page load. Fix this before anything else in this document — it blocks the W6 player-development-loop workflow at step one.

**W2's exception-review step has no page.** The pivot document's W2 diagram shows "Association staff confirms / splits / merges" as an explicit UI step. The backend fully supports it — `GET /api/identity-exceptions` and the three resolution routes exist and are tested. There is no `src/app/(dashboard)/identity-exceptions/page.tsx` or any other page that calls them. An association today has no way to actually resolve an ambiguous identity match short of a raw API call. This is the single largest gap between what the pivot document specifies and what's clickable today.

**The built academy-operations tooling contradicts this document's explicit Phase 1 scope.** Section 4.4 (Non-goals) states plainly: *"We do not sell to individual academies in phase 1. No scout-side buyer exists at that tier to subsidise it, and the sales motion is thousands-wide."* The pivot's own role table (Player/Guardian, Selection Panel, Coach, Association, AthlasX Ops, Scorer) has no academy-admin role at all. Yet the codebase has a fully-built `academy_admin` role with its own auth gate, and a complete batch-scheduling / attendance-flag / join-request-approval subsystem (`src/lib/academy/*`, `src/app/api/academy/**`) ported in from a separate branch. This is real, tested, working code that the current strategic plan says shouldn't exist yet. Either the plan changed after that work was done, or the work should be shelved. That's a product call, not something a prompt should quietly paper over — see Group D below.

---

## 1. Role-by-role click flow

This is the literal button → page → button chain for each role, as built today, annotated with which pivot workflow (W1–W9) each step maps to. `[GAP]` marks a step the pivot document calls for that has no page yet.

### 1.1 Association staff — W1 ingest, W3 trial-cycle setup, W2 exception review [GAP], W8 silent

1. Sign in → lands on **`/dashboard`** ("Association Overview"). One fetch (`GET /api/dashboard`) populates four KPI tiles (animated count-up via `AnimatedCounter`), a registration-trend area chart, a score-distribution bar chart, an active-flags list, and a recent-activity feed. No buttons mutate anything here — it's a read-only jumping-off point. `Link`s route to `/trial-cycles` and `/tracking`.
2. Sidebar → **`/ingest`** ("W1 — Import match data" per the page's own comment). Three source cards:
   - **CricHeroes** card's "Sync now" button → posts a hardcoded documented fixture (`CRICHEROES_SYNC_FIXTURE`) → `POST /api/ingest` (`sourceKey: 'api_sync'`) → a new `pending_review` job appears in the list below.
   - **Excel/CSV** card / the drag-and-drop `UploadZone` → choosing a `.csv` runs it through `mapCsvToIngestPayload()` client-side, then the same `POST /api/ingest` (`sourceKey: 'excel_mapper'`); a `.json` file skips the CSV mapper and posts directly (`sourceKey: 'structured_parser'`).
   - **Scorecard PDFs** card is display-only in this build — its progress bar is a static illustrative value, not wired to a real upload.
3. Clicking **"Review"** on any `pending_review` job in the list slides open the `JobPanel`: tournament name, row/conflict counts, a synthetic confidence breakdown, and two buttons — **Approve** and **Reject**, each `POST /api/ingest/[id]/decide`. Approve triggers the real transactional chain (Tournament/Match/Performance creation → W2 identity resolution per row → W8 academy-name capture) silently, server-side; the job disappears from the pending list on success.
4. `[GAP]` — if approval produced an `AMBIGUOUS` identity outcome, there is currently **no button anywhere in the UI** that surfaces it. The only way to see it is `GET /api/identity-exceptions` directly.
5. Sidebar → **`/academy-matching`**, two tabs: **Reconciliation Queue** (each row: "Confirm" — only shown when the fuzzy matcher has a suggestion, `POST /api/academy-matching/[id]/confirm` — or "Reject", `POST .../reject`; both reload the queue on success) and **Production Ranking** (read-only, `GET /api/academy-matching/production`).
6. Sidebar → **`/trial-cycles`**. **"New Trial Cycle"** button opens a 3-step modal: age category + DOB window + registration window + fee → one-or-more venues (dynamic "+ Add another venue") → a read-only confirmation step with an explicit warning that publishing opens registration to players. Final **"Publish"**-equivalent submit → `POST /api/trial-cycles` → the new cycle is prepended to the list client-side and the modal closes.
7. **`/trial-cycles/[id]/dossiers`** — a two-pane master/detail view (no buttons mutate anything): clicking a registrant row in the left list fetches and renders their dossier on the right via `GET /api/trial-cycles/[id]/registrations/[registrationId]/dossier` (lazily generates it server-side on first request).

### 1.2 Player / guardian — W2 claim, W3 registration, W6 development loop

**Path A — claiming an existing shadow profile** (a player whose match data was already ingested before they had an account):
1. `/claim` — **"Search"** button (disabled until name + district are filled) → `POST /api/claim/search` → candidate list appears.
2. Selecting a candidate → client computes minor/adult from DOB → moves to the details step. If minor, guardian name/phone/relation fields appear and gate the next button.
3. **"Send OTP"**-equivalent submit → `POST /api/claim/start` → a dev-mode notice shows the OTP directly on screen (no real SMS gateway configured) → moves to the OTP step.
4. Entering the 6-digit code enables **"Verify & Claim"** → `POST /api/claim/verify` → on success, a toast fires and the "done" step offers a link to **`/dashboard`**.
5. `[BROKEN]` — that link 403s. `/api/dashboard`'s role gate excludes `player`. Nothing on this screen sends them to `/record`, where their actual data lives.

**Path B — self-registration** (no prior shadow profile):
1. `/player/onboarding` — 4-step wizard (Identity → Playing Profile → Footage & Bio → Review). Each step's "Continue" button is gated by `canProceed()` — step 1 requires name/DOB/district/state/email/password (+ guardian phone if under 18, with an animated conditional field); step 2 requires a playing-role selection; steps 3–4 have no required fields.
2. Final **"Create Profile"** button → `POST /api/player/onboard` (explicitly rejects any self-reported match-stat fields at the API layer) → on success, `router.push('/dashboard')`.
3. `[BROKEN]` — same 403 as Path A. This is the more severe instance since it's an automatic redirect, not a link the player has to click.

**Once actually on `/record`** (today, only reachable by typing the URL or via sidebar nav, not via either signup flow's own success action):
1. Single fetch, `GET /api/my-record` → AthlasX score breakdown, career summary stats, runs/strike-rate trend charts (`recharts`), and a match-by-match log. Entirely read-only.
2. `[GAP vs. pivot W6]` — the pivot document's W6 diagram specifies "Percentile vs cohort (age · district · role)" and "Identified gaps vs next-level benchmark" as explicit steps for the player's own view. `/record`'s current data shape (`{ player, score, summary, trend, matches }`) has no percentile or gap-analysis field — that comparison exists today only inside a trial-cycle **dossier** (`cohortPercentile()` in `src/lib/dossier.ts`), which a player never sees; dossiers are generated for selection-panel consumption, not shown back to the player.
3. `[GAP]` — footage upload exists (`/player/onboarding` and `/trial-cycles/[id]/register` both take footage as data-URI uploads), but there's no page where an already-claimed player can add footage *after* the fact outside those two specific flows.
4. `[GAP — this is the biggest one for this role]` — **W6's visibility-control step has no UI.** The pivot document specifies a "Who can see this profile?" control (default association-only / opt-in cross-association / opt-in adult-only franchise-scout) as a player-facing setting. The data model already supports exactly this (`PlayerProfile.visibility_tier`, the `VisibilityTier` enum, `franchise_scout` gated behind a feature flag). The page it obviously belongs on, **`/settings`**, is currently a stub that literally renders "Settings management is not yet implemented." There is no button anywhere a player can click to change their own visibility tier.
5. `[GAP]` — **`/notifications`**, which the pivot's W6 diagram calls "Trial & camp notifications" feeding a "Registration deep link → W3," is also a stub: a hardcoded 3-item array, not a real feed of the player's own trial-cycle/camp events.

### 1.3 Selection panel / selector — W4 blind grading

1. **`/selection`** ("Candidate Pool") — `GET /api/candidate-pool` populates the full list once; all search/role filtering happens client-side over that array. Each row shows a `GradeProgress` badge (graded-by / total-selectors). Rows are hoverable toward grading but there's no explicit `<Link>` in this page — navigation to `/grading` is implied by styling, not a wired button.
2. **`/grading`** ("Blind Grading") — selecting a player from the list opens a right panel: `QuickViewCard` (read-only batting/bowling bars, computed client-side via the same `calculateAthlasXScore()` the rest of the app uses) plus `GradePanel`.
   - `[GAP vs. pivot W4/W7]` — the pivot's W7 diagram routes "Player cards · form & workload trend" from the coach's weekly tracking into W4 as "advisory input." The current `QuickViewCard` shows only batting/bowling score bars and a provenance label — no coach advisory note, no trend-alert flag, is surfaced to the selector here. That signal exists (`CoachAdvisoryNote`, `TrendAlert`) but isn't wired into this specific panel.
   - `GradePanel`'s number-grid (1–10) + notes field, submit → `POST /api/grading/[sessionId]/grade`. Locked (read-only, "Grading is closed" message) once the chair has unlocked convergence.
3. If `is_chair` and not yet locked: **"Unlock convergence"** button → `POST /api/grading/[sessionId]/unlock` → flips every grade panel on the page to read-only immediately.
4. **`/convergence`** — locked until `convergence_unlocked_at` is set (shows "waiting for chair" otherwise). Once unlocked: `GET /api/grading/[sessionId]/convergence` populates per-player grade spread + consensus label (unanimous/split/contested). Checkbox per row (disabled once already selected) builds a selection set; **"Lock Final Squad"** → `POST /api/grading/[sessionId]/lock-squad` — a one-way action, copy states "Once locked, selections are immutable."

### 1.4 Coach — W7

1. **`/coach`** — `GET /api/coach/squad` populates the roster. Clicking a row expands an inline `EvalForm`: two 1–5 rating button-grids (Fitness, Behaviour) + a 200-char note. **"Save Evaluation"** → `POST /api/coach/[playerId]/evaluate` → the row's badges patch in place immediately, button shows a 2-second "Saved to server" confirmation.
2. **`/tracking`** (also visible to selection_panel per nav config) — flag filter buttons (`all`/`form_drop`/`on_form`/`none`) filter client-side. **"Deep view"** on any row opens `DeepView`: sparkline trend, per-week breakdown, and the coach's own advisory note, explicitly captioned "advisory only."
3. `[Not in current build]` — the pivot's W7 diagram also calls for **"Plan session"** and **"Mark attendance"** as coach actions feeding the weekly cycle. The backend supports this (`POST /squads/[id]/sessions`, `POST /squads/[id]/sessions/[sessionId]/attendance`) but there is no page-level UI for a coach to create a training session or mark attendance — only the API routes exist.

### 1.5 Academy admin — backend only, no pages (see Finding #3 above)

The role exists in auth (`requireRole(req, ["academy_admin"])` across `/api/academy/**`), but there is no `academy_admin` entry in `UserRole` (`src/types/index.ts`), no nav section for it (`chrome.ts`), and no page under `src/app/(dashboard)/academy/**`. An `academy_admin` who somehow signs in today lands on the same broken `/dashboard` redirect described in Finding #1, with nowhere else to go.

---

## 2. W1–W9 cross-reference: pivot spec vs. built implementation

| Workflow | Pivot spec | Built? | Where |
|---|---|---|---|
| **W1** Association onboarding & ingest | Data-sharing agreement → scope seasons/formats → source-format audit → normalize → identity resolution → confidence scoring → association approval | **Built**, minus the data-sharing-agreement/season-scoping steps, which are an offline/ops decision, not app UI | `/ingest`, `POST /api/ingest`, `/api/ingest/[id]/decide`, `src/lib/ingest/*` |
| **W2** Identity resolution & claim | Normalize → match → resolve (auto / exception queue / new shadow) → player claims via OTP → guardian consent for minors | **Resolution logic fully built; the exception-queue review UI is not** | `src/lib/identity-resolution.ts`, `/claim`, `POST /api/claim/*` — exception review has no page (Finding #2) |
| **W3** Trial cycle → pre-camp dossier | Association opens cycle → player registers + uploads → dossier generated (full or thin) → panel pre-reads before camp | **Built** | `/trial-cycles`, `/trial-cycles/[id]/register`, `/trial-cycles/[id]/dossiers`, `src/lib/dossier.ts` |
| **W4** Selection committee | Candidate pool → Quick View → independent blind grading → convergence → resolve → lock squad → (optional) rationale | **Built**, minus the coach-advisory-signal integration into Quick View | `/selection`, `/grading`, `/convergence`, `src/lib/athlasx-score.ts` |
| **W5** In-season weekly tracking | Auto-ingest from scorer output → weekly player card → trend-flag detection → alert coach/selector → season trend line | **Built** | `/tracking`, `PlayerWeek`/`TrendAlert` models |
| **W6** Player development loop | Own record → percentile vs cohort → gap vs next-level benchmark → footage upload → self-assessment → visibility control → trial notifications | **Partially built** — record view and footage upload exist; percentile/gap analysis, visibility control, and real notifications do not (Finding covered in §1.2) |
| **W7** Coach | Squad view → plan session → mark attendance → log notes → post-match review → advisory input to W4 | **Partially built** — evaluation form and player-card trend view exist; session-planning/attendance-marking UI does not | `/coach`, `/tracking` |
| **W8** Academy affiliation capture | Silent byproduct of W1 — fuzzy match academy strings → registry → production ranking → (later phase) inbound academy signup | **Built as specified** — genuinely silent/byproduct, exactly as designed | `src/lib/academy-capture.ts`, `academy-production.ts`, `/academy-matching` |
| **W9** Master flow | The composition of all of the above | **Matches the built product's actual shape closely** — the one real divergence is the built `academy_admin` operational subsystem, which isn't in this master flow at all (Finding #3) |

---

## 3. Claude Code prompts, ordered by the pivot document's own priorities

The pivot document's §9 Validation backlog and §8 Phasing are explicit about sequencing — several of the fixes below are gated by product decisions the document itself says aren't made yet (data-sharing agreements, who pays, association's actual record format). The prompts are grouped so you don't run engineering work ahead of a decision the source document says is still open.

### Group A — fix the broken first-run path (do this first, it blocks W6 entirely)

```
Read src/app/page.tsx and src/lib/chrome.ts's rootDestination() function, and the
"broken first-run redirect" finding in this conversation: every signed-in user is
redirected to /dashboard regardless of role, but GET /api/dashboard's requireRole
excludes 'player' — so a player's first authenticated page load 403s.

Fix src/app/page.tsx to redirect based on role, not just session existence: player ->
/record, coach -> /coach, association/athlasx_ops -> /dashboard, selection_panel ->
/selection. Use or replace rootDestination() in src/lib/chrome.ts as the single place
this mapping lives (it currently only branches on session existence, not role — extend
it, don't duplicate the logic inline in page.tsx).

Also fix the two places that manually route a newly-created player to /dashboard:
- src/app/claim/page.tsx's "done" step's link to /dashboard -> change to /record
- src/app/player/onboarding/page.tsx's post-submit router.push('/dashboard') -> change to /record

Add a test (or extend an existing one in tests/integration/) that signs in as each role
and asserts the root page redirects to the correct destination for that role, so this
can't silently regress. Run npm run test:ci. Commit: "fix: route signed-in users to their
role's home page instead of unconditionally to /dashboard"
```

### Group B — build the missing W2 exception-review page

```
Read the "Player Claiming" and "Data Ingest & Identity Exceptions" sections of
docs/AthlasX_System_Design_and_Functionality_Reference.md's API Route Reference, and
the W2 workflow diagram description in this conversation (association staff must be
able to confirm / split / merge an ambiguous identity match — the backend routes exist,
GET /api/identity-exceptions and POST .../{confirm,merge,split}, but there is no page).

Build src/app/(dashboard)/identity-exceptions/page.tsx: a list of OPEN exceptions
(GET /api/identity-exceptions) showing the raw ingested name/DOB/district and the
candidate_player_ids it might match. For each exception, show the candidate players'
real names/details (you'll need to fetch or join player info — check whether the list
endpoint already includes enough, or whether you need a small addition to that route
to include candidate display names, since right now it likely returns raw IDs) and three
actions: "Confirm" (pick one candidate) -> POST .../confirm, "Split" (this is a new
person) -> POST .../split, "Reject-equivalent"/merge into a different existing player
if visible in the UI -> POST .../merge. Follow the existing page patterns (client
component fetching its own API, similar interaction shape to /academy-matching's queue tab).

Add a NAV_SECTIONS entry in src/lib/chrome.ts under the Association section pointing at
this new page, visible to association/athlasx_ops roles.

Add integration test coverage confirming the page's underlying API calls work end to end
(you likely don't need new API tests since tests/integration/identity-exception-attach.test.ts
already covers the routes — verify that's still true rather than duplicating).

Run npm run test:ci, npx tsc --noEmit, npm run lint. Commit: "feat: add identity exception
review page for association staff"
```

### Group C — build the missing W6 player-facing pieces

```
This is three related but separable pieces of work — do them as three commits, not one.

1. VISIBILITY CONTROL. Replace the stub src/app/(dashboard)/settings/page.tsx with a real
   page: a player can view and change their own PlayerProfile.visibility_tier among
   association_only (default) and cross_association (opt-in) — do NOT expose
   franchise_scout as a selectable option yet, since FRANCHISE_SCOUT_ENABLED is false and
   there's no scout role to receive that visibility anyway (see src/lib/feature-flags.ts
   and src/lib/player-visibility.ts for why). You will need a new API route,
   PATCH /api/player/visibility or similar, that lets a player update only their own
   linked PlayerProfile's visibility_tier (derive the player from the caller's own
   User.linked_player_id, exactly like /api/my-record does — never accept a client-supplied
   player id). Add a test proving a player cannot change another player's visibility tier.

2. TRIAL/CAMP NOTIFICATIONS. Replace the hardcoded array in
   src/app/(dashboard)/notifications/page.tsx with a real feed for the signed-in player:
   upcoming trial cycles they're eligible for (by age category/DOB window) that they
   haven't yet registered for, and status updates on registrations they have made. Reuse
   GET /api/trial-cycles (already public) filtered client- or server-side by the player's
   own DOB against each cycle's dob_window_start/end. Each notification should deep-link
   to /trial-cycles/[id]/register, matching the pivot document's "Registration deep link
   -> W3" requirement.

3. COHORT PERCENTILE ON THE PLAYER'S OWN RECORD. The percentile-vs-cohort calculation
   already exists (src/lib/dossier.ts's cohortPercentile()) but only runs in the context
   of a trial-cycle registration, and a player never sees their own dossier. Do NOT just
   reuse cohortPercentile() as-is (it's scoped to a specific trial cycle's registrant
   pool, not a general "players like me" cohort). Instead: propose (in your reply, before
   writing code) what the comparison cohort should be for a player's own /record view
   outside of any specific trial cycle — same age category + district + playing role
   across the whole association, most likely — and how many peers should be required
   before showing a percentile (mirror the existing MIN_COHORT_FOR_PERCENTILE = 5 floor
   so a thin cohort never shows a misleadingly precise number). I'll confirm the approach
   before you implement it.

Run npm run test:ci after each of the first two. Commit each piece separately.
```

### Group D — the academy_admin scope conflict (decision first, not a prompt to fix)

```
This is not a coding task. Read section 4.4 (Non-goals) of Pivot_Document_Finalized.pdf
side by side with src/lib/academy/*.ts, src/app/api/academy/**, and the academy_admin
role gate across those routes.

Write me a short memo (no code): the pivot document explicitly states individual-academy
sales are out of scope for phase 1, with no academy-admin role in its own role table —
yet a complete, tested, working academy-admin subsystem exists in the codebase (batch
scheduling, attendance-flag overrides, join-request approval), ported in from a separate
branch. Lay out three options plainly: (a) this work gets shelved/hidden behind a flag
until phase 4 or whenever academy sales are actually planned, (b) the pivot document is
stale and academy sales are now in scope sooner than it says, (c) something in between —
e.g. keep it live internally for one pilot academy without building it into the general
onboarding flow. Don't recommend one. This determines whether Group C-adjacent work on
an academy_admin frontend (discussed in an earlier session) should happen at all.
```

**Resolved 2026-09-06:** option (a) — the pivot document's phase-1 exclusion of
individual-academy administration is superseded by design work
(`design/import/AthlasX Add Players.html`, `AthlasX Player
Self-Registration.html`, `AthlasX Academy Admin Dashboard.html`, `AthlasX
Player Profile.html`) commissioned and built against on direct instruction.
The `academy_admin` frontend now exists: `src/app/(dashboard)/academy/**`
(dashboard, players list/detail, add-players CSV/manual/invite, join-request
approval) plus the public guardian self-registration page at
`src/app/join/[academyId]`. `Pivot_Document_Finalized.pdf` section 4.4
(Non-goals) and its role table have not been edited to match (it's a PDF;
this repo has no tooling to edit it) — whoever owns that document should
update it to reflect that academy administration is in scope, not phase-4+.

### Group E — coach advisory signal into the grading Quick View (W4/W7 integration)

```
Read src/app/(dashboard)/grading/page.tsx's QuickViewCard and buildQvPool(), and
src/lib/athlasx-score.ts's header comment on why CoachAdvisoryNote and TrendAlert are
structurally walled off from the score itself (DEFECT 1's fix) — that wall must NOT be
touched. This prompt is about surfacing that data as read-only context alongside the
score, not feeding it into calculateAthlasXScore().

Extend the Quick View panel on /grading to additionally show, for the selected player:
the most recent CoachAdvisoryNote (if any) and whether they currently have an open
TrendAlert (e.g. a small "form drop" badge), fetched via a small addition to
GET /api/grading/session or a new lightweight endpoint — your call which is cleaner,
but do not let this data influence anything used in calculateAthlasXScore() or the grade
submission itself. Label it clearly as advisory/coach input in the UI, distinct from the
verified-match-data score bars, matching how /tracking's DeepView already captions coach
notes as "advisory only."

Run npm run test:ci. Commit: "feat: surface coach advisory notes and trend flags as
read-only context in the grading Quick View"
```

### Group F — validation backlog items that block everything else (from the pivot doc's §9, not engineering work)

These aren't Claude Code prompts — they're the pivot document's own words, repeated here because they gate whether any of the above matters commercially: confirm your target association isn't already on a third-party scoring platform (blocks W1 scoping entirely); get one association's actual historical records and find out what format they're really in (blocks costing the whole ingest pipeline); get one real association conversation on record about whether they'll actually share data (the document states plainly: "no association conversation is yet on record... blocks everything"). No prompt to Claude Code substitutes for these three conversations.
