# AthlasX — Design Import, Auth/Onboarding Rebuild & Association-First Consistency — Claude Code Prompts

## 0. What I could and couldn't verify before writing these

**Update: `/design-login` is a dead end, not a delay.** You tried it on your machine and got "isn't available in this environment" — that's not the same failure as this cloud session's "needs authorization," it means the command doesn't exist in your local Claude Code install at all. Running it again, or waiting, won't change that. Stop pointing prompts at it. There are exactly two ways left to get these files onto disk, and both skip the design MCP entirely:

- **Send to Claude Code Web** — open the project at claude.ai/design/p/23f09406-57c6-45eb-b173-d2ceeba715ea, and if that button exists in the project's UI, use it. It hands the files to a claude.ai/code cloud workspace directly (no OAuth step, since you're already signed into that account). From there you'd still need to get them onto your Windows machine — download the workspace as a zip, or if that web session has push access to `Ath1`, have it commit `design/import/**` and you `git pull` locally.
- **Manual export (the one guaranteed to work everywhere)** — open each of the 23 files in the Claude Design project's viewer, and use whatever that UI offers (view source / copy / download / export) to save each HTML file and each image into `design/import/` in your local repo yourself. No tool, no login, no MCP — just files on disk that Claude Code can then read like any other file in the repo.

I'd start with the manual export. It's slower for one person clicking through 23 files once, but it doesn't depend on a feature flag, a button existing, or an account entitlement any of us can see from here — and every prompt below only needs the files to already be sitting in `design/import/`, not a working MCP connection. Prompt 0 is rewritten below to just check for that and stop cleanly if they're missing, instead of trying to authenticate anything.

Three other things are worth flagging before you run any of this:

1. **[Certain] "Aadhaar verification with OTP" is not a feature Claude Code can build end-to-end.** Aadhaar-based authentication is legally restricted in India to UIDAI-licensed AUA/KUA entities — you cannot call UIDAI's verification API directly without that license, full stop. Every consumer product that does "Aadhaar OTP verification" is actually calling a licensed eKYC vendor (Digilocker-based flows, or providers like Hyperverge, IDfy, Signzy, Karza/Perfios, Cashfree Verification) who holds the license on your behalf. Prompt 4 below builds the real UI and the real data model for this, with a pluggable verification adapter and a dev-mode stub — the same pattern the codebase already uses for phone OTP (`devOtp` shown directly in the UI, no real SMS gateway wired). It does not, and cannot, wire up actual government verification. That needs a vendor contract, not a prompt.
2. **[Certain] "Scout" as a self-serve signup role reopens a decision the codebase currently treats as closed.** `FRANCHISE_SCOUT_ENABLED` is hardcoded `false` in `src/lib/feature-flags.ts`, enforced independently in three places, with no `scout` value anywhere in `UserRole`. Adding it to the signup role picker is new product scope, not a UI tweak — Prompt 8 below is a decision prompt, not a build prompt, for exactly that reason.
3. **[Guessing] I don't know which of `Academy Onboarding v2` and `v3` is the one you mean by "should remain the same."** Prompt 0 has Claude Code diff both against each other and tell you which one it's implementing, before writing any code against either — rather than me silently picking one.

## Prompt 0 — Map every design file to a target route (run first, always)

