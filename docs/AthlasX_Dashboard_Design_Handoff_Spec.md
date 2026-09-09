# AthlasX Dashboard Design Handoff Spec

Stack: Next.js 14 App Router, Tailwind (ax.* tokens), Framer Motion for entrance animation, Recharts for charts, no Figma source — built from the approved Claude Design mockups plus the actual live source (`record/page.tsx`, `profile/page.tsx`, `coach/page.tsx`, `association/page.tsx`) read directly. Status column on each dashboard notes what's already implemented vs. still open, so this isn't a from-scratch build spec — it's what to verify/complete against.

No Scout section. That role doesn't exist in this product.

## Shared design tokens (all four dashboards)

| Token | Value | Usage |
|---|---|---|
| `ax-bg` | `#0D0D0D` | Page background |
| `ax-bgSoft` | `#141312` | Card/sidebar surface |
| `ax-accent` | `#FF8A1E` | Primary accent, active states |
| `ax-accentBright` | `#FFA64D` | Highlighted values, chart fills |
| `ax-text` | `#F5F5F0` | Primary text |
| `ax-textDim` | `rgba(245,245,240,0.62)` | Secondary text |
| `ax-textFaint` | `rgba(245,245,240,0.40)` | Tertiary/meta text |
| `ax-cardBorder` | `rgba(245,245,240,0.14)` | Card and row borders |
| `ax-fieldBg` | `rgba(245,245,240,0.06)` | Input/field backgrounds |
| `ax-ok` | `#38d39f` | Success/verified/positive |
| `ax-bad` | `#ff5a4d` | Error/negative/dropped |
| radii | 3/7/9/10/11px (`ax-xs/sm/md/lg/xl`) | Not Tailwind's default scale |
| `font-anton` | Anton, uppercase | Headings, stat numbers |
| `font-barlow-semi` | Barlow Semi Condensed 700, uppercase | Labels, chips, buttons |
| `font-barlow` | Barlow 400-600 | Body, table cells |

Shared components: `Card` (`src/components/ui/card.tsx`), `DashboardSidebar` (nav rail — role-scoped sections via `navSectionsForRole`, no role-switcher tabs on it or anywhere else).

---

## 1. Player — `/record`, `/profile`

**Status:** Built and API-wired (`GET /api/my-record`). Role badge (DR-1) done. Visual-polish parity (DR-3) done. Responsive audit (DR-2) not yet run — spec below states the requirement, not a confirmed pass.

### Layout
Single column, `max-w-[1100px]`, `space-y-6`. Header row (name + verified-matches pill) → AthlasX Score card → 6-tile stat strip → two side-by-side trend charts (stacks to one column below `lg`) → match log list → disclaimer footer.

### Components
| Component | Variant | Notes |
|---|---|---|
| Score card | Large stat | 5xl Anton number, tier pill, 3 sub-scores (Batting/Bowling/Fitness /10), percentile line, role badge (DR-1) |
| Stat strip | 6-tile grid | `grid-cols-3 sm:grid-cols-6` |
| Trend charts | Area (runs) + Bar (strike rate) | Recharts, `ax-accent`/`ax-accentBright` fills, custom tooltip matching `ax-bg`/`ax-cardBorder` |
| Match row | List item | Level badge (local/district/state/national, 4 distinct badge colors), opponent, tournament, runs(balls), SR, date |

### States and Interactions
| Element | State | Behavior |
|---|---|---|
| Page | Loading | Centered `Loader2` spinner in a Card |
| Page | No claimed profile | Empty-state card: "No claimed player profile found" / "Claim a profile at /claim to see a record here" |
| Match log | No verified matches | Empty-state card: "No verified matches yet" / "Scores appear once your association ingests and approves match data" |
| Score sub-values | Fitness not assessed | Shows "0" + "Not assessed" caption instead of a score |
| Percentile | Not enough cohort data | Falls back to "Not enough {category} {role}s in {district} yet for a percentile (N so far)" |

