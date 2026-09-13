# AthlasX — Five Role Dashboard Design Prompt

Paste this whole prompt into your design AI as one message. It specifies the visual system, the layout pattern, and the exact columns/sections (the "bifurcations") for all five dashboards so the outputs stay consistent with one another and with AthlasX's real product data.

---

## 1. What you're designing

AthlasX is a cricket talent-identification platform. Design **five separate dashboard screens**, one per user role: **Scout, Academy, Association, Coach, Player**. All five must look like they belong to the same product — same tokens, same grid rhythm, same component shapes — but each surfaces different data because each role does a different job.

Do not invent a generic "admin dashboard" template and reskin it five times with different labels. Each dashboard's content and column structure below is derived from that role's real data model — follow it exactly, and only add supporting UI (search, filters, sort, pagination, empty/loading states) as needed to make the specified data usable.

Output each dashboard as its own full-screen artboard/frame, desktop width **1440×900**, dark theme only (no light-mode variant needed).

---

## 2. Design system — use these exact values, nothing invented

### Color tokens

| Token | Value | Use |
|---|---|---|
| `bg` | `#0D0D0D` | page background |
| `bg-soft` | `#141312` | card/panel background |
| `accent` | `#FF8A1E` | primary accent (CTAs, active states, key numbers) |
| `accent-bright` | `#FFA64D` | accent hover/highlight state |
| `text` | `#F5F5F0` | primary text |
| `text-dim` | `rgba(245,245,240,0.62)` | secondary text, labels |
| `text-faint` | `rgba(245,245,240,0.5)` | tertiary/meta text (timestamps, helper text) — **do not use 0.4, it fails WCAG AA contrast** |
| `card-border` | `rgba(245,245,240,0.14)` | all card/panel borders and dividers |
| `field-bg` | `rgba(245,245,240,0.06)` | input fields, table row zebra, inactive chips |
| `ok` | `#38d39f` | positive states (on-form, improving trend, unanimous consensus) |
| `bad` | `#ff5a4d` | negative states (form drop, below threshold, contested) |
| CTA button text | `#1a0e02` | text color sitting on top of solid `accent`/`accent-bright` buttons |

**Accent overlay tiers** (for accent-tinted backgrounds behind icons, active nav items, highlighted rows — use only these four alpha values, nothing in between):
`rgba(255,138,30,0.06)`, `rgba(255,138,30,0.08)`, `rgba(255,138,30,0.14)`, `rgba(255,138,30,0.22)`

### Radii
`xs 3px` (chips/tags) · `sm 7px` (small buttons, badges) · `md 9px` (input fields, stat tiles) · `lg 10px` (cards) · `xl 11px` (hero cards, modals)

### Typography
- **Headings**: Anton, uppercase, weight 400 — page titles, big score numbers, section headers
- **Labels/badges/buttons**: Barlow Semi Condensed, weight 700, uppercase, letter-spacing slightly open — nav items, stat-tile labels, table column headers, status badges, button text
- **Body**: Barlow, weight 400–600 — table cell values, descriptions, paragraph text

### Layout pattern (apply to every dashboard)
This is the "hero card + stat tiles + KPI ring" pattern:
1. **Left rail**: fixed nav sidebar, `bg-soft` background, AthlasX wordmark top, role-appropriate nav items, active item gets the `accent` overlay tier `0.14` background with `accent` text/icon.
2. **Hero card** at top of main content: `bg-soft`, `xl` radius, `card-border` border. Contains the role's single most important number as a **circular KPI ring** (accent-colored progress ring, Anton numeral in the center, label below in Barlow Semi Condensed) plus 2–4 lines of context text next to it.
3. **Stat-tile row** directly below the hero: 3–5 tiles, `md` radius, `field-bg` background, `card-border` border, each with a small label (Barlow Semi Condensed, `text-dim`) and a large value (Anton or bold Barlow, `text`).
4. **Primary data section(s)** below the stat tiles: tables and/or card grids per the column spec for that role (Section 4 below). Table headers use Barlow Semi Condensed uppercase on `text-dim`; rows alternate `bg` / `field-bg`; status/flag values render as small pill badges using the `ok`/`bad`/`accent` colors as appropriate, never plain text for a status.

Keep spacing generous and consistent: 24px page padding, 16–20px gaps between cards/tiles, 12px internal card padding minimum.

---

