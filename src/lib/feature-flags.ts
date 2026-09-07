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
export const FRANCHISE_SCOUT_ENABLED = false

// Self-serve academy administration (onboarding, admin dashboard, add-players,
// join-request approval, the public guardian join link) directly contradicts
// Pivot_Document_Finalized.pdf §4.4 ("We do not sell to individual academies
// in phase 1") and its §5 Platform Roles table, which has no academy_admin
// role. Per an explicit decision on this exact question (2026-09-06), this
// was NOT a deliberate scope change — it happened as a side effect of
// implementing the design-import mockups literally. Every code path that
// creates or serves this surface is gated on this flag, defaulting to off,
// same enforcement discipline as FRANCHISE_SCOUT_ENABLED above. Code stays;
// nothing is deleted. Flip to true only once a real phase decision is made
// (and update Pivot_Document_Finalized.pdf's §4.4/§5 to match).
export const ACADEMY_SELF_SERVE_ENABLED = false