```
Do NOT attempt /design-login or any design-MCP call — that command doesn't exist in this
environment, confirmed by direct test, and no prompt in this set should try it again.

Instead, check whether design/import/ already contains these 23 files (the user is placing them
there manually, either via Claude Design's "Send to Claude Code Web" + a workspace download, or
by exporting each file directly from claude.ai/design/p/23f09406-57c6-45eb-b173-d2ceeba715ea):

  assets/athletics.jpg, assets/badminton.jpg, assets/boxing.jpg, assets/cricket-dhoni.jpg,
  assets/cricket-sketch-wide.png, assets/cricket-sketch.png, assets/cricket.jpg,
  assets/motorsport.jpg, assets/tennis-sunburst.jpg, assets/tennis.jpg, assets/volleyball.jpg,
  AthlasX Academy Admin Dashboard.html, AthlasX Academy Onboarding v2.html,
  AthlasX Academy Onboarding v3.html, AthlasX Add Players.html, AthlasX Auth.html,
  AthlasX Coach Onboarding.html, AthlasX Hero.html, AthlasX Onboarding.html,
  AthlasX Player Onboarding (standalone).html, AthlasX Player Onboarding.html,
  AthlasX Player Profile.html, AthlasX Player Self-Registration.html, onboarding_text.json

If any are missing, list exactly which ones by name and stop there — don't fabricate a mapping
for a file you can't read, and don't ask the user to try /design-login again. If all 23 are
present, proceed with the rest of this prompt exactly as before.

For each HTML file, extract and write to design/import/MAPPING.md: (1) what real AthlasX route
it corresponds to per this list — Hero→/, Auth→sign-in/sign-up, Onboarding/Player Onboarding/
Player Onboarding (standalone)→the /player/onboarding player flow, Player Profile→/record and/or
/profile, Player Self-Registration→cross-check against the existing /claim flow (do these
overlap or is this a distinct screen?), Academy Onboarding v2 vs v3→flag which one is newer
(check any timestamp/version marker in the file, and diff their content) and tell me which one
you're treating as canonical rather than picking silently, Academy Admin Dashboard→the missing
academy_admin frontend (there are currently zero pages under src/app/(dashboard)/academy/** —
see docs/99-gaps.md — this would be the first one), Add Players→a new manual single-player-add
screen for association staff, distinct from /ingest's bulk CSV/API flow, Coach Onboarding→a
coach self-serve onboarding flow that doesn't exist today (coach accounts are currently seeded,
not self-registered); (2) the literal color values, font-family, spacing/radius values, and any
named CSS custom properties each file actually uses — do not summarize this as "matches the
existing dark theme," paste the real hex/rem values found. Read onboarding_text.json and note
what copy/microcopy it supplies and for which screen.

Then read src/app/globals.css and docs/AthlasX_Design_Consistency_and_Page_Flow_Map.md's §2 (the
existing design audit — two CSS vars, --ax-bg and --ax-green, a glass-card system used on 18/19
pages, an EMPTY tailwind.config.ts theme.extend, and three inconsistent button treatments already
found in the live app). Write a second section in MAPPING.md: a reconciliation table of every
color/spacing value from the mockups against the existing --ax-bg/--ax-green tokens — same value,
close-but-different, or genuinely new. Do not touch tailwind.config.ts or globals.css yet. Stop
after MAPPING.md is written and show it to me before any other prompt in this set proceeds — this
is the one artifact everything else depends on being right.
```

## Prompt 1 — Register real design tokens (do this before touching any page)

```
Read design/import/MAPPING.md's reconciliation table from Prompt 0. Based on it, populate
tailwind.config.ts's theme.extend with the actual token set — colors (keep --ax-bg/--ax-green as
the CSS-var-backed source of truth, add every genuinely new color the mockups introduce as a
named Tailwind color, not a raw hex), a borderRadius scale matching the lg/xl/2xl pattern already
in practical use (documented in the consistency audit), and any new font-family the mockups
specify (add via next/font if it's a Google Font, matching how the rest of the app loads fonts —
check src/app/layout.tsx for the current approach first).

Then build ONE shared primary-button component update: src/components/ui/button.tsx already
exists with variant/size props but is only imported by /claim and /player/onboarding. Do not create a
second button component. Instead, replace the three inconsistent raw-<button> "confirm" styles
documented in the consistency audit (/grading's solid green, /identity-exceptions's tinted-outline
green, /ingest's 80%-opacity green) with three of THIS component's variants, choosing whichever
single visual treatment the mockups actually use for a primary action — then use that variant
consistently everywhere a primary confirm action exists app-wide, not just in the three flagged
files. Grep for all raw <button that represent a primary/confirm action across every dashboard
page and convert them too, not only the three already documented.

Run npx tsc --noEmit && npm run lint && npm run build. Commit: "feat: register real design
tokens from the Claude Design import and consolidate primary-button styling onto the shared
Button component"
```