## 3. Do not do these things
- Do not use any color not listed above (no random blues/greens/purples).
- Do not use any alpha value for text/border/field other than `0.06`, `0.14`, `0.5`, `0.62`.
- Do not use any accent-overlay alpha other than `0.06`, `0.08`, `0.14`, `0.22`.
- Do not use a light background anywhere.
- Do not put messaging/contact/"reach out" affordances on the **Scout** dashboard — it is read-only by design (see below).
- Do not add sections, panels, or data fields not listed for that role — if it's not in the column spec, leave it out rather than inventing plausible-looking extra widgets.

---

## 4. The five dashboards — columns and sections

### 4.1 Scout dashboard
**Purpose**: browse and evaluate candidate players. Strictly **read-only** — no message, contact, or outreach button anywhere on this screen.

Hero: aggregate candidate count / average score in the pool (KPI ring = candidate pool average AthlasX score).

Primary section — **candidate grid or table**, one row/card per candidate, columns:
- Name
- Age
- District
- State
- Playing role (batsman / bowler / all-rounder / wicketkeeper)
- Batting style
- Bowling style
- Academy (affiliation)
- AthlasX score (shown as a small ring or numeral badge, accent-colored)
- Avatar/photo

Include filter controls above the grid for district, state, playing role, and score range — these are the only interactive affordances besides filtering/sorting.

### 4.2 Academy dashboard
**Purpose**: manage players and training batches for one academy.

Hero: total players enrolled (KPI ring).

Stat tiles: total players · total batches · pending join requests.

Primary section — **batches table**, columns:
- Batch name
- Age group
- Player count
- Schedule (label, e.g. "Mon/Wed/Fri 6–8am")
- Next session (date/time)

### 4.3 Association dashboard
**Purpose**: run trial cycles, review scout convergence, and track flagged players across the association's jurisdiction. This is the most data-dense dashboard — use three distinct tables/panels, clearly separated with section headers, not one merged table.

Hero: active trial cycles count or overall tracked-player count (KPI ring).

**Panel A — Trial cycles**, columns:
- Age category
- DOB window (start – end)
- Registration opens / closes
- Status (badge: upcoming / open / closed, etc.)
- Venues
- Registrations (count)

**Panel B — Scout convergence view**, columns:
- Player name
- District
- Average (score)
- Consensus (badge: Unanimous = `ok` green, Split = `accent` amber, Contested = `bad` red)

**Panel C — Tracked players**, columns:
- Name
- District
- Playing role
- Flag (badge)
- AthlasX score
- Score delta (show as +/- with an up/down indicator, green for positive, red for negative)

### 4.4 Coach dashboard
**Purpose**: monitor a coach's assigned player roster and catch players who need attention.

Hero: roster size or number of flagged players needing attention (KPI ring, accent if healthy, bad-colored ring segment if flags present).

Primary section — **roster table**, columns:
- Name
- Age
- District
- Playing role
- Flag (badge — one of: On Form [`ok`], Form Drop [`bad`], Skill Below Threshold [`bad`], None [neutral/no badge])
- AthlasX score

Sort/highlight flagged players (On Form / Form Drop / Skill Below Threshold) to the top or with a visually distinct row treatment.

### 4.5 Player dashboard
**Purpose**: a single player's own performance record — this is the most "personal profile" feeling screen of the five, built around one hero identity card.

Hero card: player name, playing role, and the **AthlasX total score as the KPI ring**, plus a **tier badge** (Local / District / State / National — each tier should get a visually distinct color/treatment, escalating in visual weight from Local to National, e.g. muted → accent → bright accent → gold/white highlight).

Stat tiles (score breakdown): Batting score · Bowling score · Fitness score (show "not yet assessed" state style if `fitnessAssessed` is false — do not fake a number).

Percentile panel: percentile value, cohort size, age category, district — presented as a comparison strip ("Better than X% of players in [age category] in [district], out of a cohort of [cohortSize]").

Career summary stat row: Matches · Runs · Average · Strike rate · Fifties · Best (score).

Trend section: a simple line/area chart showing score trend over time (use the accent color for the line).

Match list: a table/list of recent matches (most recent first) — keep columns minimal since exact match-row fields are venue/date/score-contribution style; use whatever the trend/matches data naturally provides, styled as compact list rows rather than a dense table.

---

## 5. Deliverable format
Produce all five as separate frames/artboards in one file or canvas, laid out left-to-right or in a 2+3 grid, clearly labeled with the role name above each frame. Keep every frame at 1440×900 desktop size. If your tool supports it, also export each as an individual PNG named `scout.png`, `academy.png`, `association.png`, `coach.png`, `player.png`.
