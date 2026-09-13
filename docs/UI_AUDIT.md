# AthlasX — UI/UX Audit

**Repo** `C:\Users\saura\Claude\Projects\AthlasX`, branch `main` (uncommitted working tree)
**URL audited (runtime pass)** `http://localhost:3000` — the public landing page only
**Viewports** 1440×900, 768×1024, 390×844
**Date** 2026-09-10
**Method** [atelier:ui-audit](../.claude) — static source pass (`audit-source.mjs`, run twice: whole repo, then `src/` alone to separate shipped code from `design/import/` mockups) + real-Chrome runtime pass (`audit-runtime.mjs`) + manual review of every capture, live and frozen

**What was not audited.** Only the public landing page got a runtime (real-Chrome) pass — every authenticated surface (dashboards, `/record`, `/selection`, `/grading`, etc.) requires a session this audit didn't create, so their composition, idle cost, and motion-at-rest are unmeasured. The onboarding wizards (player/academy/coach/scout/association) and the `/auth` page were reviewed from source only, not driven through Chrome. Two numbers in the source pass turned out to double-count: `design/import/*.html` is a folder of static design mockups that never ships — re-running the source pass scoped to `src/` alone isolates the real numbers, used everywhere below unless marked "repo-wide."

---

## What works

- **The design-token *intent* is real, not decorative.** Every onboarding wizard, the auth page, and the landing hero converge on the same four-colour system (`#0D0D0D` background, `#FF8A1E`/`#FFA64D` accent pair, `#F5F5F0` text) and the same two-typeface pairing (Anton display, Barlow body/label). Nobody guessed a new palette per page — that discipline is unusual and worth protecting through whatever comes next.
- **`prefers-reduced-motion` aside (see Missing, below), the app is calm at rest.** The runtime pass measured **0 layouts, 0 style recalcs, 0 rAF callbacks, 0 running animations** on the landing page once it settles. A page that costs nothing when nobody touches it is a real, measurable strength, not a given — most animation-heavy sites fail this.
- **The pending-verification gate for self-serve associations is a genuine security control, not cosmetic.** Out of scope for a visual audit, but worth naming: it's the one place in this codebase where a design decision (a holding screen, not a dashboard) is backed by an enforced, tested chokepoint rather than trust.

---

## Headline findings

**1. [Broken] 100 form inputs in the shipped app have no programmatic label.**
`grep`-verified: the shared `Label` (`src/components/ui/label.tsx`) and `Input` (`src/components/ui/input.tsx`) components both accept `htmlFor`/`id` via prop passthrough, but neither wires one by default, and every onboarding wizard call site (`player/onboarding`, `academy/onboarding`, `coach/onboarding`, `scout/onboarding`, `onboarding/association`) stacks `<Label>Email*</Label>` directly above `<Input />` with no `htmlFor`/`id` pairing at all. A screen reader announces these fields with no name — email, password, full name, DOB, across every sign-up flow in the product. This is the actual meaning of the source scan's **100 `inputsWithoutLabelOrId`** count (`src/`-scoped; 112 repo-wide). One exception exists and shows the fix is trivial: `auth/page.tsx`'s role `<select>` does pair `htmlFor="signup-role"` with a matching `id`.

**2. [Structural] The token system is declared once and then re-declared seven more times, independently.** `grep` for the literal string `'--bg': '#0D0D0D'` finds it hard-coded in **8 separate files** — `HeroLanding.tsx`, `auth/page.tsx`, and all five onboarding wizards — each as its own local `OB_VARS`/`AUTH_VARS`/`HERO_VARS` object, not an import from one shared module. This is the rubric's "custom properties declared ≫ used" signal made concrete: **37 distinct hex values, 180 of the 188 occurrences outside any token declaration** (`src/`-scoped). The dashboard pages use a *second*, different system entirely — Tailwind's `ax-*` theme classes (`ax-bg`, `ax-textDim`, `ax-accent`). Two parallel colour systems exist in one app, neither is the single source of truth, and the seven-file duplication means changing the brand orange requires seven synchronized edits or it silently drifts.

**3. [Missing] No `prefers-reduced-motion` rule exists anywhere in the shipped app.** `grep -r "prefers-reduced-motion" src/` returns nothing. The repo-wide source scan reported "reduced motion respected: yes" — that "yes" comes entirely from a static file under `design/import/`, a mockup that never ships; the `src/`-scoped re-scan correctly reports "not found." Four motion libraries are `package.json` dependencies — GSAP, `@gsap/react`, Three.js, `lottie-react` — and **none of the four has a single import anywhere in `src/`** (only Framer Motion is actually used). They're dead weight today, but if any of them gets wired in without a reduced-motion branch, there's no existing pattern in the codebase to copy.