## Prompt 2 — Hero section: text treatment only, no image changes

```
Read AthlasX Hero.html from design/import/ for the "AthlasX" wordmark treatment only. Do not
touch src/components/marketing/HeroLanding.tsx's images or the FEATURES array content — the user
is replacing hero imagery themselves separately.

Add a wordmark treatment to wherever "AthlasX" appears as the centered hero heading: a solid
black backdrop plate directly behind the bolded wordmark text (not behind the whole hero, just
behind that text element — e.g. an inline-block wrapper with a dark background, padding, and a
radius consistent with the token scale from Prompt 1), so the mark reads clearly regardless of
what background image sits behind it. Match the exact weight/tracking the mockup uses if it
differs from the current font-black already in use. Do not modify anchor hrefs, layout structure,
or any other section of the file.

Run npm run build. Commit: "feat: add highlighted wordmark treatment to the hero AthlasX mark"
```

## Prompt 3 — Auth page with role selection

```
Read AthlasX Auth.html from design/import/. Currently there is no dedicated /auth or /sign-up
page — sign-in goes through NextAuth's built-in page at /api/auth/signin, and there is no
self-serve sign-up at all outside the two existing flows (/claim for shadow-profile players,
/player/onboarding for new players). This prompt adds a proper landing page for the other roles without
breaking either existing flow.

Build a new page at src/app/auth/page.tsx implementing the mockup's layout and the token set from
Prompt 1 (do not reintroduce styles the mockup uses that conflict with the reconciliation table —
flag any conflict instead of silently picking one). Two modes on one page: Sign in (delegates to
the existing NextAuth credentials flow, do not reimplement authentication) and Sign up, which is
a ROLE PICKER, not a form: player, association, academy, coach, scout — five cards or a segmented
control, whichever the mockup actually shows. Selecting player or association goes to a real next
step now (this prompt set builds both). Selecting academy or coach goes to their respective
onboarding routes from Prompts 6 and 7. Selecting scout must show a clearly-labeled "not yet
available" state — do not silently create a working scout account path; see Prompt 8 for why.

This page replaces nothing — /claim and /player/onboarding keep working exactly as they do today for
players who arrive there directly (e.g. from a claim-search link). This page is the new front
door that routes to them, not a replacement for them.

Run npm run build && npm run test:ci. Commit: "feat: add role-selection auth/sign-up landing page"
```

## Prompt 4 — Player onboarding rebuild: 3 real stages, not static screens

