# AthlasX — Association self-serve, rebuilt fresh, with a real verification gate

Context: self-serve association onboarding was removed 2026-09-06 (Prompt A-1,
`docs/AthlasX_Pivot_Compliance_Audit_and_Role_Prompts.md`) because it let
anyone self-attest a data-sharing agreement and immediately get a real
`AssociationStaff` row with full association-scoped access — inverting the
pivot doc's W1 workflow where AthlasX Ops verifies a signed agreement first.

Decision (2026-09-10, in response to a direct question): rebuild it, but
**fresh** — do not resurrect the pre-removal wizard (`git show
871b5b9:src/app/onboarding/association/page.tsx` if you want to see it for
reference only) — and it must **not** repeat the original mistake. A
self-serve submission creates a real account, but the account starts in a
`pending` state with no real association-scoped access until AthlasX Ops
approves it. This is a security control, not a UX nicety — treat the "does
the gate actually block access" step as the thing that matters most, not the
wizard's visual polish.

## What already exists (done this session, safe — no live DB touched)

- `prisma/schema.prisma`: `Association.verification_status
  AssociationVerificationStatus @default(approved)` (existing/Ops-created
  associations default to `approved` since that path already IS the
  verification step; new field, enum `{pending, approved, rejected}`).
- `prisma/manual_migrations/association_verification_status.sql` — drafted,
  **not applied to the live DB**. Bundle its review/apply with the other
  pending migrations in `docs/AthlasX_DB1_Blocker_Resolution_Prompt.md`
  rather than applying it alone.
- `src/lib/feature-flags.ts`: `ASSOCIATION_SELF_SERVE_ENABLED = false` —
  added, off. Do not flip this true until Prompt 3 below is confirmed
  working end to end; flipping it before the gate is real silently reopens
  the exact hole A-1 closed.

## Prompt 1 — apply the schema change (bundle with the other pending ones)

```
Run npx prisma generate locally (safe, no DB touch — just regenerates the
Prisma client from the schema.prisma changes already made this session:
Association.verification_status, the AssociationVerificationStatus enum,
the new scout role and ScoutProfile model). Confirm it succeeds.

Then treat prisma/manual_migrations/association_verification_status.sql the
same way as the other pending migrations in
docs/AthlasX_DB1_Blocker_Resolution_Prompt.md — get a fresh live-DB diff,
show it to me, and wait for an explicit "apply" instruction before touching
DATABASE_DIRECT_URL. Don't apply this one in isolation; bundle it with
whichever of the other pending migrations haven't landed yet, same
enum-before-columns sequencing logic (this migration adds a column with a
DEFAULT, so it's safe on existing rows either way, but keep it in the same
reviewed batch rather than a separate ad hoc apply).
```

## Prompt 2 — build the fresh wizard

```
Build src/app/onboarding/association/page.tsx as a real self-serve wizard,
replacing the current static "sign-up isn't self-serve" notice
(src/app/onboarding/association/page.tsx today). Do not copy the
pre-removal version (871b5b9) — design fresh, but you may reuse its field
list as a reference for what to collect:
  - Identity: association name, type (state/district), state, optional
    parent state association (GET /api/associations/state-list already
    exists and is public — reuse it)
  - Account: email + password (no phone/OTP needed for this role based on
    precedent — association staff aren't handled via WhatsApp OTP anywhere
    else in this codebase; confirm that's still true before assuming it)
  - Data-sharing consent: real explanatory copy, not a decorative
    checkbox — same bar the original wizard held itself to
Follow the shared orange/Anton-Barlow onboarding visual system used by
player/coach/academy/scout onboarding (FIELD_CLS/LABEL_CLS/OPTCARD_CLS
token patterns — see src/app/academy/onboarding/page.tsx or
src/app/scout/onboarding/page.tsx for the exact convention). Gate the page
on ASSOCIATION_SELF_SERVE_ENABLED (see src/app/academy/onboarding/page.tsx's
identical gate pattern) — do not skip this.
```

## Prompt 3 — the part that actually matters: build and prove the pending gate

```
Create a new public route (do not reuse POST /api/associations/onboard —
that one is athlasx_ops-only and must stay that way) — e.g.
POST /api/associations/self-serve-onboard — that:
  1. Validates the same fields the old self-serve route validated
     (name/type/state/email/password/dataSharingSigned required).
  2. Creates the Association with verification_status: 'pending' explicitly
     (do not rely on the schema default for this path — set it explicitly
     so the intent is visible in the code, not implicit).
  3. Creates the User (role: 'association') and AssociationStaff row, same
     as today's Ops route.
  4. Signs the new user in (this path DOES sign in the creator, unlike the
     Ops route — same as the original self-serve flow's behavior).

Then — this is the step that makes the whole feature safe, not optional
polish — enforce the pending gate on every association-scoped surface:
  1. Add a helper (e.g. src/lib/association/verification-gate.ts) that,
     given a signed-in association-role user, checks whether EVERY
     association in their resolveAssociationScope() has
     verification_status === 'approved'. athlasx_ops is unaffected (null
     scope, unrestricted, matches every other check in this codebase).
  2. Call that helper wherever an association-role user currently reaches
     real data — at minimum: the (dashboard) layout/root for the
     association role's home page (src/lib/chrome.ts's ROLE_HOME maps
     'association' to /association), and every src/app/api/association/**
     and src/app/api/associations/** route an association-role caller can
     hit. Grep for resolveAssociationScope and resolveRequestedAssociationScope
     call sites first — that's every chokepoint that currently trusts
     AssociationStaff membership alone; each one needs the same
     verification_status check added, not just the top-level page.
  3. A pending association's signed-in staff member should see a holding
     page (build src/app/association/pending/page.tsx — "Your association
     is pending AthlasX Ops verification") instead of real dashboard
     access — same visual family as the onboarding pages, not the
     dashboard chrome.
  4. Write an integration test (tests/integration/, follow the
     two-association-fixture pattern tests/integration/visibility-tier.test.ts
     already uses) that: creates a pending association via the new route,
     confirms its staff member CANNOT read real association-scoped data
     through any API route, then flips verification_status to 'approved'
     directly in the test DB and confirms the same staff member NOW can.
     This test is the actual proof the gate works — don't consider this
     prompt done without it passing.

Run npx tsc --noEmit, npm run lint, npm run build, npm run test:ci after.
Show me all four results before I consider ASSOCIATION_SELF_SERVE_ENABLED
safe to flip.
```

## Prompt 4 — a minimal Ops approval action (not built yet)

```
Extend src/app/(dashboard)/ops/associations/new (or add a sibling page,
e.g. src/app/(dashboard)/ops/associations/pending) so an athlasx_ops user
can list associations with verification_status='pending' and approve or
reject one (a simple PATCH route, athlasx_ops-gated, setting
verification_status to 'approved' or 'rejected'). This can be as plain as
the existing ops tooling's visual bar — this is an internal tool, not a
public-facing page.
```

## What NOT to do

- Don't flip ASSOCIATION_SELF_SERVE_ENABLED to true until Prompt 3's
  integration test is written AND passing — the flag existing is not the
  same claim as the gate working.
- Don't let the new public route touch requireRole(["athlasx_ops"]) or
  otherwise weaken the existing Ops-only route — they should end up as two
  separate routes with two different trust levels, not one route with a
  bypassable check.
- Don't apply association_verification_status.sql to the live DB in
  isolation — bundle it with the other reviewed pending migrations.
