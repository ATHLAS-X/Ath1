# AthlasX — Mobile App Design Context

Purpose-built for porting AthlasX's web app into a native/mobile-web app with matching design and page structure (e.g. via Google Stitch or a similar AI UI generator). This document is self-contained: product context, every screen with what's actually on it, the design system's exact tokens, and known mobile-adaptation issues already found and fixed during a real mobile-viewport audit of the running app.

Generated 2026-09-20 by direct code reading (`prisma/schema.prisma`, `tailwind.config.ts`, `src/lib/chrome.ts`, every page file) plus a live mobile-viewport (375×812) walkthrough of the running dev server across all 7 roles.

**Note on screenshots:** this document describes every screen in enough visual/structural detail to be used as a design brief directly, but no image files were exported alongside it — the browser tool used to walk through the app in this session doesn't persist screenshots to disk. If you want literal reference images for Stitch, the fastest path is: run `npm run dev`, open each route below at a 375px-wide viewport, and screenshot it yourself — the dev server is already configured and every route/state needed is listed below in visitable order.

---

## 1. Product Overview

**AthlasX** is a cricket talent-identification and selection platform connecting five kinds of users around verified match data:

- **Players** build a profile and get discovered based on *verified* performance data (ingested from real match scorecards), not self-reported stats.
- **Coaches** track a roster of players, submit supervised fitness/behaviour evaluations, and get matched to associations.
- **Academies** manage batches of enrolled players and can (when enabled) self-serve onto the platform.
- **Associations** (district/state cricket bodies) are the platform's data source of truth — they ingest match data, run selection trial cycles, and grade candidates.
- **Scouts** (franchise/league recruiters) browse a read-only, age-gated candidate pool of *adult, opted-in* players only — this is a hard, multi-layered safety boundary, not a preference.
- **AthlasX Ops** (internal staff) approve self-serve association/scout signups and can create associations directly.

The core workflow (the "W-pipeline", visible on the Association Overview dashboard): **W1 Ingest** match data → **W2 Identity** resolution (match ingested names to real player profiles, or flag ambiguous ones for human review) → **W3 Trial Cycles** (registration, venues) → **W4 Grading** (blind, independent selector grading) → **W5 Tracking** (in-season form monitoring).

A player's core promise: match performance data is *never* self-reported. It only enters the system when an association ingests it from a real source (CricHeroes sync, scorecard PDF/OCR, structured CSV upload).

---

## 2. Roles & Data Model

### `UserRole` enum (exact values, `prisma/schema.prisma`)
```
player | selection_panel | coach | association | athlasx_ops | academy_admin | scout
```
`selection_panel` and `athlasx_ops` have **no self-serve signup** — they're provisioned internally. The other five all have public onboarding wizards.

### Each role's home route (`src/lib/chrome.ts` → `ROLE_HOME`)
| Role | Home route |
|---|---|
| `player` | `/record` |
| `coach` | `/coach` |
| `association` | `/association` |
| `athlasx_ops` | `/dashboard` |
| `selection_panel` | `/selection` |
| `academy_admin` | `/academy` |
| `scout` | `/scout` |

### Core entities (for context, not exhaustive — see `prisma/schema.prisma` for all ~50 models)
`User` (role, email, password_hash) → `PlayerProfile` / `CoachProfile` / `ScoutProfile` / `AssociationStaff` / `SelectorProfile`. `Association` (verification_status: pending/approved/rejected) owns `TrialCycle`s, `IngestJob`s, `Tournament`/`Match`/`Performance` rows. `Academy` owns `AcademyBatch`es and `PlayerProfile` memberships. `SelectionSession` → `Grade` (per-selector, blind) → `Selection` (final, immutable once locked). `TrendAlert` drives Weekly Tracking. `IdentityException` is the human-review queue for ingested rows the auto-matcher couldn't confidently resolve to a player.

---

## 3. Design System (exact tokens — use these verbatim)

### Color palette
Defined in `tailwind.config.ts` as the `ax-*` namespace (the correct, current system — some older dashboard pages still use raw Tailwind `green-*` swatches instead; that inconsistency was found and is being fixed page-by-page, see §6):

