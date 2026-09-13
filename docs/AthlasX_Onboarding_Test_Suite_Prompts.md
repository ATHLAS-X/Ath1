# AthlasX — Onboarding Test Suite Prompts (all five flows)

Same approach as the landing/auth test suites: real automated tests
added to the suite, not one-time manual verification. Cases marked as
findings in the source report (P9, C9, A2/A6, AS5, AS8) get written as
explicit assertions with a comment explaining what decision they surface
— not silently absorbed into a green checkmark.

## TEST-4 — Player onboarding (P1-P21)

```
New Playwright spec, tests/e2e/onboarding-player.spec.ts, covering
/player/onboarding:

Stage 1: P1 all-valid advances to Stage 2. P2 duplicate email is only
caught at final submit — confirm the error surfaces back on Stage 1, not
lost after Stage 3 (this means the test needs to go through all three
stages to actually exercise it). P3 weak/common password rejected at
final submit with the same three validatePasswordStrength messages as
signup — confirm the wizard doesn't strand the user with a generic
failure after they've filled Stage 3. P4/P5 minor vs adult DOB correctly
shows/hides and sends/omits guardian fields. P6 academy lookup on blur,
no-match leaves the batch dropdown empty without crashing. P7 refresh
mid-stage restores from localStorage with the toast. P8 report which
fields are actually required vs optional at submit (don't assume from
the UI alone — check what the API actually rejects when a field is
omitted).

P9 — write this as an explicit finding test, not a pass/fail assumption:
go through /auth's Sign Up → Player picker (which pre-creates a bare
account + session per the current auth-page behavior), then land on
/player/onboarding, and observe what actually happens at final submit —
does it attempt a duplicate account, 409, or silently ignore the existing
session? Report the actual observed behavior in the test's own output,
don't just assert one expected outcome.

Stage 2: P10 dev-mode OTP banner shows the real code. P11/P12 correct
and incorrect code handling. P13 minor flow requires both player's own
and guardian's AadhaarBlock to reach verified. P14 browser back/forward
can't bypass the verified gate — confirm server-side re-check via
consumeVerifiedAadhaar rejects a bypass attempt even if the client UI is
manipulated. P15 stale/consumed requestId at final submit resets to
Stage 2 with a toast, preserves other fields.

Stage 3: P16 bio character limit enforced with live counter. P17 each of
4 consent panels must be scrolled to end before its checkbox enables.
P18 guardian DPDP consent only for minors. P19 successful submit posts
both Aadhaar requestIds. P20 tampered payload with match-stat-shaped
keys is rejected server-side. P21 6th signup attempt for one email
within an hour → 429.

Report pass/fail per case, with P9 and P2/P3's cross-stage error
surfacing called out explicitly in the summary.
```

## TEST-5 — Coach onboarding (C1-C10)

```
New Playwright spec, tests/e2e/onboarding-coach.spec.ts, covering
/coach/onboarding:

C1 send OTP, dev code shown. C2 confirm Verify at Step 1 is client-side
only (compares against devCode in local state) — real check happens
only at final submit; write this as an explicit assertion, not an
assumption, since it's a real trust boundary worth keeping visible in
the test suite. C3 resend invalidates the old code — verify the old code
actually fails at final submit, don't just check a new one was issued.
C4 experience/certification fields from Steps 2-3 are genuinely
discarded (no backing columns) — a tampered payload including them
shouldn't create anything unexpected; confirm by inspecting the actual
created row, not just the response. C5 no association selected blocks
submit (real required column). C6 tamper client state to fake a
"verified" phone without actually completing Step 1 — server must
independently verify OTP at final submit, not trust a client flag. C7
duplicate email rejected with error on the correct step. C8 success
screen's "pending" badge is a real queryable flag, not just UI copy —
confirm by checking the created record's actual status field. C9 — same
finding-style test as P9, using the coach role. C10 6th OTP-verify
attempt for one phone within an hour → 429.

Report pass/fail per case; C2, C6, C8, and C9 get called out explicitly
in the summary as trust-boundary or finding items, not just results.
```

