# Design import mapping — claude.ai/design/p/23f09406-57c6-45eb-b173-d2ceeba715ea

Source: `ATHLASX-handoff.zip`, provided directly by the user (the design MCP is not available in this environment — `/design-login` is not a valid command here, confirmed). All 24 requested files are present under `design/import/` (12 HTML mockups, 11 image assets, 1 JSON). Extras not requested but present in the zip (`build/player-onboarding-src.html`, `uploads/*.docx`, `uploads/*.png|jpg`, `README.md`) are left under `design/import/athlasx/` untouched — not analyzed here, not part of this pass.

**Correction to the prompt's premise:** `docs/99-gaps.md` does not exist in this repo. I verified the actual claim directly instead: `find src/app/(dashboard)/academy` returns nothing — zero pages exist there, confirmed by directory listing, not by citing a doc that isn't there.

---

## Part 1 — Route mapping, per file

### AthlasX Hero.html → `/`
Maps directly to the existing `src/app/page.tsx` → `HeroLanding.tsx` marketing landing page. Single hero section, headline, CTA buttons ("Sign in" / presumably "Get started"), features grid. This is the file already touched in the wordmark-treatment prompt from earlier in this session (that prompt is currently blocked pending this MAPPING.md).

### AthlasX Auth.html → sign-in / sign-up
No direct current-app equivalent as a *dedicated* screen — today, sign-in is NextAuth's built-in `/api/auth/signin` page (`src/lib/auth.ts`'s `CredentialsProvider`, no custom UI), and sign-up doesn't exist as a separate flow at all (`/onboarding` is registration-and-profile combined for players; there is no generic "create an account" screen for other roles). This mockup is a **net-new screen** if adopted — it doesn't replace something broken, it fills a gap where NextAuth's default page currently is.

### AthlasX Onboarding.html, AthlasX Player Onboarding.html, AthlasX Player Onboarding (standalone).html → the `/onboarding` player flow
All three map to `src/app/onboarding/page.tsx` (the 4-step wizard: Identity → Playing Profile → Footage & Bio → Review). These are **three separate mockup files for what is one real screen in the app** — worth deciding which is authoritative before any implementation:
- `AthlasX Onboarding.html` (1048 lines) — largest, likely the full multi-step wizard shell.
- `AthlasX Player Onboarding.html` (540 lines) — a trimmed/scoped version.
- `AthlasX Player Onboarding (standalone).html` (399 lines, but 507KB — has inline base64 asset(s), likely a self-contained single-file export for sharing rather than a distinct design).

I have not picked one as canonical — that's a decision for you, same as the v2/v3 Academy Onboarding question below, since three same-named-purpose files is the same "don't silently pick" situation the prompt calls out explicitly for Academy Onboarding.

