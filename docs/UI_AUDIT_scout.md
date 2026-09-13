# AthlasX — `/scout` Dashboard Audit

**Route** `http://localhost:3000/scout` (Candidate Pool)
**Date** 2026-09-10
**Auth state** Real, seeded session — a genuine `scout`-role `User` + `ScoutProfile` row and two adult `PlayerProfile` rows with `visibility_tier: franchise_scout`, created via a temporary script (`scripts/_audit-seed-scout.ts`, deleted after use) so the runtime pass measures actual rendered data, not a 404/empty shell. `FRANCHISE_SCOUT_ENABLED` was temporarily flipped `true` for this pass — **not yet reverted**, pending your review of this report.
**Method** `atelier:ui-audit` — source pass (`src/`-scoped) + real-Chrome runtime pass at 3 viewports. The upstream `audit-runtime.mjs` has no cookie/auth support at all, so I patched a copy in scratch (not the plugin cache) to accept `--cookie` and inject it via CDP `Network.setCookie` before navigation — noting this because it's a deviation from the stock script, not something to assume works for every future route audit without re-checking.

---

## What works

- **Zero idle cost, same as the landing page** — 0 layouts/style-recalcs/rAF callbacks per second at rest, at all three viewports. Whatever else is true of this page, it costs nothing when nobody's looking at it.
- **The read-only boundary is real, not just documented.** I looked for any contact/message affordance anywhere in the rendered output and in `scout/page.tsx` — there is none. The header comment's claim ("no contact/message affordance anywhere on this page") holds up against the actual DOM, not just the comment.
- **Minor role gets no route to reach here.** `FRANCHISE_SCOUT_ENABLED` + `isAdult(dob)` correctly kept both seeded adults visible and would exclude a minor — this wasn't re-tested today (no minor row was seeded), but it's the same chokepoint verified in this session's earlier integration-test work, not new.

---

## Headline findings

**Status update (2026-09-10, post-audit):** Findings #2 and #4 are fixed and verified live; #1 and #3 are folded into the `/scout` redesign, not fixed in isolation.
- **#2** — turned out to need zero changes to this file. The root cause was `globals.css`'s `--ax-text-faint` custom property (`0.4`) having drifted from `tailwind.config.ts`'s `ax.textFaint` (already `0.5`, already AA-passing at ~4.98:1) — `scout/page.tsx` was always using the correct `text-ax-textFaint` Tailwind utility, not the stale raw var. Synced `globals.css` to match; confirmed live via `getComputedStyle` on every `.text-ax-textFaint` element on this page — all now compute `rgba(245, 245, 240, 0.5)`.
- **#4** — `src/lib/chrome.ts`'s hardcoded `badge: '3'` on the Notifications nav item removed outright (no real count exists to replace it with). Confirmed live: the sidebar no longer shows a badge on Notifications.

**1. [Structural] 71–75% of the viewport is empty below the candidate list, on desktop and tablet.** Runtime pass: painted ink is **12.6% at 1440×900** and **16.0% at 768×1024**, with a single empty band covering **71.2%** and **74.7%** of the viewport height respectively, starting right after the two candidate cards. This isn't a bug in the sense of broken code — it's the honest state of a page that has exactly one content type (a raw 2-column/3-column card grid) and nothing else: no stats summary, no filter/sort affordance, no pagination, no empty-state illustration, nothing to anchor the page once the list is short. At 390×844 it's less severe (46.9% empty) because the cards stack full-width. **This will get worse, not better, as real scout data grows** — a candidate list that's sparse today reads as "empty state," but the composition problem is structural regardless of row count, since nothing currently occupies the space around the grid.

**2. [Broken, WCAG AA] Three pieces of on-page text use a token already confirmed to fail contrast, at sizes too small to qualify for the large-text exemption.** `text-ax-textFaint` (`rgba(245,245,240,0.40)` on `#0D0D0D`) was independently measured earlier this session at **~3.6:1 contrast** — below WCAG AA's 4.5:1 floor for normal text. This page uses that exact token at **9px** (`AthlasX Score` caption, `scout/page.tsx:88`), **11px** (subtitle, `:50`, and academy name, `:99`), and in the empty-state message (`:69-70`). None of these qualify for AA's large-text carve-out (≥18pt, or ≥14pt bold) — they're all well under it. This is the first place in the app I've actually shipped the previously-flagged-but-unfixed token into new UI.

**3. [Generic] The candidate card is a stock stat-card pattern — Tailwind defaults, not a considered composition.** `rounded-ax-lg` cards, a right-aligned bold number ("AthlasX Score"), a row of pill-shaped tag chips underneath. Nothing about the layout is specific to cricket scouting versus any other "browse a list of profiles" product. Not citing a source-scan number here since this is one small, hand-written file the automated convergence scan doesn't isolate — naming it as a direct visual read against the same rubric, consistent with the landing-page audit's convergence findings on the same codebase.

**4. [Note, but real and confirmed] The "Notifications" sidebar badge shows a hardcoded "3" for every role, including this one — and there is no `Notification` model anywhere in the schema.** `grep`-confirmed: `src/lib/chrome.ts:85` — `{ label: 'Notifications', href: '/notifications', badge: '3' }` is a literal string, not a query result, shared identically across all seven roles' nav config. `grep -i notification prisma/schema.prisma` returns nothing — there's no backing table for a real unread count to ever come from. The destination page itself (`notifications/page.tsx`) is honest when you get there (built for the player role only, shows "No player profile is linked to this account yet" for a scout) — the lie is isolated to the sidebar badge, visible on every dashboard including this one. This is the same class of finding as the academy dashboard's Activity Feed gap you named as the standard: **a UI element promising real data that doesn't exist.**