**4. [Generic] Convergence score 86 (src-only; 120 including the unshipped mockups) — driven almost entirely by one tell.** `rounded-lg`/`rounded-xl` utility repetition is **149 hits, identical in the repo-wide and src-only scans** — every one of them is in shipped code, none is mockup noise. That's a Tailwind-default signature, not a decision: nothing in the five-tier onboarding-wizard `FIELD_CLS`/`OPTCARD_CLS` constants explains *why* 9px/11px radii specifically, versus any other Tailwind project's defaults. `text-center` repetition (52 real, 105 counting mockups) and `backdrop-blur` panels (15 real, 35 counting mockups) are smaller but same-shape signals.

**5. [Note] A 5.43 MB PNG sits in `public/images/hero/` unreferenced by any component.** `cricket-sketch.png` is publicly servable (anything under `public/` is) but `HeroLanding.tsx`'s `TILES` array references `cricket-sketch-wide.png` (767 KB) instead — the 5.43 MB file is dead weight that nonetheless ships to production and is fetchable by URL. The landing page's own actual image payload is closer to 1.9 MB across the 7 tiles it does load, which is reasonable — this isn't a page-weight problem, it's an unreferenced-file cleanup item.

---

## Composition

Runtime pass, landing page only, all three viewports:

| Viewport | Subject height | Painted ink | Largest empty band |
|---|---|---|---|
| 1440×900 | 72.2% | 94.9% | 0% |
| 768×1024 | 72.2% | 96.1% | 0% |
| 390×844 | 72.2% | 96.9% | 0% |

The subject (the `<img>` wordmark/collage) holds an almost identical height percentage across all three breakpoints — this is a composition that was actually designed responsively, not scaled down and hoped for. Painted ink is consistently near-full with no dead band at any size; there is no "empty desktop, cropped mobile" problem here.

**But the page is now exactly one section.** The runtime pass measured **21 DOM elements, document height = 1× viewport height** — there is no scroll content below the hero at all. This wasn't always true: earlier in this engagement a four-card feature-description section ("Association Ingest," "Identity Resolution," "Blind Selection," "In-Season Tracking") sat directly below this hero and was removed on request. Whatever the landing page is meant to tell a first-time visitor beyond the brand name and two buttons, it currently says none of it — worth flagging as a fact, since it's the direct, current state of the page, not a judgement about whether removing that section was right.

**The frozen capture is byte-identical to the live one at all three viewports** (confirmed by file size, not just visually) — consistent with the runtime pass's "0 animations running." The motion test (below) is trivially "pass" only because there's no motion in flight to lose.

---

## Design system

- **13 custom properties declared, 34 used** (`src/`-scoped) — more used than declared means most of what's "used" resolves through Tailwind's own config or inline objects, not a central token file.
- **37 distinct hex values**, 7 of them accounting for the overwhelming majority of occurrences (`#1a0e02`×28, `#141312`×25, `#ff8a1e`×20, `#0d0d0d`×19, `#ffa64d`×15) — the palette itself is genuinely small and consistent; the problem (Finding 2) is that it's re-typed rather than imported.
- **2 border-radius values found by the scanner** (`1rem`, `9999px`) in the one real CSS file — the far larger radius vocabulary (9px/11px/8px/10px, seen throughout the onboarding wizards) lives entirely in inline Tailwind arbitrary-value classes (`rounded-[9px]`), invisible to a stylesheet-level scan. This is a real limitation of what a static scan can see, not a claim that no radius scale exists — see Verify manually.
- **Two systems, one app**: the `ax-*` Tailwind theme (dashboard/coach/tracking pages) versus the seven independent `OB_VARS`-style objects (onboarding/auth/landing). No file imports from both.

---

## Typography

- **Anton** (display, `next/font`) + **Barlow / Barlow Semi Condensed** (body/label, Google Fonts) — consistent pairing across every page reviewed, uppercase-Anton headlines, Barlow-Semi labels/buttons, Barlow body. This is a real, held-to scale, not a grab-bag.
- **0 distinct font-size values reported** in the one scanned CSS file — again a scanner blind spot: the actual scale lives in Tailwind arbitrary values (`text-[40px]`, `text-[11px]`) throughout the `.tsx` files, not in a stylesheet. Manually spot-checked across the wizards: headline sizes cluster around 40–44px, section labels around 10.5–11px, body around 13–14px — a real, if unenforced, scale. See Verify manually — a full inventory would need a source-level (not stylesheet-level) size scan this tool doesn't run.
- **0 self-hosted font files** — both families load from Google Fonts / `next/font`, which self-hosts at build time under the hood for Anton; standard, no action needed.

---

## Motion