### AthlasX Player Profile.html → `/record` and/or `/profile`
Content (score display, career stats — inferred from the file's color roles: `--blue`, `--purple`, `--teal` used for what look like stat categories, plus `--ok`/`--bad` for status) matches `/record`'s `GET /api/my-record` payload shape (score breakdown, summary stats, trend, match log) far more than `/profile`, which today is a near-empty `useSession()`-only page with no fetch at all. **Verdict: this maps to `/record`, not `/profile`.** If adopted, `/profile` stays out of scope for this mockup entirely — it would need its own design, or the two routes may want consolidating, but that's a product decision, not implied by this file.

### AthlasX Player Self-Registration.html → cross-check against `/claim`
This is genuinely the harder call. It uses a **completely different palette** from every other file in the set (light theme: `--bg:#F5F7FA`, `--card:#FFFFFF`, `--ink:#0D1B2A` — the only light-mode file in the whole batch) and its own copy is registration-flavored, not claim-flavored. The actual `/claim` flow (`src/app/claim/page.tsx`) is specifically for a player claiming a **pre-existing shadow profile** created by ingest (search by name+district → OTP → done) — it is not a general-purpose registration form. Based on structure alone (I did not find explicit copy strings distinguishing "claim my existing record" vs. "sign up as new") this mockup reads as **closer to `/onboarding`'s self-registration path than to `/claim`** — but I can't be fully certain without deeper content extraction than a token/color pass gives me. Flagging as **ambiguous, needs your call**, not silently resolved either way.

### AthlasX Academy Onboarding v2.html vs. AthlasX Academy Onboarding v3.html
No version marker, timestamp, or changelog comment exists in either file (checked `<title>`, `<meta>`, and every comment block — nothing). Zip-internal file timestamps are identical (both stamped at export time, not authorship time) — useless as a tiebreaker. Structural diff: v2 has 3 headings (`Facilities`, `Staff`, a completion message); v3 has 4, adding an `<h1>Set up your...</h1>` opening header that v2 lacks. Beyond structure, **the two files are not the same design system at all** — see the reconciliation table below. v2 is built on the "navy admin" palette (`--canvas:#0D1B2A`, Inter font) shared with Academy Admin Dashboard / Add Players / Player Profile. v3 is built on the "dark orange" palette (`--bg:#0D0D0D`, Anton/Barlow fonts) shared with Hero / Auth / Onboarding / Coach Onboarding / Player Onboarding.

**I am treating v3 as canonical**, on two grounds stated explicitly rather than assumed: (1) the filename ordering itself (v3 numerically supersedes v2, and nothing contradicts that), and (2) v3's design system is the one shared by 6 of the other 11 mockup files, including the two other onboarding flows (player, coach) — v2 is the outlier, aligned instead with the 4 "admin/dashboard" files. If v2 is actually the intended direction (e.g., if the admin palette is meant to become the standard), that changes which palette this whole import reconciles against — **tell me if that's the case before I treat v3's palette as the batch's default.**

### AthlasX Academy Admin Dashboard.html → the missing academy_admin frontend
Confirmed: this is the first design asset for a page that has zero implementation today (`src/app/(dashboard)/academy/**` doesn't exist — verified by direct directory listing). Note this sits squarely inside the still-open strategic question from an earlier memo in this session: the pivot document's §4.4 explicitly excludes academy sales from phase 1 and has no `academy_admin` role in its role table, while the backend (`AcademyBatch`, `AcademyBatchMembership`, `AcademyJoinRequest`, `AcademyAttendanceFlag`, the API routes) already exists. This mockup is more fuel for that same unresolved decision — implementing it doesn't answer whether it should exist yet.

### AthlasX Add Players.html → new manual single-player-add screen
Distinct from `/ingest`, confirmed — `/ingest`'s three cards are CricHeroes sync (bulk, hardcoded fixture), Excel/CSV bulk upload, and a display-only Scorecard PDFs card. Nothing in the current `/ingest` page or its API routes (`POST /api/ingest`, sourceKeys `api_sync`/`excel_mapper`/`structured_parser`) supports adding one player by hand. This mockup is a **genuinely new screen and a new API surface** if implemented (no existing route to point it at — `/api/academy/players` exists but is `academy_admin`-scoped, not association-staff-scoped; would need a new association-facing single-player-create route, or confirmation that reusing the academy one is intended).

### AthlasX Coach Onboarding.html → coach self-serve onboarding
Confirmed net-new. `docs/AthlasX_Design_Consistency_and_Page_Flow_Map.md` and this session's own history confirm coach accounts are currently seeded (`prisma/seed.ts`), not self-registered — there is no `/onboarding/coach` or equivalent route, no coach-facing signup API. Same category as Auth.html: implementing this means building the backend path alongside it, not just the page.

### onboarding_text.json — **not copy/microcopy for these screens**
This is the load-bearing correction for this whole mapping pass. I opened the file expecting UI strings; it is instead **schema/flow reference documentation** (matching the `.docx` uploads also in the zip: `AthlasX_Player_Onboarding.docx`, `AthlasX_Coach_Onboarding.docx`, `AthlasX_Academy_Onboarding.docx`, `AthlasX_Scout_Onboarding.docx`), with four top-level keys (`AthlasX_Player_Onboarding`, `AthlasX_Coach_Onboarding`, `AthlasX_Academy_Onboarding`, `AthlasX_Scout_Onboarding`), each an array of prose paragraphs and schema tables describing a **9-step player wizard against tables like `player_profiles`, `player_media`, `player_consents`, `aadhaar_verification`**, routes like `/api/player/profile/submit`, `/dashboard/player`, and a component path `app/onboarding/player/PlayerProfileWizard.tsx`.

None of that exists in the current codebase. No `player_profiles` table (current schema is Prisma's `PlayerProfile`, different fields entirely, no `academy_id` FK), no Aadhaar OTP flow in this shape, no `/dashboard/player` route, no `PlayerProfileWizard.tsx`. This reads as documentation for the **pre-pivot SportX app** — the same lineage as the archived `Old_SportX_Files_Initial/` directory deleted earlier this session (which had its own `lib/aadhaar.ts`, `app/onboarding/player/...` structure, `/dashboard/player`). It also documents a **Scout Onboarding** flow, and the current pivot document explicitly has no scout role in phase 1 — another signal this is stale planning material, not current copy.

**Practical implication:** `onboarding_text.json` should not be used as a copy source for implementing any of the 12 HTML mockups. If genuine microcopy for those screens exists, it lives in the HTML files' own text nodes, not in this JSON.

---

## Part 2 — Literal design tokens found (no summarizing, real values)

### Two distinct palettes across the 12 files — not one theme

**System A — "dark orange"** (Hero, Auth, Onboarding, Player Onboarding, Player Onboarding standalone, Coach Onboarding, Academy Onboarding v3):
```
--bg: #0D0D0D
--bg-soft: #141312
--text: #F5F5F0
--text-dim: rgba(245,245,240,0.62)
--text-faint: rgba(245,245,240,0.4)
--accent: #FF8A1E
--accent-bright: #FFA64D
--accent-rgb: 255,138,30
--card-bg: rgba(13,13,13,0.55)
--card-border: rgba(245,245,240,0.14)
--field-bg: rgba(245,245,240,0.06)
--ok: #38d39f
--bad: #ff5a4d
--ov08 / --ov14 / --ov22: rgba(255,138,30, 0.08/0.14/0.22)
--overlay-accent-08/14/22: rgba(var(--accent-rgb), 0.08/0.14/0.22)
--seam: rgba(13,13,13,0.9)
--ease: cubic-bezier(0.22,1,0.36,1)
--phi: 1.618   --phi2: 2.618rem
--gap: 3px
Fonts: "Anton" (display), "Barlow Semi Condensed", "Barlow", system-ui fallback
```

**System B — "navy admin"** (Academy Admin Dashboard, Add Players, Player Profile, Academy Onboarding v2):
```
--canvas: #0D1B2A
--canvas-soft: #122436
--panel: #0F2033  (Player Profile uses #14202E for --panel instead)
--panel-2: #152C42
--line: #1E3245
--text: #F5F5F0
--accent: #FF8A1E          ← same hex as System A
--accent-bright: #FFA64D   ← same hex as System A
--accent-rgb: 255,138,30   ← same as System A
--bad: #FF5A4D (Academy Admin Dashboard) / #FF4D4F (Academy Onboarding v2, Add Players' --bad-rgb: 255,90,77 matches #FF5A4D not #FF4D4F — inconsistent even within System B)
--ok: #22C55E
--blue: #4C8DFF   --purple: #B57BFF   --teal: #2DD4BF   --grey: #5B6B7A  (Player Profile, Academy Admin Dashboard only)
--mono: "JetBrains Mono", ui-monospace, monospace
Font: "Inter", system-ui, sans-serif (400/500/600/700/800 weights loaded)
```

**System C — light theme, one file only** (Player Self-Registration):
```
--bg: #F5F7FA
--card: #FFFFFF
--ink: #0D1B2A
--ink-dim: #5B6B7A
--ink-faint: #9AA7B2
--line: #E4E8EC
--accent: #FF8A1E   --accent-bright: #E67812 (different bright-variant from both other systems)
--bad: #FF4D4F
--wa: #25D366 (WhatsApp-brand green, presumably a "share via WhatsApp" affordance)
Font: "Inter", system-ui, sans-serif
```

### Corner radius — messy even within the mockups themselves
Every file defines its own `--radius` and radius-adjacent values inline; no shared scale across files, and no file uses a clean 2/4/8-style progression. Raw `border-radius` values found across the batch: `2px, 3px, 4px, 5px, 6px, 7px, 8px, 9px, 10px, 11px, 12px, 16px, 999px` (999px = pill/circle). Academy Onboarding v2 alone defines `--radius: 2px` yet also uses literal `10px`/`12px` elsewhere in the same file — the variable is not consistently applied even inside one mockup.

### `--focus` — an odd one
Auth.html and Hero.html both define multiple `--focus` declarations with different values in the same file (`46% 30%`, `50% 22%`, `50% 28%`, `50% 30%`, `50% 42%`) — almost certainly per-section radial-gradient focus-point overrides (background image positioning), not a real design token. Flagging so it isn't mistaken for something meaningful during reconciliation.

---

## Part 3 — Reconciliation against the live app's tokens

Per `src/app/globals.css` and §2 of `docs/AthlasX_Design_Consistency_and_Page_Flow_Map.md`:
```css
:root { --ax-bg: #050505; --ax-green: #22c55e; }
```
Plus: `.glass`/`.glass-card`/`.glass-dark` (used on 18/19 pages), `tailwind.config.ts`'s `theme.extend` is empty, and three inconsistent button treatments already exist live.

| Mockup value | Value | Live app token | Relationship |
|---|---|---|---|
| System A `--bg` | `#0D0D0D` | `--ax-bg: #050505` | **Close but different.** Both near-black, not identical — `#0D0D0D` is measurably lighter. |
| System B `--canvas` | `#0D1B2A` | `--ax-bg: #050505` | **Genuinely new.** Not a near-black at all — this is a dark navy blue, a different hue entirely, not a lighting variant of `--ax-bg`. |
| System C `--bg` | `#F5F7FA` | `--ax-bg: #050505` | **Genuinely new** — inverse (light theme). The live app has no light-mode token at all. |
| Any system's `--accent` (`#FF8A1E`) | `#FF8A1E` | `--ax-green: #22c55e` | **Genuinely new.** The live app's only accent is green; every mockup's primary accent is orange. This is the single biggest reconciliation question — adopting any of these mockups as-is means introducing a second brand color, not matching the existing one. |
| System A/B `--ok` (`#38d39f` / `#22C55E`) | System B's `#22C55E` | `--ax-green: #22c55e` | **Same value**, System B only. System A's `#38d39f` is close-but-different (a teal-leaning green, not identical). |
| System A/C `--bad` (`#ff5a4d` / `#FF4D4F`) | *(no live equivalent)* | none | **Genuinely new** — the live app has no error/negative token at all; error states are presumably hand-typed red per the same pattern §2.1 already documents for other accent colors. |
| Radius values (2–16px, 999px) | mixed | `.glass-card`'s `border-radius: 1rem` (16px); Tailwind's `rounded-xl`(12px)/`rounded-lg`(8px)/`rounded-2xl`(16px)/`rounded-full` convention (§2.4) | **Mixed.** `8px`≈`rounded-lg`, `12px`≈`rounded-xl`, `16px`≈`rounded-2xl`/`.glass-card` — those three sizes land on existing de-facto tiers. The rest (2,3,4,5,6,7,9,10,11px) are **genuinely new**, finer-grained than anything the live app currently uses, and would either need rounding to the nearest existing tier or would expand the radius scale. |
| `.glass`/`.glass-card` translucency system | `rgba(255,255,255,0.025–0.06)` + `backdrop-filter: blur()` | same pattern, defined once, used on 18/19 pages | Mockups' `--card-bg: rgba(13,13,13,0.55)` (System A) and `--field-bg: rgba(245,245,240,0.06)` are **close in spirit but not the same values** — none of the mockups literally reuse `rgba(255,255,255,0.025)` etc. |
| Font family | Anton/Barlow (System A), Inter (System B/C) | Not specified in `globals.css` at all — no `font-family` declared globally, Tailwind/Next default | **Genuinely new** on all counts — the live app currently has no explicit brand font; adopting any mockup's font choice is a first-time decision, not a reconciliation. |
| Tailwind `theme.extend` | — | `{}` (empty) | N/A — confirms none of the above are captured anywhere in config today, so every value above is a "would need to be added" regardless of which system wins. |

**Headline finding:** there is no clean "close match, just formalize it" story here. The mockups' core identity (orange accent, near-black-but-not-`#050505` background in System A, navy in System B, light in System C) genuinely diverges from the two tokens the live app has. Reconciling this is a real design decision (which system, if any, becomes canonical; whether orange replaces or supplements green) — not a mechanical token-copy exercise. Not touching `tailwind.config.ts` or `globals.css`, as instructed.

---

## Open decisions before implementation proceeds
1. Which of the three player-onboarding mockups (`Onboarding`, `Player Onboarding`, `Player Onboarding (standalone)`) is authoritative for `/onboarding`?
2. Is `Player Self-Registration` a variant of `/claim`, a variant of `/onboarding`, or a genuinely third flow?
3. Confirmed: treating **Academy Onboarding v3** as canonical over v2 — say so now if that's wrong, since v2's palette is the same one shared by 4 other admin-facing files.
4. Which palette (System A "dark orange," System B "navy admin," or neither) becomes the actual design-token direction — this gates every subsequent visual implementation prompt.
5. `onboarding_text.json` is stale pre-pivot documentation, not usable as copy source — confirm you agree before it's discarded from consideration.