```
Read AthlasX Onboarding.html, AthlasX Player Onboarding.html, and AthlasX Player Onboarding
(standalone).html from design/import/ — per Prompt 0's MAPPING.md, confirm which is the
authoritative layout before starting (if MAPPING.md says they conflict, stop and tell me rather
than merging two different designs).

Rebuild src/app/player/onboarding/page.tsx as a real 3-stage flow — this REPLACES the current 4-step
wizard's step content, not its underlying pattern (keep the existing single-form-object,
step-gated-Continue-button architecture already in this file, since that's the same pattern
/claim uses and it works):

Stage 1 — Basic player details. Keep the current fields (fullName, dob, district, state, email,
password, playing role, batting/bowling style, preferred formats — everything currently in steps
1-2) but lay them out per the mockup instead of the current step boundaries.

Stage 2 — Aadhaar verification via OTP. Add aadhaar_last4 (display only, never store or transmit
the full number to the client after initial entry) and a verification-pending state to the
player onboarding form data. Build this against a NEW pluggable adapter at
src/lib/aadhaar-verification.ts, mirroring the existing src/lib/ingest/registry.ts adapter
pattern exactly (a registry keyed by provider, one interface, swappable implementations). Ship
exactly one implementation: a dev-mode stub that behaves like src/lib/otp.ts's existing phone-OTP
stub (generates a code, shows it directly in the UI labeled "Dev mode — no eKYC vendor
connected," never calls any external Aadhaar/UIDAI endpoint). Do not attempt to call UIDAI or any
real eKYC API — no such integration exists and none should be fabricated. Add a
PlayerProfile.aadhaar_verification_status enum field (unverified/pending/verified) to
prisma/schema.prisma via a migration; do not store a raw Aadhaar number anywhere — store only
last-4 and the verification status, the same minimal-PII pattern the codebase already follows
elsewhere.

If isUnder18(dob) (reuse the existing function, don't reimplement the age math), Stage 2 requires
a SECOND Aadhaar verification for the guardian, same adapter, clearly labeled as the parent/
guardian's identity, before Stage 3 is reachable — this is in addition to, not instead of, the
guardian phone number already collected in Stage 1.

Stage 3 — everything else (footage/bio, review) PLUS all four consent forms in one page. Each
consent must render as its own scrollable panel with its full text (pull real text from
onboarding_text.json if it has consent copy; otherwise write clear plain-language versions
covering: data collection & use, DPDP Act guardian consent for minors, visibility/sharing with
associations, and terms of service — confirm the exact four with me if onboarding_text.json
doesn't name them explicitly, don't invent a fourth to hit the number). The Accept checkbox for
each consent must be disabled until the user has scrolled that specific panel to its bottom
(track scroll position per panel, not a single page-level scroll) — this is a real gate, not a
cosmetic disabled state. Final submit is blocked until all four are individually accepted.

POST /api/player/onboard keeps its current contract but gains the new Aadhaar fields; extend the
route's Zod/validation schema accordingly rather than loosening it. On success, keep the existing
router.push('/record') behavior — that redirect was fixed intentionally in an earlier prompt.

Run npx tsc --noEmit && npm run lint && npx prisma validate && npm run test:ci. Commit: "feat:
rebuild player onboarding as a 3-stage flow with Aadhaar verification (stubbed) and per-consent
scroll-gated acceptance"
```

## Prompt 5 — Association onboarding (priority): a real connected flow, not linked static screens

```
This is the priority build in this batch — do it after Prompts 0-3 land, before Prompts 6-8.

There is currently NO self-serve association onboarding at all — associations exist only as
seeded Association rows with AssociationStaff membership rows (see docs/AthlasX_System_Design_
and_Functionality_Reference.md §4). This prompt builds the first real one.

Read whichever design files Prompt 0's MAPPING.md assigned to association onboarding (it wasn't
named as its own file in the current selection — if MAPPING.md found no dedicated association
mockup, use AthlasX Onboarding.html's structural pattern and AthlasX Auth.html's token set, and
tell me that's what you did).

Build this as ONE real multi-step flow at src/app/onboarding/association/page.tsx — a single
client component with real state and real validation gating each step's Continue button, the same
architecture as the existing /player/onboarding and /trial-cycles CreateCycleModal wizards. Do NOT ship
this as separate static pages linked to each other by anchor tags — that is explicitly what was
asked against. Steps: (1) Association identity — name, type (state/district), parent association
if district-level, district/state; (2) Staff account — the signer's own name/email/password,
becomes the first AssociationStaff row; (3) Data-sharing consent — Association.data_sharing_signed
is an existing schema field with no UI path to set it today; this step is where it actually gets
set, with real consent text, not a decorative checkbox — this field is also the literal blocker
named in the pivot document's own validation backlog ("no association conversation is yet on
record... blocks everything"), so make the copy on this screen honest about what the association
is agreeing to; (4) Review & submit.

New route: POST /api/associations/onboard — creates the Association row, the first
AssociationStaff row, and signs the staff member in via the same encodeSessionToken/
applySessionCookie pattern claim/verify and player/onboard already use (don't reimplement session
minting a third way). On success, route to /dashboard (this staff member's role is 'association',
whose rootDestination is already /dashboard — verify this rather than assuming).

Then — same session, same prompt — apply the token set from Prompt 1 to EVERY existing
association-facing page for consistency, since "maintain design consistency in every page" was
explicit and these are the pages association staff will see immediately after onboarding:
/dashboard, /trial-cycles, /ingest, /identity-exceptions, /academy-matching. Do not restructure
their layouts or data flow — only reconcile colors/radii/button treatments per the token table,
the same mechanical pass as Prompt 1 did for the three flagged files, extended to these five.

Run npx tsc --noEmit && npm run lint && npx prisma validate && npm run build && npm run test:ci.
Commit: "feat: add self-serve association onboarding and apply consistent design tokens across
all association-facing pages"
```