### Responsive behavior (requirement — DR-2 to confirm)
| Breakpoint | Requirement |
|---|---|
| Desktop (>1024px) | Two-column chart row, 6-column stat strip |
| Tablet (768-1024px) | Charts stack to one column (`lg:grid-cols-2` already does this); stat strip stays 6 columns — confirm it doesn't cramp |
| Mobile (<768px) | Header row wraps (`flex-wrap` already present); match rows must not clip the date column — this is the one confirmed-risky spot, check specifically |

### Edge cases
- Very long opponent/tournament names: currently `truncate` on opponent name only — tournament name has no truncation, verify it doesn't push the row height
- Zero matches vs. loading vs. error: currently no distinct error state if `/api/my-record` 500s — falls through to the "no profile" empty state, which is misleading. Worth a distinct error message.

### Accessibility (not yet audited — flag as open)
- Chart data has no text-alternative (screen reader gets nothing from the Recharts SVGs) — needs an ARIA-described summary or a visually-hidden data table equivalent
- No confirmed focus order audit on the match-log list

---

## 2. Coach — `/coach`

**Status:** Built and API-wired. DR-3 style parity done. Not yet confirmed whether server-side role gating exists (flagged open in the last security pass — pre-existing gap, not caused by recent changes).

### Layout
Single column. Header stats (squad count, "N need evaluation" chip) → policy banner → squad list, each row expandable into an inline evaluation form.

### Components
| Component | Variant | Notes |
|---|---|---|
| Header chips | Stat pill x2 | Squad size, evaluation-needed count |
| Policy banner | Static notice | Amber-tinted, explains what's visible to whom |
| Squad row | List item, expandable | Avatar initials, name, district, age, form flag, Fitness/Behaviour badges, score, chevron |
| Eval form | Inline expansion | Two 1-5 rating button rows (Fitness, Behaviour), 400-char note textarea with live counter, Save button |

### States and Interactions
| Element | State | Behavior |
|---|---|---|
| Squad list | Empty | "No squad found" |
| Rating buttons | Selected | Filled `ax-accent` background, others outline only |
| Note textarea | Approaching limit | Counter should shift to `ax-bad` near/at 400 — verify this exists, mockup implies it but source wasn't confirmed to have a color threshold |
| Save button | Saving | Should disable + show a loading indicator — confirm this exists, not just a static button |

### Responsive behavior (requirement)
| Breakpoint | Requirement |
|---|---|
| Desktop | Full row: avatar, name, district, age, badges, score, chevron all inline |
| Tablet | District/age may need to collapse into a secondary line under the name rather than separate columns |
| Mobile | Full row layout will not fit at 375px — this needs a real redesign to a stacked card per player, not just wrapping. Flag as the biggest responsive gap of the four dashboards. |

### Edge cases
- A squad with 0 players needing evaluation: "up to date" chip should read distinctly from "0 in squad" — confirm copy doesn't conflate the two
- Coach note at exactly 400 chars: confirm it blocks further input rather than silently truncating on save

### Accessibility
- Rating buttons (1-5) are almost certainly plain `<button>` elements in a row with no grouping — needs `role="radiogroup"`/`radio` semantics or an equivalent ARIA pattern so screen readers announce them as a single choice, not five unrelated buttons

---

## 3. Association — `/association`

**Status:** Built and API-wired across 4 real endpoints. Server-side role gating confirmed clean (`association/layout.tsx`). Confirmed responsive risk: `justify-between` rows without `flex-wrap` in Trial Cycles and Coach Assignments sections (DR-2 pending fix).

### Layout
Single column, `max-w-[1100px]`, four stacked Card sections, each with an icon+title+subtitle header: Trial Cycles, Selection Convergence, Season Tracking, Coach Assignments.

### Components
| Component | Variant | Notes |
|---|---|---|
| Section heading | Icon + title + sub | Reused across all 4 sections |
| Trial cycle row | List item | Category, venue(s), registration count, status badge (4 states: upcoming/open/closed/completed, each a distinct color) |
| Convergence row | List item | Player, district, average score, consensus label (unanimous/split/contested, 3 distinct colors) |
| Tracking row | List item | Player, district, role, score, trend arrow (up/down/flat) |
| Coach assignment card | Squad card | Name, season, status, coach chips (email + lead star), inline "assign a coach" dropdown |

