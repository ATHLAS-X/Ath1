# AthlasX — Full Page Inventory, Button-Level Behavior, and Design-Rollout Prompts

_Verified directly against the live repo (`git log`, `grep`, and the literal mockup HTML in `design/import/`) on 2026-09-06, after commit `0d19f74`. Confidence tags: [Certain] = read directly off code/HTML, [Likely] = strong inference, [Guessing] = filling a gap the evidence doesn't answer._

## 0. The headline finding — read this before the inventory

[Certain] The design rollout is now **inconsistent in a new way**, not just an old way. Commit `0d19f74` restyled exactly two pages — `/` and `/auth` — to the mockups' orange/Anton-Barlow palette, and did it deliberately scoped (local CSS vars, not touched in `globals.css` or `tailwind.config.ts`). Every onboarding wizard that a signing-up user lands on *immediately after* `/auth` — `/player/onboarding`, `/coach/onboarding`, `/onboarding/association`, `/academy/onboarding` — still carries an explicit code comment saying it uses "the app's existing tokens (`glass-card`, `--ax-green`)... not the mockup's orange/Anton palette." That's not a leftover oversight; it was a documented, deliberate choice each time. But it means today's actual click-path is: black-and-orange landing → black-and-orange sign-up → **green glass-card wizard**. That's the exact "static, disconnected pages" failure mode you told me not to build, now present in the one flow the mockups were most specific about (auth → role → onboarding). This is worth fixing before anything else in this document, and §5 gives you the prompts to do it in the same file-scoped style as the Hero/Auth restyle.

[Certain] Separately: the mockup MAPPING.md's earlier "verdict" that `Player Profile.html` maps to `/record` was a guess made from color tokens alone, before the file's actual text was readable. Now that the full text is in hand, it's wrong. `Player Profile.html` shows `Message Parent`, `Add Note`, `Add to Selection List`, a `Coach:` field, and academy/guardian metadata — this is a **third-party (coach/academy-admin) view of a player**, not the player's own self-view that `/record` is. It's also the exact screen the Academy Admin Dashboard mockup opens when you click a row in its player list (the dashboard's own extracted text literally reads `Players | 184 | Player Detail`). So `Player Profile.html` isn't a `/record` restyle at all — it's a new page that belongs to the not-yet-built academy admin surface. §4 corrects this.

### 0.1 Two corrections against the screenshots you just sent

[Certain] The `PLAYER / COACH / ACADEMY / SCOUT` pill row across the top of the academy and coach screenshots is the mockup file's own internal demo switcher — `Onboarding.html`'s single-file `ROLE_FLOWS` engine drives all four role wizards off one HTML file, and that top bar is how someone previewing the mockup jumps between them. It is not a feature real users get. Shipping it on the live site would let a signed-up player flip over to the academy wizard mid-onboarding, which has no product meaning. I'm building the visual language from these screenshots (rail, typography, card/field/button treatment, colors) and dropping that switcher — say so now if you actually want a role-switcher in the live product, because that's a different, new feature, not a restyle.

[Certain] The third screenshot ("BUILD YOUR PROFILE", 3 steps: About You / Cricket Profile / Join Academy, WhatsApp OTP on step 1) is `AthlasX Player Onboarding.html` — the **non-canonical** player mockup. The live `/player/onboarding` page's own header comment explicitly chose the *other* file, `Onboarding.html` (Aadhaar-based), "as canonical over the other two same-purpose mockups." I'm treating this screenshot as visual reference only — palette, rail style, card treatment — not as a request to switch `/player/onboarding`'s content back to WhatsApp-OTP-only, drop Aadhaar, or end in "Join Academy." If you actually want the canonical decision reopened, that's a real product conversation (Aadhaar vs. WhatsApp identity verification, DPDP consent implications), not something to fold into a styling prompt.

## 1. Full page inventory

