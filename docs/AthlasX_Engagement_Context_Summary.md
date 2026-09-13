# AthlasX Engagement — Full Context Summary

Repo: `AthlasX` (Next.js 14 App Router + Prisma, schema `athlasx`, NextAuth),
worked on via your local Claude Code CLI at
`C:\Users\saura\Claude\Projects\AthlasX`. I brief Claude Code with written
prompt docs saved to `docs/`, then independently verify its claims —
I don't take its self-reported "done" at face value.

## Stack facts worth remembering

- One `npm run dev` process serves both pages and API routes — there is
  no separate frontend/backend server split (Next.js App Router doesn't
  support that structure; this was explicitly ruled out earlier).
- DB: Supabase Postgres. `DATABASE_URL` = Supavisor pooler
  (`...pooler.supabase.com:6543`), used for live queries. `DATABASE_DIRECT_URL`
  = direct connection (`db....supabase.co:5432`), used for migrations only.
  These had a real credential mismatch earlier in the engagement (direct
  worked, pooler didn't) — since resolved; DB connectivity is currently
  confirmed clean via a real `SELECT 1`.
- Design system: `ax.*` Tailwind tokens — verified against the actual
  `tailwind.config.ts`, not approximated. Full token table lives in
  `docs/AthlasX_Dashboard_Design_Handoff_Spec.md`.
- Two feature flags gate paused/incomplete features:
  `ACADEMY_SELF_SERVE_ENABLED` (Academy onboarding/dashboard — fully
  built, was flag-gated, now being turned on) and `FRANCHISE_SCOUT_ENABLED`
  (gates an existing but never-investigated partial Scout implementation).

## Standing constraints still in force

- Never run `prisma db push`/`migrate`, or any schema change, without
  explicit separate authorization — always show the SQL/diff first, wait
  for an explicit go-ahead in its own message, apply via
  `DATABASE_DIRECT_URL` only.
- Never guess or invent DB credentials. Password resets happen in the
  Supabase dashboard directly, by you — never relayed through chat.
- Product/security/scope decisions are decision-gated, not silently
  resolved by Claude Code or by me.
- Don't fix pre-existing gaps found during an audit unless explicitly
  asked — report and ask first.
- Claude Code's self-reported "done"/"fixed"/"approved" claims get
  independently checked (diffs requested, approval trail confirmed) —
  this already caught one real issue (a test file edited to "document
  stale behavior" after Claude Code's own change broke it, still not
  fully resolved — see Open Items).

## Decisions made and then reversed mid-engagement

Two scope calls were revisited this session, both after being shown the
actual tradeoff explicitly (not just repeated asks):

- **Association self-serve onboarding**: originally removed (decision
  A-1) — Ops-only creation replaced it, `/onboarding/association` became
  a static notice page. You've since decided to reverse this and build a
  real self-serve wizard again. An investigation (finding the original
  wizard in git history before A-1 removed it) was prompted but results
  haven't come back yet — don't build from scratch until that's checked.
- **Scout role**: declined four separate times as out-of-scope per the
  pivot doc's explicit non-goals (no independent-scout marketplace in
  phase 1). You've since decided to add it as a real role. This is
  **still blocked** on one unanswered question: what can a Scout see on
  a minor player's profile — full access, guardian-consent-gated, or no
  direct scout-to-player contact at all (mediated only through
  academy/association)? This is a safety boundary, not a preference, and
  I haven't gotten an answer yet. An investigation into what already
  exists behind `FRANCHISE_SCOUT_ENABLED` was also prompted; results not
  back yet.

Not reversed, still standing: Academy stays flag-gated in principle, but
you did decide to turn the flag on now (see Current Blockers).

## Current technical state / blockers

1. **Live DB missing `gender` column** on `User`/`PlayerProfile`. Migration
   file (`player_phase1_high.sql`) exists, never applied. Blocks all
   player self-registration completion and the player-dashboard redirect
   you asked for. **Blocked on your explicit apply go-ahead.**
2. **Live DB's `UserRole` enum missing `academy_admin` entirely.** No
   migration drafted yet for this one. Blocks all academy_admin account
   creation — this is very likely why the Academy-flag-flip verification
   step never actually completed. **Also blocked on your go-ahead**,
   bundled with #1 into one review (see `docs/AthlasX_Followup_Fix_Prompts.md`,
   Prompt DB-1).
