# AthlasX — QA Findings: Root-Cause Notes & Fix Prompts

_Written against the QA pass reported 2026-09-06 across Player/Coach/Academy/Association onboarding. Confidence tags: [Certain] = verifiable directly, [Likely] = strong inference from the evidence given, [Guessing] = a hypothesis Claude Code needs to confirm before acting on it._

## 0. The DB outage (#9) — encoding hypothesis disproven, real cause confirmed via Supabase's own logs

[Certain] The percent-encoding hypothesis from the first pass of this document was wrong — Claude Code checked and both `.env.local` passwords were already correctly encoded. Querying Supabase's own Supavisor pooler logs directly (`mcp__Supabase__query_logs` against project `haexxhxjcwjpnnyoxcnq`) confirms this is a real, repeated, ongoing rejection at the pooler itself, not a client-side string bug:

```
ClientHandler: Exchange error: password authentication failed for user "postgres"
```

Recurring every time a connection was attempted (most recently 2026-09-06T17:58:13Z), consistent with every prior session's failure. In the same log window, *other* internal Supabase-managed connections (`supabase_storage_admin`, `pgbouncer`) authenticate successfully against the same pooler — so the pooler, the project, and the network path are all fine. The rejection is specific to whatever credential the app is sending for `postgres`.

[Likely] The specific username in that error line is plain `postgres`, with no project-ref suffix. Supabase's Supavisor pooler (the `aws-0-<region>.pooler.supabase.com` host this project's `DATABASE_URL` uses) is multi-tenant infrastructure — it identifies which project a connection belongs to from the *username*, which needs to be `postgres.<project-ref>` (here, `postgres.haexxhxjcwjpnnyoxcnq`) when connecting through the pooler host. Plain `postgres` is only correct for the *direct* host (`db.<project-ref>.supabase.co:5432`), which is a different connection string entirely. Mixing a pooler host with a direct-style username is a well-known, easy mistake when a connection string gets copied from one Supabase example and adapted from another — and it produces exactly this "password authentication failed" message, even when the password itself is correct.

[Guessing] The other real possibility: the actual database password was changed in the Supabase dashboard at some point after `.env.local` was first written — plausibly during the password rotation this document already recommended after it was exposed in plaintext chat — and `.env.local` was never updated to match.

**Prompt 0 — check the pooler username format, then the password, without touching schema**

```
Do not modify prisma/schema.prisma, run any migration, or run
`prisma db push` in this prompt. Do not guess or invent any password.

1. Read the current DATABASE_URL in .env.local. If its host is
   *.pooler.supabase.com (Supavisor), confirm the username segment is
   exactly postgres.haexxhxjcwjpnnyoxcnq — not plain postgres. Supabase's
   pooler requires the project-ref suffix on the username for multi-tenant
   routing; a direct-host connection string (db.<ref>.supabase.co) uses
   plain postgres instead, and mixing the two formats produces a
   "password authentication failed" error even with a correct password.
   Fix the username if it's missing the suffix, re-encoding the password
   segment exactly as it is today — do not change the password itself in
   this step.

2. Re-run the safe connectivity check:
     npx prisma db execute --url "$DATABASE_URL" --stdin <<< "SELECT 1;"
   Report the exact result.

3. If step 2 still fails with an authentication error after the username
   is confirmed correct, the password itself is most likely stale —
   possibly rotated in the Supabase dashboard since .env.local was last
   written. Do not guess a replacement. Ask the user to fetch the current
   password directly from the Supabase dashboard (Project Settings →
   Database → Connection string, or Reset database password if it's been
   forgotten), update .env.local with it (re-encoding any reserved
   characters), and re-run step 2.

This must be the only database operation this prompt performs — no
`prisma db push`, `prisma migrate`, or `prisma generate` against the live
database.
```

## 1. Player #1/#2 — the consent bypass and the 43 duplicate POSTs are almost certainly the same bug

[Likely] Both symptoms — state flipping to `verified` without the corresponding action, and one click firing 43 identical requests — point at the same root cause: none of the onboarding wizards guard against overlapping interaction, and `AnimatePresence` stage transitions keep the outgoing panel mounted and clickable while the incoming one fades in on top of it. A rapid click during that crossfade can land on a control from the *wrong* stage, and a click with no in-flight guard on an async handler can fire the same request many times before the first response ever comes back. QA's own note supports this: it didn't reproduce under slow, deliberate clicks on Coach or Academy — only under rapid/overlapping ones on Player. That's the signature of a race condition, not a logic bug in the consent code itself. This needs to be confirmed by reproducing it deterministically, not guessed at — manual clicking won't reliably reproduce a race.