| Token | Value | Use |
|---|---|---|
| `ax-bg` | `#0D0D0D` | Page background (near-black, not pure black) |
| `ax-bgSoft` | `#141312` | Slightly-raised surface |
| `ax-text` | `#F5F5F0` | Primary text (off-white, not pure white) |
| `ax-textDim` | `rgba(245,245,240,0.62)` | Secondary text |
| `ax-textFaint` | `rgba(245,245,240,0.5)` | Tertiary/placeholder text (WCAG AA-verified at ~4.97:1 on `ax-bg`) |
| `ax-accent` | `#FF8A1E` | **Brand primary — orange.** Every primary CTA, active tab/nav item, progress fill |
| `ax-accentBright` | `#FFA64D` | Hover state for `ax-accent` |
| `ax-ok` | `#38d39f` | Status: positive/good (e.g. "on form") |
| `ax-bad` | `#ff5a4d` | Status: negative (e.g. "form drop") |
| `ax-cardBorder` | `rgba(245,245,240,0.14)` | Card/input borders |
| `ax-fieldBg` | `rgba(245,245,240,0.06)` | Input/field background |

On-accent text (text sitting on an orange button/fill) is always `#1a0e02` (near-black), not white — e.g. `bg-ax-accent text-[#1a0e02]`.

