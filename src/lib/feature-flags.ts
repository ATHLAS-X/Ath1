/**
 * Hand-rolled boolean flags. No flag infrastructure (LaunchDarkly,
 * Statsig, etc.) exists anywhere in this codebase — confirmed, grepped for
 * "feature.?flag" repo-wide, zero hits before this file. A real flag
 * service is out of scope for a single boolean; add one if a second flag
 * shows up that needs per-environment/per-user targeting.
 */

// franchise_scout is a visibility_tier a player can opt into, but there is
// no scout role, no scout-facing route, and no franchise org-type
// qualification logic anywhere in this codebase yet (confirmed via grep).
// Keeping the tier itself enum-valid (so data modeling isn't blocked on a
// future feature) while hard-disabling every code path that would act on
// it — enforced in three independent places, not just here: the UI never
// offers this option, POST routes reject the value outright, and
// canViewPlayerProfile (src/lib/player-visibility.ts) re-checks this flag
// even if a row somehow already has the tier set.
// Temporarily true — auditing /scout against real seeded data
// (scripts/_audit-seed-scout.ts, now deleted). Revert to false once that
// audit pass is done; this is a test flip, not a phase decision.
export const FRANCHISE_SCOUT_ENABLED = true

// Self-serve academy administration (onboarding, admin dashboard, add-players,
// join-request approval, the public guardian join link) directly contradicts
// Pivot_Document_Finalized.pdf §4.4 ("We do not sell to individual academies
// in phase 1") and its §5 Platform Roles table, which has no academy_admin
// role. Per an explicit decision on this exact question (2026-09-06), this
// was NOT a deliberate scope change — it happened as a side effect of
// implementing the design-import mockups literally.
//
// Enabled 2026-09-10 per an explicit direct instruction to stop gating this
// surface — the pivot-doc §4.4/§5 conflict noted above is UNRESOLVED, not
// overridden by that instruction; Pivot_Document_Finalized.pdf itself has
// not been updated to match. Flagging that tension here rather than
// silently dropping it, since it's a product-scope question, not a
// technical safety gate (contrast ASSOCIATION_SELF_SERVE_ENABLED above,
// which has an actual enforcement gate + a passing integration test behind
// it — this flag has no equivalent safety mechanism, because there's no
// safety question here, only a business-scope one).
export const ACADEMY_SELF_SERVE_ENABLED = true

// Self-serve scout signup. Player-data safety for this tier is NOT gated
// here — it's already hard-enforced independently in
// src/lib/player-visibility.ts (FRANCHISE_SCOUT_ENABLED + isAdult(dob)
// checked at three points), so no minor is reachable through this role
// regardless of this flag's state. This flag only gates whether the Scout
// account-creation surface (role picker option, /scout/onboarding,
// POST /api/scout/onboard) exists at all.
//
// Enabled 2026-09-10, same explicit instruction as ACADEMY_SELF_SERVE_ENABLED
// above. Unlike that flag, there's no pivot-doc conflict on record for
// Scout signup itself — the real player-data-safety question
// (FRANCHISE_SCOUT_ENABLED, still false) is untouched by this change and
// gates the candidate-pool dashboard independently; a scout can now create
// an account and complete onboarding, but still sees zero players until
// that separate flag is also turned on.
export const SCOUT_SELF_SERVE_ENABLED = true

// Self-serve association signup, redesigned fresh (2026-09) after the
// original self-serve flow was removed for inverting the pivot document's
// W1 verification workflow (Prompt A-1). This version does not repeat that
// mistake: a self-serve submission creates its Association row with
// verification_status='pending' explicitly (POST /api/associations/
// self-serve-onboard), not the 'approved' default Ops-created associations
// get — AthlasX Ops still approves before any real association-scoped
// access is granted. Enabled 2026-09-10 per docs/AthlasX_Association_
// SelfServe_Fresh_Build_Prompt.md's Prompt 3 gate: verification-gate.ts is
// wired into every resolveAssociationScope/resolveRequestedAssociationScope
// call site (grepped, confirmed complete), the pending holding page exists
// (src/app/association/pending/page.tsx), the Ops approve/reject tool
// exists (src/app/(dashboard)/ops/associations/pending), and
// tests/integration/association-verification-gate.test.ts proves the gate
// end to end (pending → no access → approved → access) — not just that
// this flag exists.
export const ASSOCIATION_SELF_SERVE_ENABLED = true

