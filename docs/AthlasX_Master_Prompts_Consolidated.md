# AthlasX — Master Prompts (Consolidated)

Five self-contained prompts covering everything currently open. Scout and
Association self-serve BUILD prompts are deliberately not here — Scout
build is blocked on the minor-data-visibility answer (full access /
guardian-consent-gated / no direct scout-to-player contact), and
Association rebuild is blocked on what Master Prompt 4 finds in git
history. Both get real build prompts once those are answered.

Run order: Master Prompt 1 first (unblocks the player dashboard flow).
2, 3, and 4 can run in any order alongside or after it. 5 anytime.

---

## Master Prompt 1 — Migration + player onboarding completion

```
Step 1: Print the full contents of prisma/manual_migrations/player_phase1_high.sql.
Run a schema diff (prisma migrate diff or equivalent) against the live
DB's actual current schema and print that too — I need to see what
changes relative to what's live right now, not just what the file says
in isolation. Do NOT apply anything yet. Stop here and wait for an
explicit "apply it" instruction as a separate follow-up message before
touching the live DB.

Step 2 (only after that explicit go-ahead arrives separately): Apply the
migration via DATABASE_DIRECT_URL — never the pooler URL for a schema
change. Confirm with a live SELECT that the gender column now exists on
both User and PlayerProfile. Re-test /api/player/onboard end-to-end with
a real test account to confirm the 500 is gone.

Step 3: In the player onboarding wizard's Aadhaar verification step, when
verification succeeds, do not route to any fallback/manual-verification
screen. Continue through the remaining onboarding steps as already
designed and land the player on their dashboard (/record) once
onboarding completes. If /api/player/onboard still 500s at this point,
stop and report it — don't work around it by skipping the field,
defaulting it, or swallowing the error.

Report pass/fail per step, and don't proceed past step 1 without the
explicit go-ahead.
```

## Master Prompt 2 — Onboarding UX fixes: sticky rail + OTP investigation

```
Two independent fixes — treat them separately, don't assume a shared
root cause, and neither depends on DB migration status:

A. STICKY LEFT RAIL: across every onboarding wizard that renders the
StepRail/left nav panel (Player, Coach, Academy), the left rail currently
scrolls along with the right-hand form content. Fix: the left rail should
stay fixed/sticky at the top of its own column height; only the
right-hand content should scroll independently. Apply consistently to
every flow using this two-column layout — don't fix one and leave others
inconsistent. Screenshot before/after on at least two flows to confirm
the rail no longer moves with page scroll.

B. ASSOCIATION OTP: "Incorrect or expired OTP" is appearing where it
shouldn't. Investigate before fixing:
   1. Does this happen on the seeded test account (staff@upca.example)
      specifically — does the seed script's OTP path differ from real
      signup?
   2. Does the dev-mode inline-OTP-display show the exact code the
      verification endpoint checks against? A mismatch would explain
      this precisely.
   3. Is there a timing issue — expiry clock starting server-side before
      the client finishes fetching/rendering the code?
   Report actual OTP values/timestamps and root cause before applying a
   fix. Don't widen the expiry window as a first move.

Report both independently.
```

## Master Prompt 3 — Academy self-serve activation

```
Set ACADEMY_SELF_SERVE_ENABLED to true (.env.local for local testing;
confirm with me before touching any shared/production env config). Then:
1. Confirm Academy now appears as a live signup path on /auth and routes
   to /academy/onboarding.
2. Confirm the Academy nav section appears in DashboardSidebar for an
   academy_admin session and all five existing Academy pages
   (overview/players/add-players/join-requests/batches) are reachable.
3. Run tsc + build to confirm nothing relied on the flag being off.
4. Create one real academy_admin test account through the actual signup
   flow (not a DB insert) and walk all five pages, reporting anything
   that breaks now that it's reachable outside direct-URL testing.

Don't apply the HP-4 responsive/accessibility fixes as part of this —
that's separate work. This is: turn it on, confirm it works end to end.
```

## Master Prompt 4 — Scope investigation: Scout + Association self-serve history

```
Two report-only investigations. Do not enable flags, build UI, or modify
schema in this prompt.

A. FRANCHISE SCOUT: grep for FRANCHISE_SCOUT_ENABLED and every
file/route/component/schema field it gates. Report: what already exists,
even unfinished; what data a scout account would see per that existing
code; whether any guardian-consent or minor-visibility restriction
already exists there, or whether it currently has unrestricted access to
player profiles; whether this matches a "franchise scout" concept
(employed by/affiliated with a specific team) or something closer to an
independent scout marketplace, which the pivot doc's non-goals section
explicitly excludes; and the git history/commit intent behind when this
flag and its code were added.

B. ASSOCIATION SELF-SERVE HISTORY: find the commit where decision A-1
converted /onboarding/association from a self-serve wizard into a static
notice page. Show what that wizard originally collected (fields, steps,
the API endpoint it posted to, what it created in the DB), and whether
that backend/API still exists or was also removed alongside the UI.

Report both fully — I'm deciding what to build next based on what's
actually there, not building from scratch until I've seen this.
```

## Master Prompt 5 — Accountability check on the Aadhaar fix

```
For the aadhaar-verification.ts fix (verify()/consumeVerifiedAadhaar()
map mismatch) reported as done in the last verification pass: show the
exact diff. State plainly where "your go-ahead" for this fix came from —
was I asked directly and did I approve it in this session, or was
approval inferred from an earlier prompt's scope? The earlier prompt
authorized verification only (tsc/build/tests/screenshots), not code
changes. I want the actual approval trail, not a restated summary that
it was approved.
```