**Status colors used inconsistently as raw Tailwind swatches** (not `ax-*` tokens, but semantically legitimate — don't "fix" these into orange): `green-400`/`green-500` for approved/success/on-form/registration-open states, `red-400`/`red-500` for rejected/form-drop, `amber-400` for warnings/pending, `blue-400` for informational (e.g. "generates at close"). These are *status* indicators, distinct from the brand accent, and should stay a different hue from orange in the mobile app too.

### Typography
Three font families, loaded as Next.js `next/font/google` variables:
- **`font-anton`** (Anton, condensed display) — **all page/section headings**, always `uppercase`. This is the single most identity-defining typographic choice in the app — headings anywhere that *aren't* Anton+uppercase read as visually broken (this was an actual bug found and fixed on two dashboard pages this session).
- **`font-barlow`** — body text, form labels in some (older) contexts.
- **`font-barlow-semi`** (Barlow Semi Condensed) — small uppercase eyebrow labels (e.g. "COACH DASHBOARD" above a heading), button text, nav labels. Typically `text-[11px] font-bold uppercase tracking-[0.14em]` to `tracking-[0.22em]`.

Standard heading pattern (copy this exactly for any new mobile screen):
```
<p class="font-barlow-semi text-[11px] font-bold uppercase tracking-[0.18em] text-ax-accentBright">Eyebrow label</p>
<h1 class="font-anton uppercase text-xl sm:text-[30px] text-ax-text mt-1">Screen Heading</h1>
```
(The eyebrow line is optional — some screens go straight to `<h1 className="font-anton uppercase text-xl text-ax-text">`.)

### Buttons (`src/components/ui/button.tsx` — canonical component)
```
primary:   bg-ax-accent text-[#1a0e02] border-[1.5px] border-ax-accent
           shadow-[0_8px_22px_-8px_rgba(255,138,30,0.7)]
           hover:bg-ax-accentBright hover:border-ax-accentBright
           font-barlow-semi uppercase tracking-wide
secondary: bg-transparent text-ax-text border-[1.5px] border-ax-cardBorder
           hover:border-ax-text hover:bg-white/[0.06]
           font-barlow-semi uppercase tracking-wide
outline:   bg-transparent border border-white/10 text-zinc-200
           hover:bg-white/[0.05]
```
Rounded corners: `rounded-xl` (buttons/cards generally), custom radii `ax-xs`(3px)/`ax-sm`(7px)/`ax-md`(9px)/`ax-lg`(10px)/`ax-xl`(11px) for pixel-matched mockup fidelity.

### Layout shell (dashboard/authenticated pages)
```tsx
<div className="min-h-screen bg-ax-bg">
  <DashboardSidebar />   {/* desktop: fixed left rail, role-filtered nav sections */}
  <DashboardTopBar />    {/* small uppercase page-title label + account avatar/dropdown */}
  <main className="lg:pl-60 p-6">{children}</main>
</div>
```
On mobile (<1024px / `lg` breakpoint), the sidebar should collapse (the current web app doesn't have a polished mobile nav pattern for it yet — worth designing fresh for the mobile app rather than porting as-is; see §6). The topbar (small uppercase route label + circular avatar-initials chip + dropdown chevron) reads well at mobile width as-is and should be kept.

### Cards
`glass-card`: `background: rgba(255,255,255,0.025); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.06); border-radius: 1rem`. Most dashboard content cards use a flatter `bg-white/[0.02-0.04] border border-white/[0.06-0.08] rounded-xl p-4` pattern instead — glass blur is reserved for a few specific surfaces.

### Onboarding-wizard pattern (used by all 5 self-serve wizards)
- Two-column desktop layout: left sidebar with numbered step list (a filled circle + checkmark for done steps, outline for current/upcoming) and a short pitch; right side is the actual step form.
- **On mobile this already stacks correctly** — sidebar on top, form below — confirmed working in this session's audit.
- Top bar inside the form column: small "ATHLASX" wordmark (mobile-only, `lg:hidden`) + a persistent "Already have match data? Claim your profile" link + "Step N of M" label. **Known mobile issue**: these three crowd each other on the player-onboarding wizard specifically and wrap awkwardly — worth a cleaner mobile-specific header treatment (e.g. stack the claim-link below the step counter, or move it into an overflow menu) rather than porting the exact three-in-a-row layout.
- Footer: "Back" (outline) + primary action button (orange fill), always in a `flex justify-between` row.
- OTP step pattern (coach/academy/scout): mobile number + country code chip (`+91`) + "Send OTP" button → dev-mode banner reveals a 6-digit code in plain text (`Dev mode — no SMS gateway connected. Your test code is 123456`) → 6 individual 1-digit boxes + "Verify" button (client-side comparison only in this dev build; real verification happens at final submit).
- Consent step pattern (player, association): each consent is its own bordered panel with a fixed-height *inner* scrollable text block; the panel's checkbox stays disabled until that inner block is scrolled to its end. Design this explicitly as a distinct scrollable sub-region in the mobile app, not just an "I agree" checkbox — the scroll-gate is a deliberate compliance UX, not an oversight.

### The two-visual-system problem (relevant if porting 1:1 vs. redesigning)
The web app currently has two coexisting visual systems inherited from different build passes:
1. **The `ax-*` orange/Anton system** (landing, `/auth`, all 5 onboarding wizards, `error.tsx`/`not-found.tsx`, and — as of this session's fixes — `/claim`). This is the **correct, current** system.
2. **An older raw-Tailwind dark-glass system** with green accents instead of orange, used by several dashboard pages (`/dashboard`, `/selection`, `/grading`, `/convergence`, `/ingest`, `/tracking`, `/identity-exceptions`, `/trial-cycles`, `/academy-matching`, `/coach-signups`, all `/ops/*` pages). This session fixed the two most visible instances of this (heading font on `/dashboard` and `/tracking`; every primary green button/active-toggle across 8 files converted to orange) — **for the mobile app, design every screen using system #1's tokens (`ax-accent` orange, Anton headings) exclusively**, since that's the intended brand, not the legacy state.

---

## 4. Navigation Structure (`src/lib/chrome.ts` → `NAV_SECTIONS`)

Sidebar sections are role-filtered — a user only sees sections whose `roles` array includes their role:

| Section | Visible to | Items |
|---|---|---|
| **Association** | `association`, `athlasx_ops` | Overview (`/association`) · Trial Cycles (`/trial-cycles`) · Ingest & Data (`/ingest`) · Identity Exceptions (`/identity-exceptions`) · Academy Matching (`/academy-matching`) · Coach Signups (`/coach-signups`) |
| **Selection** | `selection_panel`, `athlasx_ops` | Candidate Pool (`/selection`) · Grading (`/grading`) · Convergence (`/convergence`) |
| **Season** | `coach`, `athlasx_ops` | Weekly Tracking (`/tracking`) · Coach (`/coach`) |
| **Player** | `player`, `athlasx_ops` | My Profile (`/profile`) · My Record (`/record`) |
| **Ops Tools** | `athlasx_ops` only | Create Association (`/ops/associations/new`) · Pending Associations (`/ops/associations/pending`) · Pending Scouts (`/ops/scouts/pending`) |
| **Academy** | `academy_admin`, `athlasx_ops` — *hidden entirely unless `ACADEMY_SELF_SERVE_ENABLED`* | Dashboard (`/academy`) · Players (`/academy/players`) · Batches (`/academy/batches`) · Add Players (`/academy/add-players`) · Join Requests (`/academy/join-requests`) |
| **Scout** | `scout`, `athlasx_ops` — *hidden unless `FRANCHISE_SCOUT_ENABLED`* | Candidate Pool (`/scout`) |
| **Account** | every role | Notifications (`/notifications`) · Settings (`/settings`) |

`athlasx_ops` sees essentially everything — useful to know if you want one "admin" persona in the mobile app that previews every screen.

---

## 5. Complete Screen Inventory

Every route, grouped by flow, with what's actually on it. All confirmed working at 375×812 mobile width in this session unless a "Mobile issue" note says otherwise.

### 5.1 Public / Marketing

**`/` — Landing**
Full-bleed 7-photo image collage (grid layout: one large `row-span-2` tile, several standard tiles) with a radial-gradient vignette overlay and the giant "ATHLASX" wordmark (white "ATHLAS" + orange "X") centered over it. Top bar: wordmark (small) left, "Sign In" (outline) + "Signup" (orange fill) buttons right. No forms. If a session exists, this route redirects server-side to that role's home instead of rendering.
*Mobile: renders cleanly, collage reflows, no overflow.*

### 5.2 Auth

**`/auth` — Sign In / Sign Up**
Two-column desktop (left: image collage + tagline; hidden on mobile), right column always visible: tab switcher (Sign In / Sign Up, orange-filled active tab), then:
- **Sign In**: Email, Password, "Remember me" checkbox, "Forgot password?" link, Sign In button, divider, "Continue with Google" (disabled — shows a toast), "Create an account" link.
- **Forgot password** (replaces the sign-in form in place): single email field → "If an account exists for that email, a password reset link has been sent" (always the same message, regardless of whether the account exists).
- **Sign Up**: role `<select>` (Player/Association/Academy/Coach/Scout), a one-line explainer, and a **Continue** button. Picking a non-default role navigates immediately to that role's wizard; the default (Player) needs the Continue click since its `<select>` value never changes.

**`/auth/reset-password`** — landing page for the emailed reset link (`?token=`). Three states: no token → error message + link back; token present → new-password + confirm-password form; done → success message + "Go to sign in". *Known issue: currently styled with a plain sans-serif heading, not Anton — should be built correctly (Anton) in the mobile app rather than ported as-is.*

### 5.3 Onboarding wizards (5, one per self-serve role)

All five share the split-layout/step-list pattern from §3. Step-by-step content:

**`/player/onboarding` (3 stages)** — the account-creation surface itself for players.
1. **Basic Details**: Full name, Email, Password, DOB, Gender, City, District, State, Enrollment date at academy, Highest level represented, CricHeroes handle (optional), Playing role (button group: Batsman/Bowler/All-rounder/WK-Batsman), Batting style, Bowling style, Preferred formats (multi-select chips), Academy (free-text with live lookup). If DOB computes as a minor: guardian name + phone appear, required.
2. **Verify Your Identity**: player's own Aadhaar number → OTP → verify; if minor, a second independent guardian-Aadhaar block runs the same flow.
3. **Footage, Review & Consent**: optional clip URLs (batting/bowling/keeping), YouTube channel, bio (400 char max), a read-only review summary, then 3–4 scroll-gated consent panels (Data collection, Visibility & sharing, DPDP guardian consent if minor, Terms) → "Create Profile".

**`/coach/onboarding` (4 steps, only steps 1 & 4 persisted)**
1. Account — Full name, mobile+OTP, email, password, city, optional headshot.
2. Experience *(collected, not saved)* — coaching role (Head/Assistant/Specialist/Freelance), specialization chips, years-of-experience stepper, played-at-state-level toggle.
3. Certifications *(collected, not saved)* — BCCI level badges, fake cert upload.
4. Association — search + card-select from a live association list (required).
→ "You're a coach on AthlasX" success screen.

**`/academy/onboarding` (3 steps, gated by `ACADEMY_SELF_SERVE_ENABLED`)**
Off by default — shows a static "not available yet" notice instead. When on:
1. Account — mobile+OTP, email+password.
2. Academy Identity — name, city, district, state, year established, academy type (Private/Government/Trust/Club — 2×2 card grid), primary contact name + designation, optional logo upload, head coach name, BCCI-affiliated toggle, state-association-affiliated toggle.
3. Go Live — illustrative-only "Invite Coaches" + "Create First Batch" widgets (no real API calls) → "Finish & Go Live" opens a success modal overlay ("[Academy name] is Live") rather than replacing the page content.

**`/scout/onboarding` (2 steps)**
1. Account — mobile+OTP, email+password.
2. Organization — **Organization Name (required, easy to miss — it's the first field, above the type cards)**, Organization Type (Franchise/Academy Recruiting Arm/Independent — card list), optional contact name/phone. Persistent disclosure line: "You'll only ever see adult players who opted in to scout visibility — enforced platform-wide, cannot be changed from your account." → account created with `pending` verification, routes to `/scout/pending`.

**`/onboarding/association` (3 steps, no phone/OTP anywhere)**
1. Account — email + password only.
2. Association Identity — name, type (State/District toggle), state, optional parent-association picker (districts only).
3. Data-Sharing Consent — scroll-gated agreement + checkbox → "Submit for Verification". Account created with `pending` verification, routes to `/association/pending`.

### 5.4 Alternate entry flows

**`/claim`** — for a player who already exists as an ingested "shadow profile" (association uploaded their match data before they ever signed up). 5 steps: search (name+district+DOB) → pick candidate from results → enter phone (+ guardian details if minor) → OTP → done. Visually now matches the main orange/Anton system (fixed this session — previously had a mismatched green-gradient icon-badge logo).

**`/join/[academyId]`** — fully public, no AthlasX account at all. A parent opens an academy's invite link and submits a join request. Deliberately uses a different light theme (Inter font, light background) — described in its own source comment as "meant to be opened by a parent on their own phone." Consider whether the mobile app wants this as a true light-mode screen or should unify it into the dark system.

### 5.5 Pending / gate states

**`/association/pending`** and **`/scout/pending`** — near-identical holding screens: centered clock icon, "Pending AthlasX Ops Verification" heading, one paragraph of reassurance copy, "Back to AthlasX" link. Shown only to a signed-in account of that role whose verification is still `pending`; auto-redirects past itself once approved.

### 5.6 Dashboard / role-home pages

**`/dashboard`** (association/selection_panel/coach/athlasx_ops) — cross-role pipeline overview: 4 stat cards (Registrations, Dossiers ready, Ingest jobs pending, Form-drop alerts), a "W3 Pipeline" step tracker (Ingest→Identity→Trial Cycles→Grading→Tracking, each with a status), "Registration Open" badge, "Manage cycles" button.

**`/association`** (association/athlasx_ops) — "Trial Season Command Centre" hero banner (tracked-player count, active-cycle summary, "Open Cycle Console" button) + stat tiles (Active Cycles/Registrations/Unanimous/Split/Contested) + Trial Cycles table + Scout Convergence table + Tracked Players table + Coach Assignment cards. **Mobile issue found & still open**: the three data tables here are desktop-shaped (multi-column rows) and don't reflow into mobile-friendly cards the way `/coach`'s roster or `/academy`'s panels do — design these as stacked cards for the mobile app, not literal tables.

**`/coach`** — "My Roster" — a circular roster-health gauge, 4 stat tiles (Roster Size/Needs Attention/On Form/Average Score), an "Average roster score, last 8 weeks" mini chart, and a scrollable roster list (each row: avatar, name, flag badge, an inline evaluation form — Fitness 1–5, Behaviour 1–5, notes). Renders cleanly on mobile.

**`/scout`** — "Talent Pool" — filters (district/state/role, "Score ≥ 65" toggle) + a read-only candidate table. Locked behind `/scout/pending` until Ops approves.

**`/record`** (player) — "My Record" — tier badge (Rising/Developing/Advanced/Elite ladder), circular AthlasX-score gauge, Batting/Bowling/Fitness sub-scores with progress bars, verified-match-history list, a green "Verified only" badge. Entirely read-only.

**`/academy`** (academy_admin, flag-gated) — dashboard: enrolled-player count ring, 4 stat tiles (Total Players/Active Batches/Pending Joins/Avg Players per Batch), an 8-week enrollment trend, Training Batches summary + "Manage Batches" link, Join Requests + Add Players quick links.
- **`/academy/batches`** — list + "New Batch" button (orange); click a batch for its roster panel.
- **`/academy/players`** — searchable roster; master list (left/top) + detail panel (right/bottom) — a two-pane layout that already stacks acceptably on mobile.
- **`/academy/add-players`** — 3 tabs (CSV Upload / Manual Entry / QR-WhatsApp Invite), tabs wrap to two rows on mobile cleanly. CSV tab: dashed drop-zone + "Download CSV Template" link.
- **`/academy/join-requests`** — approve/reject queue for parent join-link submissions.

### 5.7 Selection workflow

**`/selection`** (selection_panel/athlasx_ops) — Candidate Pool: header stat row ("N/M fully graded"), 4 stat tiles, search bar, role-filter pill row (All/Batsman/Bowler/All-rounder/WK-Bat), candidate cards. **Mobile issue found & still open**: candidate cards cram avatar+name+location+stats into a layout that wraps badly at 375px — `/grading`'s near-identical data renders as clean single-line rows instead; build the mobile candidate card off that pattern, not this one.

**`/grading`** — "Blind Grading" — a locked/pending badge, "N/M graded" counter, then one row per candidate (avatar-initials, name, district·role, a "Pending"/graded status pill, chevron). This list layout is the good mobile reference pattern for any similar list screen.

**`/convergence`** — "Convergence View" — unlock-status badge, 3 stat tiles (Unanimous/Split/Contested), sort pills (Highest/Lowest/Contested first), then one row per player: checkbox, name+district, a 1–10 dot-scale bar, score chip. Footer: "Lock Final Squad" card with a count of players marked + a Lock Squad button (disabled until ≥1 selected).

### 5.8 Association operational pages

**`/trial-cycles`** — persistent dashboard sidebar (Association/Selection/Season/Player section groups; collapses on real mobile) + "Trial Cycles" heading + orange "New Trial Cycle" button + a W3-pipeline step tracker + one card per active cycle (age category, DOB window badge, status pill, venue count, reg fee, venue name+date, "View Registrations" button).
- **`/trial-cycles/[id]/register`** — player-facing: pick a venue, acknowledge cash-only fee, optionally attach proof docs/footage.
- **`/trial-cycles/[id]/dossiers`** — master/detail: registrant list + generated performance dossier per player.

**`/ingest`** — "Ingest & Data" — a "N pending review" badge, then 3 source-connector cards (CricHeroes "Sync now" button, Scorecard PDF upload with a confidence progress bar, Excel/CSV drop-zone + template download), then a job review list (each with Approve/Reject).

**`/tracking`** — "Weekly Tracking" — two stat pills (form drops / on-form count), then a flagged-player list (or an empty "No tracked players yet" state). *(Heading font fixed this session — now correctly Anton/uppercase.)*

**`/identity-exceptions`** — review queue for ingest rows the auto-matcher couldn't confidently resolve; empty-state illustration + text when nothing's pending.

**`/academy-matching`** — two tabs (Reconciliation Queue / Production Ranking); queue rows show a raw academy-name string, its source, a suggested match with similarity %, then Confirm/Reject.

**`/coach-signups`** — read-only list of coaches who named this association at signup (name, email, signup date) — explicitly not an approval queue.

### 5.9 Ops-only pages

**`/ops/associations/new`** — a direct-creation form (bypasses self-serve review): association name, Type toggle (State/District), State select, a "first staff account" email+temp-password pair, a required "I have personally verified a real, signed data-sharing agreement" checkbox, "Create Association" button. *Mobile issue found & still open*: the State `<select>`'s selected value and the temp-password placeholder both visibly truncate at 375px width — widen these fields or wrap the text in the mobile design.

**`/ops/associations/pending`** / **`/ops/scouts/pending`** — near-identical Approve/Reject queues for self-serve signups; each card shows name/org, type/state, submitted staff/contact email, Reject (neutral) + Approve (orange, fixed this session) buttons.

### 5.10 Shared account pages (every role)

**`/profile`** — minimal read-only card: avatar-initials chip, email, role label.

**`/notifications`** — feed of DOB-eligible trial cycles not yet registered for + status of existing registrations; empty state: "Nothing to show right now."

**`/settings`** — "Who can see my profile?" visibility-tier picker (My association only / Any association — radio-style cards), and (added this session) a "Change password" card: current password, new password, confirm, submit.

### 5.11 System pages

**404 (`not-found.tsx`)** — centered compass icon, "Page Not Found" heading, explanatory text, "Back to AthlasX" button. Already on-brand (Anton, orange).

**Error boundary (`error.tsx`)** — catches unhandled exceptions below the root layout; "Try again" + "Back to AthlasX", reports to Sentry.

---

## 6. Known Mobile-Adaptation Issues (fix in the new build, don't port as-is)

From a live 375×812 audit of every page this session, still open at time of writing:

1. **`/auth/reset-password`** — plain sans-serif heading instead of Anton; build it correctly from the start.
2. **Player onboarding's top bar** — logo + "Claim your profile" link + "Stage N of M" crowd together and wrap; needs a dedicated mobile header treatment.
3. **Player onboarding's OTP "Send OTP" button** is an outline/ghost style while Coach/Academy/Scout's identical action is solid-orange-filled — pick one (solid, matching the rest) for the mobile app.
4. **`/ops/associations/new`** — State dropdown value and password-field placeholder truncate at mobile width; size these fields to their content or wrap text.
5. **`/selection`'s candidate cards** don't reflow cleanly at mobile width (cramped, wrapped text); build off `/grading`'s row pattern instead, which handles equivalent data cleanly.
6. **`/association`'s three data tables** (Trial Cycles / Scout Convergence / Tracked Players) are desktop-table-shaped; redesign as stacked cards for mobile, matching the pattern already used successfully on `/coach` and `/academy`.
7. **Player onboarding's "Visibility & Sharing" consent text** states scout visibility "is not currently available to opt into... regardless of what this or any other screen might otherwise suggest" — but Scout is a live, enabled role. This is a copy/content bug to resolve before shipping the mobile app's consent screen, not a design issue.
8. **The dashboard sidebar has no defined mobile pattern yet** (hamburger drawer vs. bottom tab bar vs. something else) — this is the single biggest open design decision for the mobile app, since every authenticated screen depends on it. Given 7 roles with 1–6 nav items each, a **bottom tab bar for the 2–4 most-used items per role + an overflow/"More" sheet for the rest** is likely the better native-mobile pattern than trying to port the desktop left-rail sidebar directly.

Already fixed this session (safe to treat as final/correct for the mobile build): `/dashboard` and `/tracking` headings now use Anton/uppercase; `/claim`'s branding (logo, buttons, focus rings) now matches the orange system; every primary green button/active-toggle on `/trial-cycles`, `/ingest`, `/academy-matching`, `/ops/associations/new`, `/ops/associations/pending`, `/ops/scouts/pending`, `/selection`, and `/convergence` now uses the brand orange instead of green (green is reserved for genuine status indicators only).

---

## 7. Suggested Screen List for Stitch (mobile-first build order)

If generating screens one at a time, this order roughly matches first-time-user → power-user progression and groups shared patterns together:

1. Landing
2. Auth — Sign In
3. Auth — Sign Up (role picker)
4. Auth — Forgot Password
5. Onboarding — Player (all 3 stages as separate screens or one scrollable flow)
6. Onboarding — Coach (4 steps)
7. Onboarding — Academy (3 steps)
8. Onboarding — Scout (2 steps)
9. Onboarding — Association (3 steps)
10. Pending-verification holding screen (shared pattern, scout + association)
11. Claim flow (5 steps)
12. Player home — My Record
13. Player — Profile
14. Player — Settings (incl. Change Password)
15. Player — Notifications
16. Coach home — My Roster
17. Association home — Overview / Command Centre
18. Association — Trial Cycles (list + create-cycle wizard)
19. Association — Ingest & Data
20. Association — Weekly Tracking
21. Association — Identity Exceptions
22. Association — Academy Matching
23. Association — Coach Signups
24. Selection — Candidate Pool
25. Selection — Grading
26. Selection — Convergence
27. Scout — Talent Pool
28. Academy — Dashboard
29. Academy — Players / Batches / Add Players / Join Requests
30. Ops — Create Association / Pending Associations / Pending Scouts
31. 404 / Error states

---

## 8. Quick Reference — Environment & Stack

Next.js 14.2.35 (App Router) · TypeScript · Tailwind (custom `ax-*` tokens above) · Prisma 6 / Postgres (Supabase) · NextAuth (JWT, credentials-only, no OAuth wired) · Framer Motion for transitions · Sentry (installed, no DSN configured) · `sonner` for toasts (used sparingly — mainly `/settings`, `/auth`'s Google-disabled toast).

Feature flags gating entire nav sections (`src/lib/feature-flags.ts`): `ACADEMY_SELF_SERVE_ENABLED` (default **false**), `SCOUT_SELF_SERVE_ENABLED` (default **true**), `ASSOCIATION_SELF_SERVE_ENABLED` (default **true**), `FRANCHISE_SCOUT_ENABLED` (default **true**). If the mobile app should reflect the actual launch state, build the Academy flow but keep it flagged off by default too.