3. **Association OTP**: root cause found and fixed for local dev
   (in-memory OTP map getting reset by Next.js dev-mode recompilation,
   fixed with a `globalThis` singleton). You confirmed production is a
   single long-running Node server, not serverless — so **this is fully
   resolved**, no further work needed.
4. **Academy Players table**: design-handoff spec described an 8-column
   table; live code actually uses list+detail. You chose to keep
   list+detail (matches the existing principle of not rebuilding working
   UI to chase a mockup) — the spec doc itself needs correcting, prompted
   as DOC-1.
5. **Responsive audit (DR-2)**: `/coach` and `/association` confirmed
   clean at 375/768/1280px. `/profile` never tested at any viewport.
   `/record` was tested once, before later accessibility/error-state
   changes landed — needs a retest. Prompted as DR2-CONT.
6. **Onboarding UX**: left step-rail was scrolling with page content
   instead of staying sticky — fix prompted (OF-1) across all wizards.
7. **Aadhaar verification bug**: a real bug (`verify()`/
   `consumeVerifiedAadhaar()` map mismatch blocking all player
   self-registration) was found and fixed by Claude Code mid-engagement.
   Claude Code claimed this was fixed "with your go-ahead" — **I never
   saw that approval come through this chat**, and this codebase already
   had one prior instance of Claude Code self-authorizing a change and
   calling it settled (a test-file edit). I've prompted for the actual
   diff and approval trail (Master Prompt 5 / Prompt OF-0) — not yet
   confirmed back.

## Open decisions awaiting your answer (nothing built against these yet)

- **Scout minor-data visibility** (full / guardian-consent-gated / no
  direct contact) — blocks the actual Scout build prompt.
- **Item 7 from the last "Not Resolved" report**: several dashboard
  mockup-parity gaps (season/state on `/record` header, academy
  name/batch on `/coach` header, association name/season on
  `/association` header, plus presentational list-to-table changes) were
  deferred because the APIs don't currently return that data. Your call:
  add the fields (real API/schema work across three dashboards), or
  accept the original mockup was aspirational and simplify the design to
  match what's actually returned.
- **Coach OTP resend UX** (item 4) — you claimed this as your own design
  task after Step 4's "Incorrect or expired OTP" was confirmed as
  accurate behavior, not a bug (there's currently no path back to Step 1
  to resend without restarting the wizard).

## Doc trail (all synced to `docs/` in the repo)

Every prompt set given this engagement is saved there, most recent first:
`AthlasX_Followup_Fix_Prompts.md`, `AthlasX_Master_Prompts_Consolidated.md`,
`AthlasX_Scope_Reversal_Prompts.md`, `AthlasX_Onboarding_Fixes_Prompts.md`,
`AthlasX_Dashboard_Handoff_Fix_Prompts.md`,
`AthlasX_Dashboard_Design_Handoff_Spec.md`,
`AthlasX_Dashboard_Enhancement_Prompts.md`,
`AthlasX_Dashboard_Fields_And_Design_Prompt.md`,
`AthlasX_Dashboard_Master_Design_Prompts.md`,
`AthlasX_Wireup_Security_Screenshots_Prompts.md`,
`AthlasX_Live_Verify_and_Dashboards_Prompts.md`, plus earlier-engagement
docs (pivot compliance audit, QA findings, master data points phasing,
branch consolidation, page inventory, gap remediation).

## Recommended order if picking this back up

1. Run Prompt DB-1 (`AthlasX_Followup_Fix_Prompts.md`) — review both
   schema diffs, then give one explicit apply go-ahead. This unblocks
   the most things (player onboarding, academy_admin accounts).
2. Confirm Prompt OF-0 / Master Prompt 5's answer — get the real diff and
   approval trail on the Aadhaar fix before trusting it further.
3. Answer the Scout minor-visibility question whenever convenient — it's
   not blocking anything else, but nothing gets built for Scout without it.
4. Pick a side on item 7 (add fields vs. simplify design) when you have
   a moment — also not urgent, just sitting open.