**Status: Done.** Applied as ref-based locks plus `transitioning`/`pointerEvents` guards to `page.tsx`, `coach/page.tsx`, and `academy/page.tsx`; `onboarding/association/page.tsx` correctly needed no change (static notice page, not a wizard). Verified with a manual slow-click pass across all four.

**Prompt 1 — build a deterministic repro, then fix the two likely causes together, across all four wizards**

```
First, write a small Playwright script that drives /player/onboarding (player)
through Stage 1 → Stage 2, firing the "Continue"/"Send OTP" clicks with
near-zero delay between them (e.g. Promise.all-style near-simultaneous
dispatch, or a tight setTimeout loop), to reproduce the localStorage
state showing aadhaar.status:"verified" with consents auto-checked
without any real OTP/verify/scroll action. Do this before writing any
fix — confirm you can reproduce it on demand, since QA could not
reproduce it with slow clicks, and a fix can't be verified without a
reliable repro.

Once reproduced, investigate two specific hypotheses, in order, and
report which one (or both) is real before fixing:
1. AnimatePresence exit/enter overlap: check whether the wizard's
   AnimatePresence usage allows the outgoing stage's interactive elements
   to remain clickable during its exit animation, overlapping the
   incoming stage. If so, this is likely fixable with mode="wait" (only
   one child mounted/interactive at a time) or by setting
   pointer-events: none on exiting panels.
2. Missing in-flight guards: check whether any of the OTP send, OTP
   verify, consent-accept, or submit handlers can be invoked again while
   a previous invocation (including its async work) is still in
   progress. If so, add an explicit isSubmitting/isVerifying boolean per
   action, disable the relevant control while true, and make each
   handler a no-op re-entry if already in flight.

Apply whatever fix the investigation confirms to src/app/player/onboarding/page.tsx
(player), and apply the same defensive pattern (AnimatePresence mode, and
in-flight guards on every async button) to
src/app/coach/onboarding/page.tsx, src/app/onboarding/association/page.tsx,
and src/app/academy/onboarding/page.tsx as well — they share the same
AnimatePresence-based architecture and were only spared in this QA pass
because they were tested with slow clicks, not because they're provably
immune.

Do not change what each stage validates or what data it collects — this
is about preventing overlapping/duplicate interaction, not changing
business logic. Verify by re-running the Playwright repro script from
step 1 and confirming it can no longer produce the bypassed state, plus
npx tsc --noEmit, npm run lint, npm test, and a manual slow-click
click-through of all four wizards to confirm nothing else broke.
```

## 2. Player #3 — clean up the client/server disagreement, but only after #1 is actually fixed

[Certain] The server is doing its job here — this is real defense in depth working as intended, not a bug to "fix" by trusting the client more. Once Prompt 1 closes the race condition, this specific confusing dead-end (UI says verified, server says no) should mostly stop happening for the reason QA hit it. But the same client/server disagreement can still occur for an unrelated reason — the OTP genuinely expiring between verification and final submit, which is exactly what #6 describes on the Academy flow. Handle both with one prompt.

**Status: Done.** Added to both `page.tsx` (player) and `academy/page.tsx`. Confirmed working by manual test, including one genuine, unforced occurrence of the real bug during testing (the academy OTP TTL actually expired mid-wizard, and the recovery path handled it correctly). Also found and fixed a real pre-existing gap while testing: `academy/page.tsx` Step 1 had no error-rendering JSX at all, so this message — and any future Step-1 error — would have been silently swallowed. That's now fixed too.

**Prompt 2 — turn a rejected-at-submit verification error into a recoverable state, not a dead end (Player + Academy)**