---

## Composition

| Viewport | Subject | Painted ink | Largest empty band | DOM elements |
|---|---|---|---|---|
| 1440×900 | `<svg>`, 1.8% viewport height | 12.6% | 71.2% (28.8%–100%) | 40 |
| 768×1024 | `<svg>`, 1.4% viewport height | 16.0% | 74.7% (25.3%–100%) | 26 |
| 390×844 | `<svg>`, 1.7% viewport height | 30.9% | 53.1% (46.9%–100%) | 24 |

The "subject" the script identifies (`<svg>`) is almost certainly a Lucide icon, not a meaningful page subject — with a two-card list and no hero image, there's no real dominant visual element here for the composition heuristic to lock onto. That's expected for a data-table-shaped page and not itself a finding; the empty-band numbers are the real signal (Finding 1).

**Frozen capture is byte-identical to live at all three viewports** (confirmed by file size) — consistent with 0 running animations. The `motion.div` fade-in on the header (`initial={{opacity:0,y:-8}}`) completes and settles before the runtime pass's wait window elapses; nothing loops.

---

## Design system

- Every color/spacing/radius token used on this page — `ax-text`, `ax-textDim`, `ax-textFaint`, `ax-accentBright`, `ax-bad`, `ax-cardBorder`, `ax-lg`, `ax-sm`, `ax-md` — comes from the shared Tailwind `ax-*` theme, **not** a locally re-declared object. This is the dashboard-side system the landing-page audit flagged as the "second, correct" half of the app's two-system split — confirmed again here as consistent, real usage, not a one-off.
- The one real defect within that correctly-used system is Finding 2 — the token itself (`ax-textFaint`) is under-contrast, not its usage pattern.

---

## Accessibility

- **Confirmed via source**: the candidate-card grid has no `role`/landmark structure beyond plain `div`s — not a violation on its own (a card grid isn't a table or list semantically), but there's no `<ul>`/`role="list"` either, so a screen reader announces 40 generic elements with no grouping cue at 1440px. Carried to Verify manually rather than asserted as broken, since "should this be a list" is a judgment call, not a fact.
- **Contrast**: Finding 2, above — the one concrete, measured a11y defect on this page.
- Everything else measured repo-wide in the earlier landing-page audit (100 unlabeled inputs, focus-visible gaps) doesn't apply here — this page has no form inputs at all.

---

## Performance

- **0 layouts/style-recalcs/rAF/main-thread-seconds per second at rest**, all three viewports — matches the landing page's idle-cost profile exactly.
- Payload is trivial: two cards, no images, no `next/image` calls on this route.

---

## Convergence

Not re-run as a separate scan for this one file — the repo-wide `src/`-scoped numbers from the landing-page audit (convergence score 86, `rounded-lg`/`rounded-xl`×149 real) already include this file's contribution, since it uses `rounded-ax-lg`/`rounded-ax-sm` throughout. Finding 3 above is the qualitative read specific to this page's composition.

---

## Verify manually

- **Card grid semantics** — whether the candidate list should be a `<ul>`/`role="list"` for screen-reader grouping. A judgment call, not settled by this pass.
- **Composition at real scale** — this audit ran against exactly 2 seeded candidates. Whether Finding 1's empty-space problem is actually worse or self-resolving once a realistic candidate count (dozens/hundreds) is loaded wasn't tested — worth re-running this same pass once real franchise-scout-tier data exists, rather than assuming today's 2-row measurement generalizes.
- **`FRANCHISE_SCOUT_ENABLED` is currently `true`** in the working tree as a result of this audit pass, and the seeded scout account/players still exist in the dev database. Both need an explicit decision from you: revert the flag and delete the seed rows, or leave them for the next round of dashboard audits (`/coach`, `/association`, `/academy`, `/record` per your list don't need this flag, but leaving real franchise-scout data seeded might be useful context for later work — your call, not mine to decide silently).

---

## Recommendations

Directions and constraints only, no colors specified beyond the existing `ax.*` tokens already in use — ranked by consequence:

1. **Fix the "Notifications: 3" hardcoded badge** (Finding 4) before anything else in this list — it's the cheapest fix here and the same category of problem you already named as the standard to hold every dashboard to. Either compute a real count (needs a `Notification`-shaped data source that doesn't exist yet — a real schema question) or remove the badge until one exists, the same choice the academy dashboard's Activity Feed comment already models.
2. **Swap `text-ax-textFaint` for `text-ax-textDim` (or another AA-passing token already in the `ax.*` set) at the three call sites in `scout/page.tsx`** (Finding 2) — this is a same-system swap, not a new color decision, so it's in scope for a straightforward fix once you confirm you want it.
3. **Give the candidate-pool page a second content element** — a stats strip, a filter/sort control, or a real empty-state treatment — so painted ink doesn't collapse to ~13% the moment the list is short. This is a genuine composition call or fixed for the `atelier` skill (I have it loaded), not just a token swap — worth confirming you want the design work before I start it.
4. **Re-run this same audit once real (non-seeded) franchise-scout data exists**, per Verify manually — today's numbers are honest but small-sample.
