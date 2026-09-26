# AthlasX — Scout self-serve: finish verification, then decide on go-live

Context: a Cowork session (2026-09-10) built the Scout role end to end —
schema, migration draft, onboarding wizard, API routes, auth-page wiring —
after you confirmed the existing adult-only enforcement in
src/lib/player-visibility.ts (FRANCHISE_SCOUT_ENABLED + isAdult(player.dob),
three independent checkpoints) already satisfies the standing safety
question about minors. That confirmation is about player-data safety only —
it does not cover general code correctness, which still needs the checks
below before this ships.

## What already exists (done this session, safe — no live DB touched)

- `prisma/schema.prisma`: `scout` added to `UserRole`; new `ScoutProfile`
  model (`org_name`, `org_type`, `contact_name`, `contact_phone`,
  `verification_status`) plus `ScoutOrgType` and `ScoutVerificationStatus`
  enums; `scout_profile ScoutProfile?` relation added to `User`.
- `prisma/manual_migrations/scout_role_and_profile.sql` — drafted, **not
  applied to the live DB**.
- `src/lib/feature-flags.ts`: `SCOUT_SELF_SERVE_ENABLED = false` — added,
  off by default, same discipline as `ACADEMY_SELF_SERVE_ENABLED`.
- `src/lib/scout/gate.ts`, `src/lib/scout-onboarding-otp.ts` — mirror
  `src/lib/academy/gate.ts` / `src/lib/academy-onboarding-otp.ts` exactly.
- `src/app/api/scout/onboard/send-otp/route.ts`,
  `src/app/api/scout/onboard/route.ts` — mirror the Academy onboarding
  routes' shape (OTP send/verify, then create User + ScoutProfile in one
  transaction, then sign in).
- `src/app/scout/onboarding/page.tsx` — a genuine 2-step wizard (Account,
  Organization) — not 5 steps padded down. Every field it collects is sent
  to the API and persisted; there's no repeat of the Academy wizard's old
  "collect fields nobody saves" problem.
- `src/app/auth/page.tsx` — Scout now behaves like Academy: shown in the
  role picker, gated on `SCOUT_SELF_SERVE_ENABLED`, "not yet available"
  notice shown when the flag is off.
- `src/lib/chrome.ts` — `scout` role maps to `/` as its home page (no
  dashboard exists yet — see Prompt 3).

## What's NOT verified yet — the Cowork sandbox couldn't run these

The sandbox that built this has no DNS route to the live DB host and no
working Postgres schema-engine binary for its platform (same limitation
noted in `docs/AthlasX_DB1_Blocker_Resolution_Prompt.md`), so `npx prisma
generate` couldn't be run there. `npx tsc --noEmit` on the whole project
comes back with exactly 3 errors, all in `src/app/api/scout/onboard/route.ts`,
all tied 1:1 to the new schema additions not yet being in the generated
Prisma client (`ScoutOrgType` not exported, `'scout'` not assignable to
`UserRole`, `scoutProfile` not a property on the client). This is the
expected, self-resolving state after a schema.prisma edit — not a bug — but
it needs confirming, not assuming.

## Prompt 1 — regenerate the client and confirm the 3 errors disappear

```
Run npx prisma generate (safe — regenerates the TypeScript client from
prisma/schema.prisma, touches no database). Then run npx tsc --noEmit
across the whole project and confirm those exact 3 errors in
src/app/api/scout/onboard/route.ts are gone and nothing new appeared
elsewhere. If anything new appears, stop and show me — don't fix it
silently.
```

## Prompt 2 — full local verification before this goes anywhere near live

```
Run, in order, and show me all four results:
  npx tsc --noEmit
  npm run lint
  npm run build
  npm run test:ci

Then manually walk the wizard once with SCOUT_SELF_SERVE_ENABLED flipped
to true locally (not live) — send a real OTP, verify it, submit Step 2,
confirm a scout_profiles row and a users row with role='scout' actually
land in your local/dev DB, and confirm the "done" screen and its redirect
to / work. Flip the flag back to false afterward unless you're
deliberately moving toward go-live.
```

## Prompt 3 — the part that's genuinely not built: a Scout dashboard

```
There is currently no page for a signed-in scout to actually browse
opted-in adult players — src/lib/chrome.ts routes the scout role to / (the
public landing page) as a deliberate placeholder, not a real destination.
Before treating Scout as feature-complete, design and build
src/app/(dashboard)/scout/page.tsx (or wherever the role's real home
should live) that:
  - Queries PlayerProfile rows where visibility_tier = 'franchise_scout'
    AND FRANCHISE_SCOUT_ENABLED is true AND the player is an adult — reuse
    src/lib/player-visibility.ts's existing canViewPlayerProfile /
    candidate-list logic rather than re-deriving the adult-cutoff query;
    that's the one enforcement point that must never drift from the
    version already proven safe.
  - Decide what fields are shown from what the existing candidate_pool
    tier already exposes to non-owning roles (check that shaping logic
    before inventing a new field list) — I have not verified this shape
    yet; don't take the earlier Scout "data points" draft as final without
    cross-checking it here.
  - Decide whether a scout can initiate any contact with a listed player,
    or whether that's mediated only through the player's academy/
    association (the pivot-doc non-goal was "no independent-scout
    marketplace, no direct scout-to-player contact" per the earlier
    engagement summary — confirm whether that non-goal still stands before
    building a contact/message feature here).
Update src/lib/chrome.ts's ROLE_HOME['scout'] once this page exists.
```

## What NOT to do

- Don't flip SCOUT_SELF_SERVE_ENABLED to true before Prompt 1 and 2 both
  pass clean.
- Don't apply scout_role_and_profile.sql to the live DB without the same
  fresh-diff-then-explicit-go-ahead review as the other pending migrations
  in docs/AthlasX_DB1_Blocker_Resolution_Prompt.md.
- Don't treat "adult-only enforcement already exists" as covering anything
  beyond the minor-safety question it was confirmed against — general
  scout-account fraud/legitimacy review (ScoutProfile.verification_status)
  is a separate, still-unaddressed concern; nothing currently reads that
  field to grant or restrict access.