## TEST-6 — Academy onboarding (A1-A6)

```
New Playwright spec, tests/e2e/onboarding-academy.spec.ts, covering
/academy/onboarding. Run these with ACADEMY_SELF_SERVE_ENABLED both off
(current default) and on (temporarily, in your own local .env only,
never committed — revert after):

Flag off: A1 static "not available yet" notice renders correctly. A2
POST directly to /api/academy/onboard while the flag is off still gets
rejected server-side — confirm this independent of any UI-level block.

Flag on: A3 Step 1 phone OTP + email/password, same client-side-only
Verify pattern as coach. A4 confirm only the 5 documented
identity/affiliation fields actually persist — the two originally-
removed steps (Facilities/Staff, Programs) must not appear anywhere in
the actual submitted payload, not just be hidden in the UI (check the
network request body, not just the rendered form). A5 Step 3 "Go Live"
fires no real API calls — confirm via network request interception that
nothing hits the server from this step. A6 /auth's Academy option routes
straight to /academy/onboarding regardless of flag state — confirm the
destination page is the only real gate.

Report pass/fail per case, separately for flag-off and flag-on runs.
```

## TEST-7 — Scout onboarding (S1-S7)

```
New Playwright spec, tests/e2e/onboarding-scout.spec.ts, covering
/scout/onboarding:

S1 Step 1 phone OTP + email/password, client-side-only Verify (same
pattern as coach/academy). S2 Step 2 org info, submit creates
ScoutProfile with verification_status explicitly 'pending' — confirm by
checking the actual created row's value, not just that submit succeeded.
S3 immediately after signup, visiting /scout redirects to /scout/pending,
not the real dashboard. S4 after ops approval via /ops/scouts/pending,
/scout becomes reachable WITHOUT requiring re-login — confirm this
explicitly, since it depends on isScoutVerified re-querying the DB per
request rather than trusting a session claim. S5 — this is the one to
treat most carefully: independently verify (don't just assert the
disclosure copy is present) that a scout account genuinely cannot see
any player under 18. Write a test that creates one adult and one minor
player profile, logs in as an approved scout, and confirms only the
adult profile is visible/queryable through every endpoint a scout
account can reach — not just the one screen the disclosure copy appears
on. This is a safety-relevant check, treat it with the same weight as a
security test, not a UI copy test. S6 toggle the flag off, POST directly
to /api/scout/onboard, confirm server-side rejection independent of the
UI. S7 6th OTP-verify attempt for one phone within an hour → 429.

Report pass/fail per case. S5 gets its own clearly-flagged section in
the report — this is the test that actually answers whether Scout's
minor-visibility design holds up, not just whether the flow works.
```

## TEST-8 — Association self-serve onboarding (AS1-AS8)

```
New Playwright spec, tests/e2e/onboarding-association.spec.ts, covering
/onboarding/association:

AS1 Step 1 is email+password only (no phone/OTP, confirmed by design).
AS2 State-type association has no parent-association requirement. AS3
District-type association's parent-association picker is optional and
works unset. AS4 consent checkbox stays disabled until scrolled to end.
AS5 — treat this as the most important case in this suite: submit and
confirm the created row's verification_status is explicitly 'pending',
NOT the column's own default. Then, separately, insert a row through
Prisma directly bypassing this route entirely and confirm what the
column defaults to — if it's still 'approved' at the database level,
that's a live landmine independent of whether this one route remembers
to override it; report this explicitly even though it's not something
this route prompt can fix (see the separate DB-default hardening
prompt). AS6 post-submit, signed in but landing on /association/pending,
not the real dashboard. AS7 ops approval via /ops/associations/pending
unlocks access, re-checked live via resolveVerifiedAssociationScope
without requiring re-login. AS8 /auth's Association option routes
straight to /onboarding/association and never fires a bare-account
signup or establishes a session before the wizard completes — confirm
this explicitly as a regression check against A16 from the earlier auth
test suite.

Report pass/fail per case, with AS5's database-level default finding
given its own explicit line in the report, not folded into the pass/fail
count.
```
