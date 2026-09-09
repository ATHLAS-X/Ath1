# AthlasX — Claude Code prompts for the Known Gaps findings

Companion to `docs/AthlasX_System_Design_and_Functionality_Reference.md` (already in your repo). Every prompt below assumes local Claude Code can open that file directly for context — they reference it by path rather than re-explaining the finding inline.

Run these independently, in any order, except where noted. None of them depend on each other. Review the diff before approving any commit.

---

## Group A — mechanical fixes (low risk, no product decision required)

### A1 — close the test-cleanup gap on the ported academy tables

```
Read the "Known Gaps" section of docs/AthlasX_System_Design_and_Functionality_Reference.md,
the paragraph on test fixture cleanup not covering the ported academy tables.

Open tests/helpers/test-db.ts and find resetDb()'s TRUNCATE list. Add the four missing
tables: academy_batches, academy_batch_memberships, academy_join_requests,
academy_attendance_flags — matching the exact TRUNCATE ... RESTART IDENTITY CASCADE
style already used for the other tables in that list, and respecting FK order if the
existing list is FK-ordered.

Run npm run test:ci afterward (all of tests/integration/academy/*.test.ts should still
pass — if anything now fails, it means a test was silently relying on cross-test leftover
data, which is itself worth telling me about before you "fix" it by loosening an assertion).
Commit as a standalone change: "test: truncate ported academy tables between test runs"
```

### A2 — resolve or remove the dead Razorpay reference

```
Read the "Known Gaps" section of docs/AthlasX_System_Design_and_Functionality_Reference.md,
the paragraph on the stale next.config.mjs comment referencing
app/api/admin/launch-checklist/route.ts and Razorpay.

Confirm: grep the whole repo for "razorpay" (case-insensitive) and for "launch-checklist".
Confirm there's no Razorpay dependency in package.json.

If genuinely nothing references it anywhere else, this is dead documentation from an
earlier iteration — update the CSP comment in next.config.mjs to accurately describe
what's actually true today (no external fetches from client-side code; state plainly
if there are zero server-side external calls anywhere, or name the real one if grep
turns up something I described inaccurately).

Do not remove any actual CSP directive — connect-src, img-src etc. should stay as they
are; this is a documentation-accuracy fix, not a security-policy change. Run npm run
build to confirm the config still parses. Commit: "docs: fix stale CSP comment referencing
a route that doesn't exist"
```

### A3 — remove the confirmed-dead CoachProfile.squad_ids field

```
Read the "Known Gaps" section on CoachProfile.squad_ids in
docs/AthlasX_System_Design_and_Functionality_Reference.md.

Re-verify independently before touching anything: grep -rn "squad_ids" src/ prisma/ tests/
— confirm it really is unread/unwritten anywhere. If that comes back clean, remove the
field from the CoachProfile model in prisma/schema.prisma, generate a migration for the
column drop, and run npx prisma generate + npx tsc --noEmit + npm run test:ci to confirm
nothing broke. If grep finds a real usage I missed, stop and tell me instead of proceeding.

This changes the database schema — flag in your summary that the migration needs to run
against the real database (not just the test schema) before this is safe to deploy, and
that this is a genuine breaking schema change if any external tooling reads that column.
Commit: "chore: drop unused CoachProfile.squad_ids column"
```

### A4 — reconcile the AthlasX Score bowling-economy formula (DEFECT 2)

```
Read src/lib/athlasx-score.ts's header comment, the DEFECT 2 entry in
tests/known-defects/engine-and-matching.test.ts, and the "Known Gaps" section of
docs/AthlasX_System_Design_and_Functionality_Reference.md.

This is a three-way disagreement: the code comment claims "6.5 economy -> 10 points,
10.5 economy -> 0", the implemented formula ((10 - economy) / 4) * 10 actually produces
8.75 at economy 6.5, and a separate internal spec document (if you can find it under
docs/) may state a third value.

Do NOT just change the code to match the comment, and do NOT just change the comment to
match the code — this changes every player's displayed bowling score either way, which is
a product-visible behavior change, not a typo fix. Instead: find and quote all three
sources (code, comment, any spec doc), compute what the DEFECT 2 test currently expects
vs. what the code currently produces, and give me a short written comparison of the
options (keep current formula + fix comment + fix test's expected value, vs. change the
formula to genuinely hit 10.0 at economy 6.5 and 0.0 at economy 10.5 + update the test).
Do not write any code yet — I'll tell you which way to go once I've seen the comparison.
```