| Route | Status | Mockup source | Current palette |
|---|---|---|---|
| `/` | Built, restyled `0d19f74` | Hero.html | Orange/Anton (scoped) |
| `/auth` | Built, restyled `0d19f74` | Auth.html | Orange/Anton (scoped) |
| `/player/onboarding` (player) | Built `18c953e` | Onboarding.html (chosen canonical over 2 other player mockups) | Green/glass — **not restyled** |
| `/coach/onboarding` | Built `fd084df` | Coach Onboarding.html | Green/glass — **not restyled** |
| `/onboarding/association` | Built `812e6f7` | No dedicated mockup assigned | Green/glass (matches the rest of the app, not any mockup) |
| `/academy/onboarding` | Built `b483f87` | Academy Onboarding v3.html (v3 confirmed canonical over v2) | Green/glass — **not restyled** |
| `/claim` | Built (pre-existing) | Not mapped to any of the 11 mockups — see §4 | Green/glass, shared `Button`/`Input` components |
| `/record` | Built (pre-existing) | Not mapped to any mockup (see §0 correction) | Green/glass |
| `/profile` | Built (pre-existing, minimal) | Not mapped to any mockup | Green/glass |
| `/dashboard`, `/trial-cycles`(+`[id]/register`,`[id]/dossiers`), `/ingest`, `/identity-exceptions`, `/academy-matching`, `/selection`, `/grading`, `/convergence`, `/tracking`, `/coach`, `/notifications`, `/settings` | Built, live, backend-wired | Not in the 11-mockup set at all | Green/glass |
| Academy admin roster console | **Not built** | Academy Admin Dashboard.html | — |
| Add players to an academy | **Not built** | Add Players.html | — |
| Parent registers child via academy invite link | **Not built** | Player Self-Registration.html | — |
| Coach/admin player-detail view | **Not built** | Player Profile.html (see §0 correction — this is not `/record`) | — |

## 2. Button-level behavior — Auth funnel (built, restyled)

### `/` — Hero landing
- **Log In** (top-right bar) → `router.push`/link to `/auth` (sign-in mode)
- **Sign In** (top-right bar) → `/auth` (sign-in mode)
- Any "Get started"-style CTA in the features section → `/auth` (sign-up mode)
- No fetches; server component, reads session only. Signed-in visitors are redirected server-side by `rootDestination(session)` before this page ever renders content to them: `player → /record`, `coach → /coach`, `association`/`athlasx_ops → /dashboard`, `selection_panel → /selection`.

### `/auth` — sign-in / sign-up
- **Sign In / Sign Up** tab toggle → local state only, swaps the form beneath, no navigation
- **Sign In submit** → NextAuth `CredentialsProvider`; on success, role-based redirect via the same `rootDestination` map above
- **Forgot password** → `toast.info('Password reset isn't wired up yet.')` — intentionally inert, not a bug
- **Role picker** (sign-up mode, 5 cards: Player / Association / Academy / Coach / Scout) → on click:
  - Player → `router.push('/player/onboarding')`
  - Academy → `router.push('/academy/onboarding')`
  - Coach → `router.push('/coach/onboarding')`
  - Association → `router.push('/onboarding/association')`
  - Scout → disabled card, shows inline copy that scout accounts aren't supported yet (`FRANCHISE_SCOUT_ENABLED` is `false`, no `scout` value in `UserRole` — this is a deliberate product gate, not a missing button)
- **Continue with Google** → `toast.info('Google sign-in isn't connected yet.')` — no OAuth provider configured, intentionally inert
- **Toggle link** ("Don't have an account? Sign up") → flips `mode` state, no navigation

## 3. Button-level behavior — Onboarding wizards (built, not restyled)

### `/player/onboarding` — player, 3 stages
- Stage 1 (basic details) **Continue** → validates required fields client-side, advances to Stage 2
- Stage 2 (Aadhaar) **Send OTP** → calls the stubbed `src/lib/aadhaar-verification.ts` adapter, reveals an OTP field; **Verify** → marks `aadhaar_verification_status: verified`; if `isUnder18(dob)`, a second independent guardian Aadhaar block repeats the same send/verify pair before **Continue** unlocks
- Stage 3 (footage/bio + consents) — four consent panels (`profile_visibility_ok`, `media_upload_ok`, `scout_contact_ok`, `data_usage_ok`), each individually briefed; **Accept** on a panel is disabled until that panel's text has actually been scrolled to its end (scroll-gated, not just displayed); **Submit Registration** → `POST /api/player/onboard` → on success `router.push('/record')`
- **Cancel** (any stage) → `/`
- **"Already have a profile?"** escape hatch → `/claim`