- **0 transition declarations, 1 `@keyframes` (`live-pulse`), 0 scroll listeners, 0 IntersectionObservers** in the one scanned CSS file — real motion is implemented via Framer Motion in `.tsx` files (`AnimatePresence`, `motion.div`), invisible to a CSS-only scan.
- **Framer Motion is the only motion dependency actually imported anywhere in `src/`.** GSAP, `@gsap/react`, ScrollTrigger, Three.js, and `lottie-react` are `package.json` dependencies with zero import sites — confirmed by `grep` returning no results for any of the four. Either dead weight to remove, or a signal that planned motion work (a 3D scene, a Lottie loader) was scaffolded and never built.
- **No `prefers-reduced-motion` handling anywhere in `src/`** — see Headline Finding 3.
- **At rest, the landing page runs nothing**: 0 layouts/recalcs/rAF per second, 0 animations running or infinite. Good baseline; the open question is what happens on the pages this audit didn't drive through Chrome — the onboarding wizards use `AnimatePresence`/`motion.div` per-step transitions that were never measured live.

---

## Accessibility

**Measured (markup-level, `src/`-scoped):**

- **100 inputs without a label/id pairing** — see Headline Finding 1.
- **5 buttons with no accessible name** — not yet located to specific files by this pass; carried into Verify manually.
- **2 links to `#`** — both in `src/app/auth/page.tsx` (Terms, Privacy Policy at the bottom of the sign-up form). The repo-wide scan's "13" figure is 11 more from `design/import/*.html` mockups that never ship.
- **1 click handler on a non-interactive element** (`div`/`span` with `onClick`, not a real `<button>`) — not yet located; carried into Verify manually.
- **0 `:focus-visible` rules, 0 `outline:none` in `src/`'s one CSS file** — the repo-wide scan's "6 `outline:none`" is entirely from the unshipped mockups. This is better than it first looked, but it also means **no focus-visible styling exists anywhere in shipped code either** — worth confirming by tabbing (see Verify manually), since a browser default outline may or may not survive Tailwind's reset.
- **38 `<h1>` elements** — this is not a same-page violation. AthlasX is a multi-route Next.js app; the source scanner counts every `page.tsx`'s own top-level heading across the whole route tree, which is expected and correct for independent documents, not 38 headings competing on one screen.

---

## Performance