---

## Group B — security/correctness fixes that need a regression test alongside the fix

### B1 — scope the /api/dashboard cross-association leak

```
Read the /api/dashboard entry in the API Route Reference section of
docs/AthlasX_System_Design_and_Functionality_Reference.md, and the corresponding
"Known Gaps" paragraph — the route's own code comment already documents that
registrations, pendingIngest, formDropAlerts, trialCycles, totalIngestJobs, the most
recent SelectionSession, and claimedCount are computed globally across every association
instead of being scoped to the caller.

Fix src/app/api/dashboard/route.ts so every one of those counts is scoped the same way
the players list already is — filtered to the association(s) resolveAssociationScope(user)
returns, or unrestricted only for athlasx_ops (null scope). Follow the same pattern
tests/integration/visibility-tier.test.ts uses to prove cross-association isolation
(two associations A and B, a staff user scoped only to A, assert A cannot see B's numbers
and can see A's own).

Then add new test cases to tests/integration/visibility-tier.test.ts (don't create a new
file — this belongs with the other cross-association isolation tests) proving each of the
now-scoped dashboard fields is actually isolated per-association, using the existing
two-association fixture pattern in that file.

Run npm run test:ci. Commit: "fix: scope /api/dashboard's aggregate counts to the caller's
association instead of returning them globally"
```

### B2 — verify blind-grading and consent-withdrawal enforcement haven't regressed

```
This is a verification pass, not a fix — run it before or after any of the other prompts
in this file as a sanity check.

Run npm run test:security and npm run test:ci -- tests/known-defects specifically, and
paste me the full output. Then read tests/security/auth-and-consent.test.ts's header
comment (it claims these tests were originally written to fail against unpatched code)
against docs/AthlasX_System_Design_and_Functionality_Reference.md's "Known Gaps" note
that this header appears to be stale documentation, not a live warning.

Confirm: do all 12 cases across S1-S4 currently pass? If yes, update the stale header
comment in that test file to stop claiming these are "expected to fail" — replace it with
language stating these are regression tests for previously-fixed findings, so a future
reader doesn't mistake genuinely-passing security tests for an unaddressed audit finding.
If any case is currently failing, stop and tell me which one before changing any comment.
```

---

## Group C — building out incomplete features

### C1 — build the missing academy_admin frontend

```
Read the "Known Gaps" paragraph on academy_admin being a second-class role in
docs/AthlasX_System_Design_and_Functionality_Reference.md, plus the full "Academy
Operations" API route group and the "Academy Subsystem" src/lib section in that same
document — the backend for this role is complete; only the frontend is missing.

1. Add 'academy_admin' to the UserRole union in src/types/index.ts.
2. Add an academy_admin-specific section to NAV_SECTIONS in src/lib/chrome.ts (follow
   the existing shape — label, roles allowlist, items with label/href/badge).
3. Build src/app/(dashboard)/academy/page.tsx (batch list + create, following the same
   client-component-fetches-its-own-API pattern used in (dashboard)/trial-cycles/page.tsx)
   backed by GET/POST /api/academy/batches.
4. Build src/app/(dashboard)/academy/join-requests/page.tsx (list + approve/reject,
   following the same pattern as (dashboard)/academy-matching/page.tsx's queue tab)
   backed by GET /api/academy/join-requests and the approve/reject routes.
5. Wire batch roster management (add/remove player) and the attendance-flag surface
   into the batch detail view, backed by the existing
   /api/academy/batches/[batchId]/players and /api/academy/attendance-flags/[playerId]
   routes.

Match the existing dashboard pages' visual style (see (dashboard)/coach/page.tsx or
(dashboard)/tracking/page.tsx as a reference for layout conventions) rather than
introducing a new pattern. Run npx tsc --noEmit, npm run lint, npm run build after each
page. Commit incrementally (one commit per page is fine) rather than one giant commit.
```

### C2 — add a join-request creation entry point