### `/coach/onboarding`
- Multi-step wizard; final step is an **Association picker** (confirmed swap for the mockup's "join an academy" UI — `CoachProfile.association_id` is required/non-nullable with no academy relation, and `squad-access.ts` was checked directly and doesn't reference `CoachProfile` at all, so this swap carries no access-control risk)
- Submission → `POST /api/coach/onboard` (+ `send-otp`/`associations` sub-routes) → account is immediately usable with a "pending" certification badge; certification review (24-48h) is async and non-blocking, not a gate
- No self-assigned squad anywhere in this flow — squad membership happens later via `SquadCoach` rows created elsewhere

### `/onboarding/association`
- No dedicated mockup was assigned to this route (MAPPING.md confirms), so it follows `/player/onboarding`'s own step-gated-Continue pattern instead of any mockup's visual layout
- Final submit → `POST /api/associations/onboard` → creates the `Association` row and its first `AssociationStaff` member (previously this only existed via seeded/manual inserts)

### `/academy/onboarding`
- 5 steps, same fields/copy/order as Academy Onboarding v3.html, with two confirmed deviations: Step 1 adds email+password alongside the mockup's phone+OTP-only content (phone-only auth has no sign-in path anywhere else in the codebase), and Steps 3-4 (Facilities & Staff, Programs) are collected here even though the mockup's copy suggests they could be deferred
- Submit → `POST /api/academy/onboard` (+ `send-otp`)

## 4. Button-level behavior — the three not-built mockups that are actually one feature

These three files aren't three separate asks — they're one coherent "academy roster onboarding" loop, confirmed by literal shared content (the invite link `https://athlasx.app/join/kca-8f21x` is *generated* in one mockup and *landed on* in another):

### Add Players.html — academy-admin-facing, 3 tabs
- **Tab 1, CSV Upload**: drop-zone or click-to-browse → client-side parse → row-level error table ("2 errors found") → **Upload all valid rows** (skips error rows) or **Cancel**; **Download CSV Template** is a static file link
- **Tab 2, Manual Entry**: single-player form (name, DOB, gender, role, batting/bowling style, state, city, batch assignment); DOB-driven minor branch reveals Guardian Name/Phone + **Send OTP**; **Add Player** submits and presumably returns to the roster; **Continue adding** submits but clears the form and stays on the page instead
- **Tab 3, QR/WhatsApp Invite**: generates a per-academy join link + QR code; **Copy Link**, **Share via WhatsApp** (pre-filled message), **Download PNG**, **Print**; copy explicitly states "Players who join via this link will enter an approval queue. You'll receive a notification to approve them." — this is the direct handoff into Player Self-Registration.html below

### Player Self-Registration.html — parent-facing, reached via the invite link above
- Actual title is "Register Your Child" — this is a **guardian registering a minor**, not a player self-registering and not a `/claim` search flow. Header copy reads "`{Academy Name}` has invited you to register your child on AthlasX."
- Single-page form: player name/DOB/gender/role/batting-style/state, then a guardian block (name, relationship, mobile) with **Send OTP** → **Enter OTP**, one consent checkbox ("I consent to AthlasX collecting and storing my child's cricket performance data" + a **View terms** link), then **Submit Registration**
- Submit → confirmation screen: "Your registration is pending approval — the academy admin will review and add your child to the roster. You'll receive a WhatsApp message when approved." → this pending state is what Academy Admin Dashboard's "Pending Actions: 7 (3 overdue reviews)" tile counts

