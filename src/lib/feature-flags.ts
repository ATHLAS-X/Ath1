/**
 * Hand-rolled boolean flags. No flag infrastructure (LaunchDarkly,
 * Statsig, etc.) exists anywhere in this codebase — confirmed, grepped for
 * "feature.?flag" repo-wide, zero hits before this file. A real flag
 * service is out of scope for a single boolean; add one if a second flag
 * shows up that needs per-environment/per-user targeting.
 *
 * Env-var-driven (NEXT_PUBLIC_-prefixed so the same value applies
 * server-side AND client-side — several of these are read by client
 * components too, e.g. src/lib/chrome.ts's navSectionsForRole(), which
 * DashboardSidebar.tsx calls to decide which nav sections to render). A
 * future toggle is a config change + redeploy, not a code change + PR.
 * Unset falls back to each flag's confirmed launch value below — these
 * are NOT arbitrary defaults, they're the actual launch decisions made on
 * 2026-09-11 (see each flag's own comment for the reasoning behind it).
 *
 * process.env.NEXT_PUBLIC_* reads must stay as static property access
 * (not a helper that takes the var *name*) — Next.js's build tooling only
 * inlines NEXT_PUBLIC_ vars into the client bundle when it can statically
 * see the full `process.env.NEXT_PUBLIC_X` expression at build time.
 */
function parseBool(raw: string | undefined, launchValue: boolean): boolean {
  if (raw === undefined || raw === '') return launchValue
  return raw === 'true' || raw === '1'
}

// franchise_scout is a visibility_tier a player can opt into. Enforced in
// three independent places, not just here: the UI never offers this
// option to a player unless real, the /api/scout/candidates route
// re-checks it, and canViewPlayerProfile (src/lib/player-visibility.ts)
// re-checks it again even if a row somehow already has the tier set.
//
// Launch value: true. This flag was flipped true 2026-09-10 as a
// temporary audit flip ("revert once done") — that audit is complete:
// /scout is a real dashboard with a real per-scout verification gate
// (src/lib/scout/verification-gate.ts, ScoutProfile.verification_status,
// an Ops approval queue at /ops/scouts/pending) and integration test
// coverage (tests/integration/scout-verification-gate.test.ts). Confirmed
// as the actual launch decision, not left on by default.
export const FRANCHISE_SCOUT_ENABLED = parseBool(process.env.NEXT_PUBLIC_FRANCHISE_SCOUT_ENABLED, true)

// Self-serve academy administration (onboarding, admin dashboard,
// add-players, join-request approval, the public guardian join link).
//
// Launch value: false. Pivot_Document_Finalized.pdf §4.4 ("We do not sell
// to individual academies in phase 1") and its §5 Platform Roles table
// (no academy_admin role) were never actually superseded — this flag had
// been left true since 2026-09-10 as a side effect of implementing the
// design-import mockups literally, not a confirmed decision. Confirmed
// 2026-09-11: honor the pivot doc, academy self-serve is off for launch.
// The code stays; nothing is deleted, per the "flip a flag" philosophy.
export const ACADEMY_SELF_SERVE_ENABLED = parseBool(process.env.NEXT_PUBLIC_ACADEMY_SELF_SERVE_ENABLED, false)

// Self-serve scout signup. Player-data safety for this tier is NOT gated
// here — it's already hard-enforced independently in
// src/lib/player-visibility.ts (FRANCHISE_SCOUT_ENABLED + isAdult(dob)
// checked at three points), so no minor is reachable through this role
// regardless of this flag's state. This flag only gates whether the Scout
// account-creation surface (role picker option, /scout/onboarding,
// POST /api/scout/onboard) exists at all.
//
// Launch value: true. Confirmed 2026-09-11 — scouts can sign up for an
// account; whether they can see any candidate data once signed up is the
// separate FRANCHISE_SCOUT_ENABLED flag plus their own per-scout
// verification gate.
export const SCOUT_SELF_SERVE_ENABLED = parseBool(process.env.NEXT_PUBLIC_SCOUT_SELF_SERVE_ENABLED, true)

// Self-serve association signup, redesigned fresh (2026-09) after the
// original self-serve flow was removed for inverting the pivot document's
// W1 verification workflow (Prompt A-1). This version does not repeat
// that mistake: a self-serve submission creates its Association row with
// verification_status='pending' explicitly (POST /api/associations/
// self-serve-onboard), not the 'approved' default Ops-created
// associations get — AthlasX Ops still approves before any real
// association-scoped access is granted. verification-gate.ts is wired
// into every resolveAssociationScope/resolveRequestedAssociationScope
// call site, the pending holding page exists
// (src/app/association/pending/page.tsx), the Ops approve/reject tool
// exists (src/app/(dashboard)/ops/associations/pending), and
// tests/integration/association-verification-gate.test.ts proves the
// gate end to end (pending → no access → approved → access).
//
// Launch value: true. Confirmed 2026-09-11.
export const ASSOCIATION_SELF_SERVE_ENABLED = parseBool(process.env.NEXT_PUBLIC_ASSOCIATION_SELF_SERVE_ENABLED, true)