```
Read the "Key End-to-End Procedures" section 8.5 of
docs/AthlasX_System_Design_and_Functionality_Reference.md — it notes that
POST /api/academy/join-requests/[id]/{approve,reject} and GET (list) exist, but there is
no route anywhere that actually creates an AcademyJoinRequest in the first place.

Design and build a public (pre-auth, like claim/search and claim/start) route
POST /api/academy/join-requests that lets a prospective player/guardian submit a join
request against a specific academy: candidate name, DOB, phone, and the target academy_id.
Follow the validation conventions used in claim/start (required-field 400s, phone format)
and player/onboard (age-based minor handling, if relevant to what fields you collect).
Do not auto-create a PlayerProfile here — that happens on approval, per the existing
approveJoinRequest() logic in src/lib/academy/join-requests.ts, which you should reuse
unchanged.

Add integration test coverage in tests/integration/academy/batches-and-join-requests.test.ts
for the new creation route (successful creation, validation failures, and that a created
request shows up in the existing GET /api/academy/join-requests list for the right academy).

Run npm run test:ci. Commit: "feat: add public academy join-request creation endpoint"
```

### C3 — replace the in-memory rate limiter with the already-installed Upstash Redis backend

```
Read src/lib/rate-limit.ts's header comment and the "Known Gaps" paragraph on in-memory
rate limiting in docs/AthlasX_System_Design_and_Functionality_Reference.md.
@upstash/ratelimit and @upstash/redis are already dependencies in package.json but unused.

Replace the in-memory Map-based rateLimit() implementation with @upstash/ratelimit backed
by @upstash/redis, keeping the exact same exported function signature
(rateLimit(name, key, max, windowSeconds)) and return shape ({ success, remaining, resetMs })
so no caller (claim/start's OTP-send limiter, and anywhere else that imports this) needs
to change. Read UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN from env — add them to
.env.local.example with a comment explaining what they're for. Keep
__resetRateLimitsForTests() working for the test suite (Upstash's ratelimit library has
a way to reset/mock for tests — use whatever pattern it recommends, or fall back to the
in-memory implementation specifically inside NODE_ENV === 'test' if that's cleaner, and
tell me which approach you took and why).

Run npm run test:ci. Commit: "feat: back rate limiting with Upstash Redis instead of an
in-process Map, so limits survive across serverless instances"
```

---

## Group D — decisions to make before any code gets written

These three genuinely aren't engineering tasks yet. Use the prompt to get a clear-eyed writeup of the options, not a fix.

### D1 — my-record's consent-withdrawal UX question

```
Read the "Notable edge case" on GET /api/my-record in the API Route Reference section of
docs/AthlasX_System_Design_and_Functionality_Reference.md — the route's own code comment
questions whether a player should be able to see their own performance data after they've
withdrawn consent (currently: no, they can't).

Write me a short options memo (no code): what are the arguments for keeping the current
behavior (consistency with every other consent-gated read path) versus special-casing
"viewing your own withdrawn data" as an exception? What would each option mean for the
withdraw/re-claim flow — could a player who withdrew by mistake even find their way back
to /claim if they can no longer see anything at /record? Don't recommend one — lay out
the tradeoff and stop.
```

### D2 — franchise_scout: build it or remove the scaffolding

```
Read the franchise_scout entries across src/lib/feature-flags.ts, src/lib/player-visibility.ts,
and the VisibilityTier enum in prisma/schema.prisma, plus the "Known Gaps" paragraph on
this in docs/AthlasX_System_Design_and_Functionality_Reference.md.

Write me a short memo (no code): what would actually need to be built for this tier to do
anything (a scout role, a franchise-org qualification/verification mechanism, a UI surface
for a player to opt in) versus the cost of just removing the enum value and the three
enforcement points entirely if there's no near-term plan to build it. Don't recommend one
— I need to decide whether this is roadmap or cleanup.
```

### D3 — trial registration fee: real payment gateway or keep cash-at-venue

```
Read the Registration model and fee_status field in
docs/AthlasX_System_Design_and_Functionality_Reference.md's Data Model section, and the
/trial-cycles/[id]/register page's fee-acknowledgement copy in the Pages reference.

Write me a short memo (no code): if a real payment gateway were added, what would need to
change (FeeStatus transitions, a webhook/callback route, refund handling for a cancelled
registration) versus the cost/complexity of leaving this as cash-at-venue indefinitely.
Don't recommend one — this is a product/ops decision (does AthlasX want to touch money at
all), not something to default into via a code change.
```
