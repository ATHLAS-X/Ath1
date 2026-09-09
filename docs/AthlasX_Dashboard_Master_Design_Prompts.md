# AthlasX — Dashboard Master Design & Functionality Prompts

Visual source: the three onboarding screenshots (Academy Step 2, Player
Step 1, Coach Step 3) — same ax.* tokens already registered in
tailwind.config.ts (accent #FF8A1E, near-black bg, Anton headlines, Barlow
body) and the same shared components (Button, Card, Input, Label) already
used across all three onboarding wizards. Nothing new to design — this is
extending an existing system to four dashboards, not inventing a second one.

**Dropped from the reference screenshots, on purpose:** the top pill row
(`PLAYER / COACH / ACADEMY / SCOUT`) is a mockup-preview switcher, not a
real feature — a signed-in user has one role, and "SCOUT" is the
franchise-scout feature, which is flagged off (`FRANCHISE_SCOUT_ENABLED =
false`). None of the four dashboard prompts below include it. The
left-hand numbered step rail is also onboarding-specific (steps 1-5/1-3/
1-4) — dashboards aren't a linear wizard, so its visual chrome (dark
panel, Anton headline, orange active state) carries over into a
persistent nav rail, but its content becomes real nav sections, not
steps. Reuse `src/components/layout/DashboardSidebar.tsx` and its
existing `navSectionsForRole` — restyle it, don't rebuild it from scratch.

Build order: Player → Coach → Association → Academy. Player and Coach
mostly exist already (restyle/verify, per Prompts L-3/L-4 from the
earlier doc); Association doesn't exist at all (genuine new build);
Academy stays behind `ACADEMY_SELF_SERVE_ENABLED` regardless of how
finished it gets.

## Shared chrome — build once, reuse everywhere

### Prompt D-0 — Shared dashboard chrome

```
Restyle the shared dashboard shell (top bar + DashboardSidebar) onto the
ax.* tokens, used by all four role dashboards:

Top bar: AthlasX wordmark left (X in accent orange, matching onboarding),
no role-switcher pills — replace that space with a page title /
breadcrumb for whichever section is active. Right side: a circular avatar
chip with the user's initial (already exists per the screenshots) opening
an account menu (Settings, Log out).

Left rail: keep DashboardSidebar's existing navSectionsForRole logic
(don't rewrite the role-to-nav-section mapping), restyle its visual shell
onto ax.bg/ax.bgSoft/ax.cardBorder, Anton for section headers, Barlow for
item labels, orange left-border or dot on the active item (same visual
weight as the onboarding step rail's active-step treatment, not the same
component).

This is chrome only — no page content changes. Every dashboard below
assumes this shell already wraps it.
```

## 1. Player Dashboard (build order: first)

### Prompt D-1 — Player dashboard

```
Confirm /record, /profile, /notifications, and /settings already sit
under the shared dashboard chrome from D-0 and the ax.* token system
(per the earlier L-3 restyle). If any of the four still uses old
glass-card/zinc styling, bring it in line now.

Functionality (confirm this is what's actually there, don't assume):
/record shows the player's own dossier — cricket profile, cohort
percentile (added per the earlier Phase 1 percentile prompt), claim
status if unclaimed. /profile is the editable version of the same data.
/notifications lists trial invites, selection results, guardian-consent
requests. /settings covers account/contact info and guardian details for
minors.

No new functionality in this pass — this is confirming the restyle
covered the whole player-facing surface, not just /record in isolation.
```

## 2. Coach Dashboard (build order: second)

### Prompt D-2 — Coach dashboard

```
Confirm /coach sits under the D-0 shared chrome and ax.* tokens (per the
earlier commit 871b5b9 and L-4 verification — check, don't assume it's
still correct after D-0's chrome changes).

Functionality, per the pivot doc's W7: a coach sees only the squad(s)
they were assigned to BY THE ASSOCIATION — never a roster they can self-
assign to, never selection authority. The dashboard should show: assigned
squad roster, per-player tracking data for weekly season entries (W5),
and a notes/advisory field that's explicitly advisory-only, never a
selection input. If the current /coach page shows anything resembling
selection authority (approve/reject a player, set a squad), flag it to me
before changing it — that would be a compliance mismatch with the pivot
doc, not just a styling issue.
```

## 3. Association Dashboard (build order: third — genuine new build)

### Prompt D-3 — Association dashboard

```
Build a new dashboard for the athlasx_association role under the D-0
shared chrome and ax.* tokens from the start — there is nothing to
restyle here, this page doesn't exist yet.

Functionality, scoped to the pivot doc's role table (Association has no
selection authority, no record-creation rights here — creation stays at
/ops/associations):
- Trial cycle overview for their region (status, dates, dossier counts)
- Selection/convergence results for players trialed under their
  association
- Season tracking summary across their squads
- Coach assignments they've made (read + the assign action itself, since
  W7 says coaches are assigned BY the association)

Before writing any UI: check which existing API routes already scope
data to an association_id (trial-cycles, tracking, convergence likely
already do, from the W1-W5 backend work) versus what's net-new. Tell me
the real gap before building against assumed endpoints.

Gate the page to athlasx_association sessions only, same auth pattern as
the other role-gated dashboard pages.
```

## 4. Academy Dashboard (build order: fourth — stays flag-gated)

### Prompt D-4 — Academy dashboard

```
Continue the Academy admin dashboard under D-0's shared chrome and ax.*
tokens. Same standing constraint as before: gate on both
ACADEMY_SELF_SERVE_ENABLED and the academy_admin role, server-side, on
every page and API route in this feature — not just hidden from nav. No
nav entry appears for accounts where the flag is off.

Functionality already scoped from the earlier gap-finding pass: Batches
management (the backend/API already exists, UI doesn't) and Attendance
Flags review. Build both under the same visual system as the other three
dashboards — same card/table treatment, same Anton/Barlow/orange
language — so that if the flag is ever turned on, it doesn't look like a
bolted-on feature.

If finishing either page requires exposing something the flag currently
hides (e.g. making academy_admin a selectable role at signup), stop and
tell me — don't route around the flag to make the UI feel complete.
```

## Verification

### Prompt D-5 — Verify all four

```
Run tsc + build + tests. Then crawl all four dashboards logged in per
role (reuse the real-onboarding-flow throwaway accounts from the earlier
audit for coach/academy; player likely already has one; association has
no self-serve path, so use whatever the ops-created test row from L-0
verification looks like, or tell me if none exists yet). Confirm: shared
D-0 chrome renders identically across all four, zero old-theme classes
remain anywhere in the four dashboards, and the role-switcher pills from
the reference screenshots do not appear anywhere in the built pages.
Report pass/fail per dashboard.
```