## Prompt 6 — Academy onboarding: implement as designed, minimal restructuring

```
Per your instruction this one should "remain the same" — read whichever of AthlasX Academy
Onboarding v2.html / v3.html Prompt 0's MAPPING.md named as canonical (if it flagged a conflict
you haven't resolved with me yet, stop and ask rather than guessing here too).

Implement it close to its current step structure and copy — this is the one flow in this batch
that should NOT be restructured into a different step breakdown, just brought in with real state
management (still no static linked-card pages — "remain the same" means the content and step
order, not literally staying as flat HTML) and wired to real submission. There is no existing
academy-onboarding API route — check src/app/api/academy/** for the closest existing shape (join-
requests, batch creation) before deciding whether this creates a new Academy row + academy_admin
User, or something narrower. This does not resolve the open academy_admin frontend gap from
docs/99-gaps.md (no NAV_SECTIONS entry, not in UserRole) — that's still a separate decision,
tracked, not silently fixed here as a side effect.

Apply the Prompt 1 token set to this flow. Run npx tsc --noEmit && npm run lint && npm run build.
Commit: "feat: implement academy onboarding flow with consistent design tokens"
```

## Prompt 7 — Coach onboarding (new — doesn't exist today)

```
Read AthlasX Coach Onboarding.html from design/import/. Coach accounts are currently seed-only —
there is no self-serve path. Build src/app/coach/onboarding/page.tsx following the same
real-state-wizard pattern as Prompts 4-5 (not static linked screens), collecting whatever the
mockup actually asks for. Confirm with me before inventing fields the mockup doesn't show —
squad assignment in particular should probably happen after an ops/association admin approves the
account, not be self-selected at signup; check whether the mockup implies self-assignment or a
pending-approval state, and tell me which you found rather than assuming.

New route: POST /api/coach/onboard, following the same session-minting pattern as Prompts 4/5.
Apply the Prompt 1 token set. Run npx tsc --noEmit && npm run lint && npm run build. Commit:
"feat: add self-serve coach onboarding flow"
```

## Prompt 8 — Scout role: decision only, not a build (do not run against the codebase)

```
This isn't a Claude Code prompt — read it before deciding whether Prompts 3/7's "scout" option
should ever become a real signup path. FRANCHISE_SCOUT_ENABLED is hardcoded false in
src/lib/feature-flags.ts, checked independently in three places (UI, POST routes, and
canViewPlayerProfile even against a row that already has the tier set). No scout role exists in
UserRole. The pivot document's own Phase-1 scope doesn't mention scouts as a rollout target.
Turning this on means: a new UserRole value, a new dashboard nav section, a new set of
visibility/access rules for what a scout may see across associations (this is a materially
different trust boundary than anything currently built — every existing role is scoped to one
association's own data by default; a scout's entire purpose is cross-association visibility),
and a real decision about who's allowed to become a scout and how that's vetted. That's a product
scope decision for you to make deliberately, not something to greenlight by leaving "Scout" live
on the sign-up screen and seeing what happens.
```

## 9. Ordering, one more time

Prompt 0 (mandatory first, produces MAPPING.md) → Prompt 1 (tokens + button consolidation) → Prompt 2 (hero wordmark) → Prompt 3 (auth/role picker) → **Prompt 5 (association, prioritized)** → Prompt 4 (player) → Prompt 6 (academy) → Prompt 7 (coach) → Prompt 8 is a read, not a run. Don't run 4/6/7 before 3 exists — they're the destinations Prompt 3's role picker routes to, and building the destinations before the router means testing them by typing a URL, not by the flow you actually asked for.