```
On both src/app/player/onboarding/page.tsx (player, Stage 2→3) and
src/app/academy/onboarding/page.tsx (Step 1 OTP → Step 5 submit), handle
the specific case where final submission fails with a message indicating
Aadhaar/OTP verification could not be confirmed server-side (e.g.
"Aadhaar verification is required and must be completed just before
submitting" or "Incorrect or expired OTP"), even though the client's own
state says verified.

On that specific error, do not show a generic failure toast and strand
the user. Instead: reset the relevant verified flag to false, surface a
clear inline message ("We couldn't confirm your verification — please
verify again to finish"), and re-open the OTP entry UI for that step
in place, without discarding any other field the user has already
filled in on later steps. The user should be able to re-verify and retry
the same final submit, not restart the wizard.

Do not change server-side validation — it's correct today and should
stay strict. This is client-side recovery UX only. Verify with tsc,
lint, and a manual test: force this path by submitting with a stale/
already-used dev OTP code and confirming the recovery UI appears and a
subsequent real verify + resubmit succeeds.
```

## 3. Coach #4 — check the backend truth before touching the validation

[Guessing, needs to be confirmed by Claude Code before fixing] It's not obvious yet which side is wrong: the field's "optional" label, or the validation requiring it. `docs/AthlasX_Page_Inventory_and_Design_Rollout_Prompts.md`'s own notes on the Academy onboarding page recorded that email+password was added specifically because "phone-only auth has no sign-in path anywhere else in the codebase — every other role uses NextAuth email/password." If that's equally true for Coach — if `User.email` is required for the account to ever sign back in — then requiring it here is correct and the bug is the mislabeled optional-looking field, not the validation. Don't guess which is true; check the schema and NextAuth's sign-in path first.

**Status: Done — email was confirmed required, not optional.** `User.email` is `String @unique` (non-nullable), sign-in is email/password only via `CredentialsProvider` with no phone-based alternative, and `POST /api/coach/onboard` already 400s without it. The validation was correct all along; the label was the bug. Fixed by removing "optional" and adding the required-field asterisk.

**Prompt 3 — resolve which side is actually wrong, then fix that side only**

```
src/app/coach/onboarding/page.tsx Step 1 labels the email field
"optional" (no asterisk), but canProceed() requires
otpVerified && Boolean(coachName && email && password) — the Continue
button silently stays disabled for a coach who skips it.

Before changing anything, check: is User.email nullable in
prisma/schema.prisma? Does src/lib/auth.ts's CredentialsProvider have
any non-email sign-in path (phone-based or otherwise)? If email is
required for the account to ever authenticate again (matching the same
reasoning already documented for the Academy onboarding page), then the
validation is correct and the fix is: remove "optional" from the label
and add the required-field asterisk, matching the other required fields
on that step.

If email is genuinely not required for authentication (a real
alternative sign-in path exists), then the fix is the reverse: relax
canProceed() to not require email, and make sure
POST /api/coach/onboard doesn't independently reject a missing email
either (check that route too — fixing only the client-side check while
the server still 400s on missing email just moves the dead end to
submit).

State plainly in your summary which was true and which side you changed.
Verify with tsc, lint, npm test, and a manual test of both the
with-email and without-email (if applicable) paths through the whole
wizard.
```

## 4. Academy #6 — same recoverable-verification pattern as Player #3

Covered above in Prompt 2 — both are the same underlying UX gap (a verification result the client trusts too long, with no recovery path), fixed together rather than as two separate one-off patches.

## 5. Already handled, no prompt needed

- **#5 (Coach, unhandled promise rejection on `/api/coach/onboard/associations`)** — fixed in the session that produced this QA report (`.catch(() => setAssociations([]))`), `tsc`/`lint` clean. Worth a quick repo-wide grep for other `fetch(...).then(r => r.json())` calls with no `.catch()` once the DB is reachable again and more of the app can be exercised under real failure conditions — not urgent enough for its own prompt right now.
- **#7 (Academy, full pass)** and **#8 (Association, full pass — correctly shows the Ops-only gate is working)** — no action needed; both confirm earlier work landed correctly.

## 6. Status

Prompts 1, 2, and 3 are done and verified (`tsc`/`lint` clean, `npm test` shows only pre-existing unrelated failures, `ACADEMY_SELF_SERVE_ENABLED` confirmed still `false`). **Prompt 0 is the only open item** — it was re-diagnosed after the original encoding hypothesis was checked and ruled out (see §0 above for the real cause, confirmed directly from Supabase's own pooler logs). Nothing else in this document is blocked on it except actually exercising a real end-to-end submission (every fix so far has only been verified against validation and the 400-rejection path, not a real successful write).