### States and Interactions
| Element | State | Behavior |
|---|---|---|
| Each section | Loading | `Loader2` spinner |
| Each section | Error | Red (`ax-bad`) text with the specific fetch error message |
| Each section | Empty | Distinct copy per section (e.g. "No trial cycles for your association yet.") |
| Convergence | Locked | Lock icon + "Convergence has not been unlocked by the session chair yet." |
| Coach dropdown | Assigning | Spinner next to the dropdown while the POST is in flight |
| Coach dropdown | No unassigned coaches left | Dropdown should not render — confirm this, since showing an empty dropdown is worse than hiding it |

### Responsive behavior (requirement — one confirmed issue to fix)
| Breakpoint | Requirement |
|---|---|
| Desktop | All rows use `justify-between` two-ended layout as-is |
| Tablet | Same, should still fit |
| Mobile | **Confirmed risk**: `justify-between` without `flex-wrap` on Trial Cycles and Coach Assignments rows will clip at 375px. Needs `flex-wrap` + a stacked fallback (label above value) below ~400px. This is a DR-2 fix, not just a spec note. |

### Edge cases
- A squad with many coaches assigned: coach chips use `flex-wrap` already (confirmed in source) — good, no fix needed there
- Convergence average shown to 1 decimal — confirm this doesn't round differently than the same score shown elsewhere (ties to DR-4's data-consistency audit)

### Accessibility
- Status/consensus color-only badges (no icon or text pattern beyond the label itself) are fine since they do carry text, but verify contrast ratio of `ax-textFaint` on `ax-bg` meets WCAG AA — this is the dimmest text token against the darkest background, worth an explicit contrast check

---

## 4. Academy — 5 pages, all behind `ACADEMY_SELF_SERVE_ENABLED`

**Status:** Built (Overview, Players, Add Players, Join Requests, Batches) but flag-gated — unreachable until the flag is explicitly turned on. Spec below is for when that decision is made; don't build against a flag flip that hasn't happened.

### Layout
Overview: 3 stat tiles + 2 action cards → Players table with search → inline Add Players panel (CSV + manual entry + WhatsApp invite/QR).

### Components
| Component | Variant | Notes |
|---|---|---|
| Stat tile | 3-up | Active Players, Batches, Pending Join Requests |
| Action card | 2-up | Add Players ("CSV, manual entry, or WhatsApp invite"), Join Requests (count + Review button) |
| Players table | Data table | Search bar, columns: Age, Batch, Batting, Playing Style, Role, Guardian Phone, State/District, MINOR badge |
| CSV dropzone | Upload | Drag-drop + click-to-browse, "Download CSV Template" link, 5MB limit shown in copy |
| Manual entry form | Inline | Full name, phone, city/district, state, primary role, batting style |
| WhatsApp invite | QR + link | Static QR image + copyable join link |

### States and Interactions
| Element | State | Behavior |
|---|---|---|
| Players table | Empty | "No players match." (search) — confirm a distinct empty state exists for zero players overall, not just zero search results |
| CSV upload | Row-level result | Per-row "Added" or an error result, per the mockup — confirm partial-failure CSVs show which rows failed, not just an aggregate pass/fail |
| Join requests | Empty | "No pending join requests." |
| Batches | Empty | "No batches yet" / "Create your first batch to start assigning players." |

### Responsive behavior (requirement — not yet auditable, flag is off)
Table-heavy layout (Players list, 8 columns) will need horizontal scroll or column-priority collapsing on mobile — this needs real design thought before build, not just wrapping, since dropping columns silently loses guardian-phone visibility on a minor's row, which matters.

### Edge cases
- A minor player with no guardian phone captured yet: current design shows "—" — confirm this is distinguishable from "not applicable" for an adult player, since both might render as "—"

### Accessibility
Not yet auditable — page is unreachable behind the flag; audit when it's turned on, not before.