- **Idle cost (landing page, all 3 viewports): 0 layouts/s, 0 style recalcs/s, 0 rAF callbacks/s, 0s main-thread time.** As close to zero as this tool measures — a real strength, not a default.
- **No layout-triggering animated properties found in the CSS scan** (the repo-wide pass flagged `width`×2, but that's inside `design/import`, not shipped code).
- **Asset weight is smaller than the raw repo-wide number suggests.** `design/import/` alone is 18 MB / 37 images of the reported 28.66 MB / 82 images — none of it ships. `public/` (what Next.js actually serves) is 9.3 MB / 28 images, and the landing page itself loads roughly 1.9 MB across 7 tiles via `next/image` (which further transcodes/resizes at request time — the audit measures source file size, not what a browser actually downloads).
- **4 unused heavy dependencies** (GSAP, `@gsap/react`, Three.js, `lottie-react`) still ship in `node_modules` and count toward install size and `npm audit` surface, for zero runtime benefit today.

---

## Convergence

| Tell | Repo-wide | `src/`-only | Judgement |
|---|---|---|---|
| `rounded-lg`/`rounded-xl` repetition | 149 | **149 (identical)** | Real, 100% shipped — a Tailwind default used without a stated reason, not a decision |
| `text-center` repetition | 105 | 52 | Half real, half mockup noise |
| `backdrop-blur` glass panels | 35 | 15 | Half real, half mockup noise |
| Full-viewport-height hero | 30 | 16 | Half real, half mockup noise |
| Marketing filler ("seamless", "elevate"…) | 29 | 8 | Mostly mockup noise |
| Gradient text | 2 | 2 | Real but negligible |
| Inter/Space Grotesk as display face | 15 | 2 | Almost entirely mockup noise — Anton is the actual shipped display face |
| **Score** | **120** | **86** | |

A score of 86 on shipped code alone is not low. The honest read: the palette and type pairing are genuinely derived and consistent (see What works), but the *shape* language — corner radii, centered text blocks, blur panels — is close to Tailwind's own defaults everywhere it appears, without a stated reason tying any of it back to what AthlasX specifically is (a cricket talent pathway, not a generic SaaS product). That's the `atelier` skill's job to fix, not this audit's — but it's the honest reading of the number.

---

## The four tests

**The template test — FAIL.** Swap "AthlasX" for any other multi-sport platform's name and logo on the landing hero: nothing else changes. The collage art (F1 driver, badminton, cricket, volleyball, tennis, an abstract painting) spans sports AthlasX doesn't operate in at all — the product itself is specifically a *cricket* talent pathway (per the auth page's own copy: "Where India's next champions get found... seen by the coaches, academies and scouts who matter"), but the hero's imagery doesn't say cricket, it says "sports, generally." This is the weakest concept in the current build, named plainly rather than defended.

**The motion test — PASS, but hollow.** The frozen and live captures are byte-identical because there's currently no motion running on the landing page to freeze. The composition holds without movement, but only because movement isn't carrying anything right now — this isn't evidence the design would survive losing a wow moment, because there isn't one in flight to lose.

**The object test — FAIL.** Remove the actual product — AthlasX's cricket player records, the association-verified data, the AthlasX Score — from the landing page, and the concept is unchanged: it's still a photo collage of athletes with a wordmark on top. Nothing on the page is *about* what AthlasX specifically does; it's about "sport" as a category.

**The asset test — FAIL.** All 7 hero images are stock/licensed sport illustration, not AthlasX's own material — not a real player record, not a real AthlasX Score screen, not a real association's data. There's no artefact here that only AthlasX could have used.

---

## Verify manually

Carried forward verbatim from both scripts, plus what manual review couldn't settle:

- **5 buttons with no accessible name, 1 non-interactive click handler** — the scanner found these repo-wide but this pass didn't trace them to specific files/lines; worth a targeted follow-up grep before treating as fixed or ignoring.
- **Focus-visible behavior** — 0 explicit rules found in shipped CSS, but Tailwind's own reset and browser defaults may or may not produce a visible focus ring. Confirm by tabbing through the auth page and one onboarding wizard.
- **28 custom properties used but never declared in any scanned stylesheet** (`src/`-scoped) — likely resolved through Tailwind's config or inline `style={{...}}` objects (confirmed pattern: `OB_VARS` etc. are inline objects, not stylesheet declarations, so the CSS-file scanner can't see where they're defined even though they clearly are, in the `.tsx` files themselves).
- **1+ CSS class(es) not found as literal strings** — may be composed at runtime (template strings, `cn()` calls); treat as a candidate, not confirmed dead code.
- **Font-size scale** — 0 values found in the one stylesheet; the real scale lives in Tailwind arbitrary values across `.tsx` files and would need a source-level (not CSS-level) size inventory this tool doesn't run.
- **Border-radius scale** — same limitation; 2 values found in CSS, but the real 9px/10px/11px scale used throughout the onboarding wizards lives in inline Tailwind classes invisible to a stylesheet scan.
- **Everything behind auth** — dashboards, `/record`, `/selection`, `/grading`, the academy/scout/association admin surfaces, and the onboarding wizards' actual rendered/animated state were not driven through real Chrome. Composition, idle cost, and motion-at-rest for all of them are unmeasured, source-only.
- **64 media files not referenced by filename in the repo-wide scan** — largely `design/import/` mockup assets; not re-verified as genuinely orphaned versus referenced dynamically.

---

## Recommendations

Ranked by consequence, directions and constraints only — no hex values, no redesign (that's `atelier`, and it needs approval first):

1. **Wire `htmlFor`/`id` on every `<Label>`/`<Input>` pair across the five onboarding wizards and the auth page.** This is the one Broken-severity finding and the cheapest to fix of the five headline items — the components already support it, no new component needed, just closing ~100 call sites. Do this before anything else on this list.
2. **Pick one token source and delete the other seven.** Either promote the `OB_VARS`/`AUTH_VARS` pattern into the Tailwind `ax-*` theme the dashboard pages already use, or vice versa — but stop re-typing `#0D0D0D` in eight files. Whichever direction, this removes Finding 2 and the single biggest source of "was this a decision or a forgotten sync" risk in the codebase.
3. **Add a real `prefers-reduced-motion` branch before any of the four unused motion dependencies get wired in for real.** Cheaper to establish the pattern now, with nothing depending on it yet, than to retrofit it across five onboarding wizards once GSAP/Three.js/Lottie are actually in use.
4. **Decide what the landing page is for, now that it's a single hero with no supporting content below it.** Not a design opinion — a factual gap: right now a first-time visitor gets a wordmark, two buttons, and a multi-sport collage that doesn't say cricket. Whether the fix is new copy, a real product screenshot, or something else is the `atelier` skill's job once this is confirmed as the intended state rather than a mid-change artifact.
5. **Remove the unreferenced 5.43 MB `cricket-sketch.png`** from `public/images/hero/` (keep `cricket-sketch-wide.png`, which is what's actually loaded) — a five-minute cleanup with a real, if small, effect on what's publicly fetchable from the deployed site.
