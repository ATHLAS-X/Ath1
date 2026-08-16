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