### Academy Admin Dashboard.html — the console that ties both of the above together
- Nav: Dashboard / Players / Coaches / Sessions / Attendance / Reports / Settings
- KPI tiles: Total Players, Active Batches, Today's Attendance %, **Pending Actions** (the approval queue fed by Player Self-Registration submissions)
- Activity feed (read-only log)
- **Players** list → row click → opens **Player Detail**, which is `Player Profile.html` (see §0) — `Add Note`, `Edit Profile`, `Message Parent`, `Add to Selection List` all live on that detail view, not on the list

**This whole feature is blocked on one unresolved decision, not on missing code paths**: the pivot document's §4.4 excludes academy sales from phase 1 and has no `academy_admin` in its role table, while the schema (`AcademyBatch`, `AcademyBatchMembership`, `AcademyJoinRequest`, `AcademyAttendanceFlag`) and API routes already exist for it. Building any of these three screens without that call being made first just re-creates the same "backend exists, nobody decided if the frontend should" situation that was already flagged once. **I'm not picking a side and quietly building it — that decision needs to come from you before Prompt 6 below gets used.**

## 5. Claude Code prompts

You asked for the site to be consistent *and persistent*. Per-page inline CSS variables (what Prompts 1-4 originally called for, matching how Hero/Auth were done) satisfy "consistent" but actively work against "persistent" — 18+ files each redefining the same orange tokens is exactly the "no shared button component, no config-level guardrail" problem already documented in `docs/AthlasX_Design_Consistency_and_Page_Flow_Map.md` (three different green "confirm" button styles, `tailwind.config.ts`'s `theme.extend` empty, `--ax-green` hand-typed 15+ times). That earlier document's own §5 recommendation was to fix this with real shared components once there was a reason to touch every page — you just gave the reason. So Prompt 0 below is new: it registers the orange/black system as real Tailwind tokens and shared components once, and every prompt after it consumes that instead of redefining it. This reverses the "don't touch `globals.css`/`tailwind.config.ts`" instruction the earlier Hero/Auth restyle followed — that instruction made sense when only 2 pages were changing; it stops making sense once you want all ~19.

Run these in order. Prompt 0 is infrastructure and has no visible effect on its own until later prompts consume it. Prompts 1-4 and 7-10 are pure restyles — zero behavior change, only presentation and the token source. Prompt 5 and 6 are unchanged from before: report-only, decision-gated.

---

### Prompt 0 — register the orange/black design system globally, build shared primitives

```
Register a real, global design system for the orange/black visual
language already used on / and /auth (commit 0d19f74), so every future
page consumes shared tokens and components instead of redefining them
inline. This supersedes the "keep it scoped to this file, don't touch
globals.css/tailwind.config.ts" approach used for the / and /auth restyle
— that was right for a 2-page change, not for a site-wide one.

1. tailwind.config.ts: add the palette to theme.extend.colors under an
   `ax` namespace — bg (#0D0D0D), bgSoft, text, textDim, textFaint,
   accent (#FF8A1E), accentBright (#FFA64D), ok, bad, cardBorder,
   fieldBg — read the exact values from design/import/AthlasX Onboarding.html's
   :root block, don't invent new ones. Add a matching radius scale if the
   mockups' values don't already land on Tailwind's defaults.

2. globals.css: replace --ax-bg (#050505) and --ax-green (#22c55e) with
   the new orange system as the site's real tokens. Anton + Barlow +
   Barlow Semi Condensed via next/font/google, loaded once at the root
   layout (src/app/layout.tsx) instead of per-page, exposed as CSS
   variables the way Tailwind's font-family config expects.

3. New shared components in src/components/ui/: 
   - Button: add a primary/secondary/outline variant set styled to the
     mockups' button treatment, replacing the ad-hoc raw <button> styling
     currently duplicated across 13 dashboard files (documented in
     docs/AthlasX_Design_Consistency_and_Page_Flow_Map.md §2.2 — 34 raw
     <button> elements, 3 different "confirm" treatments).
   - Card / GlassCard: one card treatment replacing .glass/.glass-card/
     .glass-dark, restyled to the orange system's card-bg/border values.
   - StepRail: a shared multi-step wizard rail component — numbered
     circle per step, orange ring on the current step, a checkmark and
     muted-orange fill on completed steps, a connecting vertical line, an
     optional sublabel under each step title, and a small "All progress
     saved automatically" footer row with a status dot. This is the rail
     shown in every onboarding mockup screenshot. Take props for
     step list, current index, and completed indices — don't hardcode
     step count, since the four onboarding wizards have different counts
     (3, 4, unspecified, 5).

Do NOT build the top PLAYER/COACH/ACADEMY/SCOUT pill-row switcher visible
in the mockup screenshots — that's the mockup file's own internal preview
switcher for its ROLE_FLOWS engine, not a feature for signed-up users to
use. Confirm you're leaving it out in your summary.

Do not touch any page.tsx in this prompt — this is tokens and components
only, nothing consumes them yet. Verify tsc/lint pass and that the app
still builds and boots with no visual regression on / or /auth (they
should look unchanged, since their own local tokens still take
precedence until a later prompt migrates them).
```

### Prompt 1 — restyle `/player/onboarding` (player) onto the shared system, keeping the 3-stage structure, with real resume

_Confirmed with the user directly: stay on 3 stages (not the mockup's literal 9). Run Prompt 0 first._

```
Restyle src/app/player/onboarding/page.tsx (player onboarding) using the shared
Button/Card/StepRail components and ax.* tokens from Prompt 0, instead of
any page-local styling. Keep the existing 3-stage structure exactly as it
is; do not split, merge, or reorder any fields, and do not change the
Aadhaar send/verify logic, the isUnder18 guardian branch, the four
consent keys, or their scroll-gating logic.

Use StepRail with 3 items labeled by what each stage actually contains
today (e.g. "Basic Info", "Aadhaar Verification", "Footage, Bio &
Consent"). Restyle field inputs, buttons, and the four consent panels
using the shared components — no more hand-rolled button/card markup on
this page.

Add real "leave and resume anytime" behavior using localStorage only (no
backend draft model, no schema change, no db push — none of that is
authorized): on every successful stage-advance, write the accumulated
form state to a namespaced localStorage key (athlasx.onboarding.player.v1);
on page mount, if that key exists, restore the form state and jump to the
furthest-completed stage instead of stage 1; clear the key on successful
POST /api/player/onboard. State plainly in your summary that this is
single-browser resume only, not cross-device, and why.

Do not change the POST /api/player/onboard payload shape or anything in
src/lib/aadhaar-verification.ts. Verify with npx tsc --noEmit,
npm run lint, and a full manual click-through of all 3 stages (including
the guardian Aadhaar branch and all four consent panels), including an
actual browser-refresh mid-wizard to confirm resume works.
```

### Prompt 2 — restyle `/coach/onboarding` onto the shared system, with real resume

```
Restyle src/app/coach/onboarding/page.tsx using the shared Button/Card/
StepRail components and ax.* tokens from Prompt 0 (run Prompt 0 first).
Do not touch the Association-picker step, the certification "pending"
badge logic, the send-otp/associations calls, POST /api/coach/onboard, or
the step count/order.

design/import/AthlasX Coach Onboarding.html's own copy promises "All
progress saved automatically" (visible at the bottom of the mockup) —
add the same localStorage-based resume pattern as Prompt 1
(athlasx.onboarding.coach.v1), clearing it on successful submission.

Presentation and resume only — flag any behavior-implying visual
difference instead of silently changing behavior. Verify with tsc, lint,
and a full click-through of every step including a mid-wizard refresh.
```

### Prompt 3 — restyle `/onboarding/association` onto the shared system, with real resume

```
Restyle src/app/onboarding/association/page.tsx using the shared Button/
Card/StepRail components and ax.* tokens from Prompt 0 (there is no
dedicated mockup for this route — MAPPING.md confirmed that — so match
the shared visual language rather than any specific mockup file). Do not
change the step structure or the POST /api/associations/onboard call.

Add the same localStorage-based resume pattern as Prompts 1-2
(athlasx.onboarding.association.v1) for consistency with the other three
onboarding wizards, clearing it on successful submission.

Presentation and resume only. Verify with tsc, lint, and a full
click-through including a mid-wizard refresh.
```

### Prompt 4 — restyle `/academy/onboarding` onto the shared system, with real resume

```
Restyle src/app/academy/onboarding/page.tsx using the shared Button/Card/
StepRail components and ax.* tokens from Prompt 0 (run Prompt 0 first;
match design/import/AthlasX Academy Onboarding v3.html — v3, not v2,
already confirmed canonical). Do not change the 5-step structure, the
email+password addition in Step 1, Steps 3-4's field collection, or the
POST /api/academy/onboard call.

The mockup's own copy promises "Everything auto-saves" (visible under the
step count) — add the same localStorage-based resume pattern as Prompts
1-3 (athlasx.onboarding.academy.v1), clearing it on successful
submission.

Presentation and resume only. Verify with tsc, lint, and a full
click-through of all 5 steps including a mid-wizard refresh.
```

### Prompt 5 — `/record` and `/profile`: report only, do not restyle yet

```
Do not write any code in this prompt. I need a decision made first.

design/import/AthlasX Player Profile.html turned out NOT to be a mockup
for /record — its content (Message Parent, Add Note, Add to Selection
List, a Coach: field, guardian consent status) is a coach/academy-admin
view of a player, not the player's own self-view. It's the "Player
Detail" screen opened from Academy Admin Dashboard.html's player list.

Confirm this reading by re-reading design/import/AthlasX Player
Profile.html and design/import/AthlasX Academy Admin Dashboard.html
yourself, then report back:
1. Do you agree Player Profile.html belongs to the not-yet-built academy
   admin surface, not to /record or /profile?
2. If so, /record and /profile currently have no assigned mockup at all
   in this batch. Say that plainly rather than restyling either page
   against a mockup that doesn't actually describe them.

Do not restyle, rename, or move any file. This is a verification-and-report
prompt only.
```

### Prompt 6 — the academy roster feature: decision-gated, no code yet

```
Do not write any code in this prompt.

design/import/AthlasX Add Players.html, AthlasX Player Self-Registration.html,
and AthlasX Academy Admin Dashboard.html are one feature, not three: Add
Players' "QR/WhatsApp Invite" tab generates a join link
(https://athlasx.app/join/{code}); Player Self-Registration.html is the
parent-facing landing page for that link ("Register Your Child", guardian
OTP, one consent checkbox, ends in "pending approval"); Academy Admin
Dashboard.html's "Pending Actions" tile and player list are where those
approvals land, and its player-list row click opens Player Profile.html
as a detail view.

This entire feature has zero implementation today (confirm via
find src/app/\(dashboard\)/academy — should return nothing) even though
the backend it needs already exists (AcademyBatch, AcademyBatchMembership,
AcademyJoinRequest, AcademyAttendanceFlag models and their API routes).

Report back, do not decide unilaterally: the pivot document's academy
section excludes academy administration from phase 1 and has no
academy_admin role in its role table. Building this feature means either
(a) the pivot document's phase-1 scope was already superseded by this
design work and should be updated to say so, or (b) this feature should
stay unbuilt until a phase decision is made. Lay out both options with
what each would take, and stop there.
```

---

## 6. Discard-green rollout — the 14 live dashboard/account pages

None of these have a mockup — they're not in the 11-file design import at all. "Discard the green, make it orange/black, keep it consistent" for these means: consume Prompt 0's shared Button/Card/token system, same as the onboarding wizards, since there's no dedicated visual spec to match against otherwise.

This is 14 pages, all live, all backend-wired, several covered by the existing 118-test suite. Running this as one prompt produces an unreviewable diff and makes it hard to tell a real regression from a style change. Split by the same functional grouping `NAV_SECTIONS` already uses, so each prompt's blast radius matches one sidebar section:

### Prompt 7 — Association/Ops pages

```
Restyle these pages onto the shared Button/Card/ax.* tokens from Prompt 0
(run Prompt 0 first), replacing every green/glass literal
(--ax-green, #22c55e, .glass/.glass-card/.glass-dark, and any hand-typed
hex accent color) with the orange/black system:
- src/app/(dashboard)/dashboard/page.tsx
- src/app/(dashboard)/trial-cycles/page.tsx and its [id]/register,
  [id]/dossiers client components
- src/app/(dashboard)/ingest/page.tsx
- src/app/(dashboard)/identity-exceptions/page.tsx
- src/app/(dashboard)/academy-matching/page.tsx

Zero behavior change: every fetch, every onClick handler, every
conditional render stays exactly as it is — only classNames/inline
styles/color literals change, and raw <button> elements get replaced
with the shared Button component (consolidating the three different
"confirm" button treatments documented in
docs/AthlasX_Design_Consistency_and_Page_Flow_Map.md §1 finding 2 into
one). Recharts inline color props (KPI accents, chart strokes) move to
the ax.* palette equivalents rather than stay hand-typed hex.

Verify: npx tsc --noEmit, npm run lint, npm test (the existing suite —
these routes have real coverage, a red test here means a real
regression, not a style nitpick), and a manual click-through of every
button/link on each page against the button-level behavior already
documented for these pages.
```

### Prompt 8 — Selection/Grading pages

```
Same rules as Prompt 7 (shared components from Prompt 0, zero behavior
change, replace every green/glass/hand-typed-hex literal, verify with
tsc/lint/npm test/click-through), applied to:
- src/app/(dashboard)/selection/page.tsx
- src/app/(dashboard)/grading/page.tsx
- src/app/(dashboard)/convergence/page.tsx

Do not fix the dead-click bug on /selection's candidate rows (documented
separately in docs/AthlasX_Design_Consistency_and_Page_Flow_Map.md §1
finding 1) as part of this restyle — that's a behavior change and belongs
in its own prompt, not bundled into a styling pass.
```

### Prompt 9 — Season/Coach pages

```
Same rules as Prompt 7, applied to:
- src/app/(dashboard)/tracking/page.tsx
- src/app/(dashboard)/coach/page.tsx
```

### Prompt 10 — Player/Account pages

```
Same rules as Prompt 7, applied to:
- src/app/(dashboard)/notifications/page.tsx
- src/app/(dashboard)/settings/page.tsx
- src/app/claim/page.tsx (already uses the shared Button/Input
  components — this one should be the smallest diff of the batch, mostly
  color-token swaps)

Do NOT touch src/app/(dashboard)/record/page.tsx or
src/app/(dashboard)/profile/page.tsx in this prompt — Prompt 5 needs to
resolve first whether either of those maps to any mockup at all before
either gets restyled against something that doesn't describe it.
```

### Prompt 11 — optional cleanup: migrate `/` and `/auth` onto the shared tokens

```
src/app/page.tsx (via HeroLanding.tsx) and src/app/auth/page.tsx
currently define their own local orange CSS variables and font loading
(commit 0d19f74), predating Prompt 0's global registration. Migrate both
onto the shared ax.* tokens and next/font loading from the root layout,
removing the now-duplicate local definitions. Zero visual change is the
goal — if anything looks different after this prompt, that's a bug in
the migration, not an intentional restyle. Verify with tsc, lint, and a
pixel-level visual comparison against the current live pages before this
change.
```

---

## 7. Also still open, not touched by this document

- The `.env.local.example` Supabase-SDK-key deletion, the `test-db.ts` truncate-list addition, and the pile of uncommitted files (`prisma/schema.prisma`, `.env.local.example`, `tests/helpers/test-db.ts` all show modified; a dozen new docs/lib/test files are untracked) — none of that has been committed yet. It's been flagged twice before; it's still sitting there and will only get harder to review the more restyle commits land on top of it.
- `npx prisma db push` remains explicitly held — nothing in this document authorizes running it.
- The Transaction-pooler `DATABASE_URL` connectivity check (Prompt 2 from the earlier Supabase sequence) still hasn't been confirmed successful in your own terminal.
