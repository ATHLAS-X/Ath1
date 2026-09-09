# AthlasX Dashboard Field Inventory + Master Design Prompt

Sourced by reading the actual page files directly (`record/page.tsx`,
`profile/page.tsx`, `coach/page.tsx`, `association/page.tsx`, and the five
files under `academy/`) — not from a description of intended behavior.
Two things worth flagging: `/profile` currently has almost no fields
(just email + role label) despite being the identity page; Academy is a
genuine 5-page build already, just unreachable while
`ACADEMY_SELF_SERVE_ENABLED` is off.

## Field inventory

### Player — /record, /profile
- Score card: AthlasX Score (total), tier badge, Batting /10, Bowling /10, Fitness /10 or "Not assessed"
- Percentile line: "Top X% of {age category} {playing role}s in {district} (N players)" or a not-enough-data variant
- Summary stats (6): Matches, Runs, Average, Strike Rate, Fifties, Best
- Runs trend chart, Strike rate trend chart (by match period)
- Match rows: level badge (local/district/state/national), opponent, tournament, runs (balls), strike rate, date
- Empty states: "No claimed player profile found", "No verified matches yet"
- Profile page: email, role label — that's the entire page right now

### Coach — /coach
- Header stats: squad size, "N need evaluation" counter
- Evaluation policy note (static text)
- Per-player row: initials avatar, name, district, age, flag (on_form/form_drop), Fitness rating, Behaviour rating, AthlasX score
- Expandable eval form: Fitness (1-5 buttons), Behaviour (1-5 buttons), Coach Note (textarea, 200 char limit, live counter), Save Evaluation button
- Empty state: "No squad found"

### Association — /association
- Trial Cycles: age category, venue name(s), registration count, status badge (upcoming/open/closed/completed)
- Selection Convergence: player name, district, average, consensus (unanimous/split/contested)
- Season Tracking: player name, district, playing role, AthlasX score, trend arrow (flagged players only — explicitly not the full roster, noted in-page)
- Coach Assignments: squad name, season, status, assigned coach chips (email, lead star), "assign a coach" dropdown (the one write action on this page)
- Empty states per section: "No trial cycles...", "No grades submitted...", "No players currently flagged.", "No squads..."

### Academy — 5 pages, all behind ACADEMY_SELF_SERVE_ENABLED
- Overview: 3 stat cards (Active Players, Batches, Pending Join Requests), 2 action cards (Add Players — "CSV, manual, or invite link", Join Requests)
- Players list: search box, per-row Age, Batch, Batting, Playing Style, Role, Guardian Phone, State/District, MINOR badge
- Add Players: CSV upload + "Download CSV Template", manual entry (Full name, 10-digit phone, City/District, State, Primary Playing Role, Batting Style), WhatsApp Invite, Join Link QR, per-row Added/Result status
- Join Requests: pending list, empty state "No pending join requests."
- Batches: name, Age Group, Day, Start/End time, "New Batch" create flow, empty state "No batches yet"

## Master design prompt (paste into Claude Design)

```
Create a 4-artboard dashboard mockup set for AthlasX, a cricket
talent-discovery platform. One artboard per role: Player, Coach,
Association, Academy — no Scout artboard; that role does not exist in
this product. Match the existing onboarding visual system exactly — this
extends it, it does not reinterpret it.

═══════════════════════════════
DESIGN SYSTEM — USE EXACTLY (verified against the live tailwind.config.ts
ax.* tokens, not approximated)
═══════════════════════════════
Background:       #0D0D0D
Surface soft:     #141312
Accent:           #FF8A1E (amber)
Accent bright:    #FFA64D
Text primary:     #F5F5F0
Text dim:         rgba(245,245,240,0.62)
Text faint:       rgba(245,245,240,0.40)
Card border:      rgba(245,245,240,0.14)
Field bg:         rgba(245,245,240,0.06)
Accent overlays:  rgba(255,138,30,0.06 / 0.08 / 0.14 / 0.22)
Success:          #38d39f
Error:            #ff5a4d

Fonts:
— Anton: all headings, section titles, stat numbers. UPPERCASE, weight 400.
— Barlow Semi Condensed 700: labels, chips, buttons, badges. UPPERCASE.
— Barlow 400-600: body text, table cells, data values.

Radii: 3/7/9/10/11px scale (not the default Tailwind scale) — small chips
use the smallest, cards use 9-11px.

STYLE (apply identically across all 4 artboards):
- Card-based sections: surface-soft background, 1px card-border, the
  radii above, generous internal padding
- Status/consensus/flag badges are small pill shapes with a tinted
  accent-overlay background matching their meaning (success green for
  positive/verified, amber for neutral/pending, error red for negative)
  — desaturated, never bright saturated green/red
- Left sidebar: persistent nav rail, surface-soft panel, AthlasX wordmark
  top (X in amber), nav items relevant to that role only, active item
  marked with an amber left-border or dot — NOT numbered onboarding
  steps, and NOT the Player/Coach/Academy tab switcher from the
  onboarding mockups. A signed-in user has exactly one role; there is no
  role switcher anywhere in a dashboard.
- Top bar: page title only. No tabs, no role switcher.
- Circular avatar chip top-right with account menu affordance

ARTBOARD 1 — PLAYER (/record):
Score card: large AthlasX Score number, tier badge, three sub-scores
(Batting /10, Bowling /10, Fitness /10). Percentile callout line below it.
Row of 6 stat tiles: Matches, Runs, Average, Strike Rate, Fifties, Best.
Two side-by-side trend charts (Runs trend, Strike rate trend) as simple
area/bar charts in the orange palette. Below that, a scrollable list of
match rows: level badge, opponent name, tournament, runs (balls), strike
rate, date.

ARTBOARD 2 — COACH (/coach):
Header row: squad count chip, "N need evaluation" alert chip. A policy
note banner. Below: a list of player rows (avatar initials, name,
district, age, on-form/form-drop flag, Fitness badge, Behaviour badge,
AthlasX score, chevron). Show one row expanded into its evaluation form:
two 1-5 rating button rows (Fitness, Behaviour) and a note textarea with
a character counter and a Save button.

ARTBOARD 3 — ASSOCIATION (/association):
Four stacked card sections, each with an icon + title + subtitle header:
(1) Trial Cycles — rows of age category, venue, registration count,
status badge. (2) Selection Convergence — rows of player name, district,
average score, consensus label. (3) Season Tracking — rows of player
name, district, role, score, trend arrow. (4) Coach Assignments — squad
name/season/status with assigned-coach chips and an "assign a coach"
dropdown. This role is read-only except for that one dropdown — don't
add other edit affordances.

ARTBOARD 4 — ACADEMY:
Top row: 3 stat tiles (Active Players, Batches, Pending Join Requests).
Two action cards below (Add Players, Join Requests). Then a players table
view: search bar, columns for Age, Batch, Batting, Playing Style, Role,
Guardian Phone, State/District, with a MINOR badge on applicable rows.
Include a small secondary panel showing the Add Players flow: a CSV
upload dropzone with a "Download CSV Template" link, plus a manual-entry
form (Full name, phone, City/District, State, Primary Playing Role,
Batting Style) and a WhatsApp Invite / Join Link QR option.

Keep all four artboards visually identical in chrome (sidebar, top bar,
card style, typography, spacing) — only the content differs. Use
realistic Indian names, districts, and cricket terminology throughout,
not placeholder lorem ipsum. Dark is absolute, amber is the sole accent,
typography is bold and architectural — same premium sports-tech feel as
the onboarding flows, carried into a data-dense dashboard context rather
than a form context.
```
