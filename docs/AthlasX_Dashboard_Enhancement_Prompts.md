# AthlasX — Dashboard Enhancement Prompts (Player, Coach, Association, Academy)

Prerequisite: confirm the Supabase pooler password has actually been
reset and `.env.local` updated before running DR-4 or DR-5's live checks
— everything else here is safe to run regardless of DB state since it's
either static code (DR-1, DR-2, DR-3) or a report (DR-6).

No Scout dashboard, no Scout API. That role doesn't exist in this system.

## Prompt DR-1 — Surface the player's role explicitly

```
On /record, add a standalone role badge/label near the player's name in
the header (next to "My Record" / player.full_name) showing
player.playing_role in readable form (e.g. "Batsman", "All-rounder"),
same badge style already used elsewhere (e.g. the verified-matches pill).
Don't remove it from the percentile sentence — add it as its own element,
don't just relocate it. Check /coach's squad list and /association's
season-tracking rows too — if playing role is available in their API
responses but not shown as clearly, surface it the same way there for
consistency.
```

## Prompt DR-2 — Real responsive audit across all four dashboards

```
Using Playwright, load /record, /profile, /coach, /association (and
academy's pages if ACADEMY_SELF_SERVE_ENABLED is on for this pass) at
three viewport widths: 375px (mobile), 768px (tablet), 1280px (desktop).
Screenshot each combination. Report, per page per width: any horizontal
overflow/clipping, any row using `justify-between` without `flex-wrap`
that breaks at narrow widths (Association's Trial Cycles and Coach
Assignment rows are known candidates — confirm and check for others),
any fixed-width element that doesn't shrink, any text truncation that
loses meaning.

Fix what you find: add flex-wrap and stack-on-mobile patterns
(flex-col on narrow, flex-row on wider) consistent with how /record
already does it in a couple of places. Re-screenshot after fixing to
confirm. Don't touch layouts that already pass at all three widths.
```

## Prompt DR-3 — Visual-polish parity against the approved Design mockups

```
Compare the current /record, /coach, /association pages against the
approved Claude Design mockups (attached/described: tier badge treatment,
chart bar gradients, the evaluation-policy banner style, stat-tile
layout). List concrete visual deltas — not a redo, a diff — between what
the mockup shows and what the live component currently renders. Apply
only the deltas that are pure styling (colors, spacing, badge shapes,
gradient fills already using the ax.* tokens) — do not change any data
structure, API call, or layout logic to chase the mockup. Report anything
in the mockup that would require new data the API doesn't currently
return, rather than building fake UI for data that doesn't exist yet.
```

## Prompt DR-4 — Data consistency audit

```
Once DB connectivity is confirmed (see prerequisite above), audit for
internal consistency across dashboards, not just "does it render":
- Player's percentile line math matches percentile.value's actual meaning
  (confirm "Top X%" is computed as 100 - percentile, not percentile
  itself, per the existing code)
- Association's Season Tracking trend arrows match the sign of
  score_delta for every row, no arrow shown when delta is exactly 0
- Coach's per-player "score" matches what feeds the same player's
  AthlasX Score shown on their own /record page (cross-check one real
  player end-to-end if a test account exists)
- Any stat shown on more than one dashboard (e.g. AthlasX Score, playing
  role, district) is byte-identical across every dashboard that shows it
  — report any drift as a real bug, not a styling issue

Report findings as a table: field, dashboards it appears on, consistent
y/n, and the actual values compared if inconsistent.
```

## Prompt DR-5 — Security/ops pass on whatever DR-1 through DR-3 touched

```
Re-run the same checklist as the earlier security pass (server-side role
gating, rate limits on any new/changed endpoint, no client-trusted role or
user ID, no secrets in client bundles) scoped specifically to whatever
files DR-1/DR-2/DR-3 modified. Don't re-audit the whole app again — this
is a targeted check on new changes, using the existing checklist as the
standard.
```

## Prompt DR-6 — Verification

```
Run tsc + build + tests. Re-run DR-2's three-viewport screenshot pass on
whatever changed. Confirm DR-1's role badge renders correctly for at
least one real account per role type. Report pass/fail per item — and
explicitly confirm whether the DB connection is clean, since several of
these prompts assumed it would be by the time this runs.
```
