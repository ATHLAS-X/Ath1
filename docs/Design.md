# AthlasX — Design System

A standalone visual design reference. Every value here is pulled directly from the codebase (`tailwind.config.ts`, `src/app/globals.css`, `src/components/ui/*`, and per-page usage) — nothing is invented or approximated. Use this as the single source of truth when designing new screens (including the mobile app).

---

## 1. Color

### 1.1 Brand tokens (`tailwind.config.ts` → `theme.colors.ax`)

| Token | Hex / Value | Role |
|---|---|---|
| `ax-bg` | `#0D0D0D` | Base page background — near-black, never pure black |
| `ax-bgSoft` | `#141312` | Slightly raised surface, one step above `ax-bg` |
| `ax-text` | `#F5F5F0` | Primary text — off-white, never pure white |
| `ax-textDim` | `rgba(245,245,240,0.62)` | Secondary text (descriptions, subtitles) |
| `ax-textFaint` | `rgba(245,245,240,0.5)` | Tertiary text / placeholders — WCAG AA-verified (~4.97:1 on `ax-bg`) |
| `ax-accent` | `#FF8A1E` | **Brand primary — orange.** All primary CTAs, active nav/tab states, progress fills, focus rings |
| `ax-accentBright` | `#FFA64D` | Hover/active state for `ax-accent` |
| `ax-ok` | `#38d39f` | Status: positive |
| `ax-bad` | `#ff5a4d` | Status: negative |
| `ax-cardBorder` | `rgba(245,245,240,0.14)` | Default border on cards, inputs, dividers |
| `ax-fieldBg` | `rgba(245,245,240,0.06)` | Input/field fill |

**Text-on-accent** is always `#1a0e02` (near-black), never white — e.g. a solid orange button reads `bg-ax-accent text-[#1a0e02]`.

### 1.2 Status colors (raw Tailwind swatches, used deliberately alongside the brand palette — never replace these with orange)

| Meaning | Classes |
|---|---|
| Success / approved / on-form / live | `text-green-400`, `bg-green-500/10`, `border-green-500/20` |
| Error / rejected / form-drop | `text-red-400`, `bg-red-500/10`, `border-red-500/20` |
| Warning / pending / no-match | `text-amber-400` |
| Informational | `text-blue-400`, `bg-blue-500/10` |

Rule of thumb: **orange means "act on this" (a button, an active choice). Green/red/amber/blue mean "here is a state"** (approved, rejected, pending, informational). Don't collapse these into one hue — that distinction is doing real communicative work.

### 1.3 Known inconsistency — read before designing a new screen
Two visual generations coexist in the current codebase:
- **Current/correct system**: uses `ax-accent` orange for every actionable element (landing, `/auth`, all 5 onboarding wizards, `/claim`, `error.tsx`/`not-found.tsx`).
- **Legacy system**: several dashboard pages originally used raw `green-500`/`green-600` for primary actions instead of `ax-accent`, and plain bold sans-serif headings instead of Anton. Most of these were found and corrected in a recent audit; treat **orange + Anton** as the only correct answer for anything new.

Two shared components still default to the legacy green and should be overridden explicitly (or fixed at the source) whenever used:
- `src/components/ui/input.tsx` — its default className includes `focus:border-green-500/50`. Every onboarding wizard already overrides this via a local `FIELD_CLS` constant using `focus:border-[color:var(--accent)]`; any *new* usage of `<Input>` should do the same (or the component's default should be changed to `ax-accent` — not yet done).
- `src/components/ui/button.tsx`'s `primary`/`secondary`/`outline` variants are already correct (orange/neutral) — this one has no lingering green default (its old green `default` variant was removed).

---

## 2. Typography

Three Google Fonts, loaded via `next/font/google` as CSS variables and exposed as Tailwind utilities:

| Utility | Font | Role |
|---|---|---|
| `font-anton` | Anton (condensed display, single weight) | **Every page/section heading.** Always paired with `uppercase`. This is the single most identity-defining choice in the whole UI — a heading rendered in anything else reads as visually broken, not just "different." |
| `font-barlow` | Barlow | Body copy, some legacy form labels |
| `font-barlow-semi` | Barlow Semi Condensed | Small uppercase eyebrow labels, button text, nav labels, badges |

### Canonical heading block
```html
<p class="font-barlow-semi text-[11px] font-bold uppercase tracking-[0.18em] text-ax-accentBright">
  Eyebrow label
</p>
<h1 class="font-anton uppercase text-xl sm:text-[30px] text-ax-text mt-1">
  Screen Heading
</h1>
```
The eyebrow line is optional for simpler screens — those go straight to `<h1 class="font-anton uppercase text-xl text-ax-text">Heading</h1>`.

### Type scale in practice
| Use | Classes |
|---|---|
| Page heading (large) | `font-anton uppercase text-xl sm:text-[30px]` |
| Page heading (compact/section) | `font-anton uppercase text-xl` |
| Stat / big number | `font-anton text-2xl` to `text-[52px]` |
| Eyebrow / overline | `font-barlow-semi text-[11px] font-bold uppercase tracking-[0.14em]–[0.22em]` |
| Body | `text-sm` (14px) default, `text-xs` (12px) for secondary/meta text |
| Micro labels (stat captions, table headers) | `text-[9px]`–`text-[10.5px] uppercase tracking-widest font-bold` |

---

## 3. Spacing, Radius & Elevation

### Border radius
Tailwind defaults (`rounded-lg`=8px, `rounded-xl`=12px, `rounded-2xl`=16px) plus mockup-matched custom values:

| Token | Value |
|---|---|
| `rounded-ax-xs` | 3px |
| `rounded-ax-sm` | 7px |
| `rounded-ax-md` | 9px |
| `rounded-ax-lg` | 10px |
| `rounded-ax-xl` | 11px |

Most buttons and cards use `rounded-xl` (12px). Onboarding form fields commonly use the `9px`/`10px` custom radii to match the original mockups pixel-for-pixel.

### Surfaces
```css
.glass       { background: rgba(255,255,255,0.03);  backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.06); }
.glass-card  { background: rgba(255,255,255,0.025); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.06); border-radius: 1rem; }
.glass-dark  { background: rgba(7,7,7,0.92);         backdrop-filter: blur(24px); border: 1px solid rgba(255,255,255,0.08); }
```
Most day-to-day dashboard cards **don't** use the blur variants — the common pattern is a flat `bg-white/[0.02–0.04] border border-white/[0.06–0.08] rounded-xl p-4`. Reserve `.glass-card`'s blur for a few deliberately elevated surfaces (modals, hero banners), not every card — using it everywhere would be a departure from current usage.

There is no formal shadow/elevation scale beyond the button's own glow:
```css
shadow-[0_8px_22px_-8px_rgba(255,138,30,0.7)]   /* under primary buttons only */
```

---

## 4. Iconography & Motion

- **Icons**: [Lucide React](https://lucide.dev) exclusively (40+ files import from `lucide-react`) — no other icon set is mixed in. Stick to Lucide's outline style for any new icon.
- **Loading spinner**: `<Loader2 className="w-4 h-4 animate-spin" />` — the one consistent spinner treatment across every async button/state in the app.
- **Motion**: Framer Motion for entrance transitions — the near-universal pattern for a page's top content block is:
  ```tsx
  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
  ```
  Step transitions in wizards commonly use `initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-12}}` inside `<AnimatePresence mode="wait">`.
- **Pulsing live-indicator dot**:
  ```css
  .live-dot { width:6px; height:6px; border-radius:9999px; background: var(--ax-green); animation: live-pulse 1.6s ease-in-out infinite; }
  @keyframes live-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.75)} }
  ```

---

## 5. Components

### 5.1 Button (`src/components/ui/button.tsx`)
Three variants, all `rounded-xl`, `inline-flex items-center justify-center gap-2`, `disabled:opacity-50 disabled:pointer-events-none`:

```css
/* primary — the default; use for the one main action on a screen */
bg-ax-accent text-[#1a0e02] border-[1.5px] border-ax-accent
shadow-[0_8px_22px_-8px_rgba(255,138,30,0.7)]
hover:bg-ax-accentBright hover:border-ax-accentBright
font-barlow-semi uppercase tracking-wide

/* secondary — for a lower-emphasis action next to a primary one */
bg-transparent text-ax-text border-[1.5px] border-ax-cardBorder
hover:border-ax-text hover:bg-white/[0.06]
font-barlow-semi uppercase tracking-wide

/* outline — for neutral/tertiary actions (e.g. "Back") */
bg-transparent border border-white/10 text-zinc-200
hover:bg-white/[0.05]
```
Sizes: `default` (h-10 px-4 text-sm), `sm` (h-8 px-3 text-xs), `lg` (h-12 px-6 text-base), `icon` (h-10 w-10, square).

Many dashboard pages predate this shared component and hand-roll their own button classNames inline rather than importing `<Button>` — when writing new dashboard screens, prefer the shared component (or at minimum copy its exact class strings) instead of inventing a new one-off style.

### 5.2 Input & Label (`src/components/ui/input.tsx`, `label.tsx`)
```css
/* Input */
flex w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2
text-sm text-white placeholder:text-zinc-600 outline-none transition-colors
focus:border-green-500/50   /* legacy green default — override to ax-accent in new work, see §1.3 */
disabled:opacity-50

/* Label */
block font-medium
```
Onboarding wizards instead use a local `FIELD_CLS` constant per page (all five wizards define an identical one):
```css
bg-[color:var(--field-bg)] border-[color:var(--card-border)]
text-[color:var(--text)] placeholder:text-[color:var(--text-faint)]
h-10–[42px] rounded-[9px]
focus:border-[color:var(--accent)] focus:bg-white/[0.09]
```
This is the pattern to copy for any new form field — orange focus ring, not green.

### 5.3 Buttons-as-toggles (role pickers, type selectors)
A very common pattern: a horizontal or grid group of bordered "cards" acting as a single-select control (e.g. Playing Role, Academy Type, Organization Type). Unselected:
```css
bg-white/[0.03] border-white/10 text-zinc-400
```
Selected:
```css
bg-ax-accent/15 border-ax-accent/40 text-ax-accentBright
```

### 5.4 Pills / badges
Small rounded-full or rounded-xl chips for status or filters:
```css
/* generic status pill */
inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border

/* active filter/sort pill (selected) */
bg-ax-accent/15 border-ax-accent/25 text-ax-accentBright
/* inactive */
bg-white/[0.02] border-white/[0.06] text-zinc-500 hover:text-zinc-300
```

### 5.5 Cards
Standard content card:
```css
bg-white/[0.02]–[0.04] border border-white/[0.06]–[0.08] rounded-xl p-4
```
Stat tile (number + label):
```tsx
<div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
  <div className="font-anton text-2xl text-ax-text">{value}</div>
  <p className="font-barlow-semi text-[10.5px] font-bold uppercase tracking-[0.1em] text-ax-textDim">{label}</p>
</div>
```

### 5.6 Progress / gauge
Linear progress bar:
```tsx
<div className="h-1 w-full rounded-full bg-white/[0.06]">
  <div className="h-full rounded-full bg-ax-accent" style={{ width: `${pct}%` }} />
</div>
```

### 5.7 Consent / scroll-gated agreement panel
A distinct, deliberate pattern (onboarding: player, association) — not a plain checkbox:
```
+-- bordered panel ---------------------+
| Heading (bold)                        |
| +-- inner scrollable text block ----+ |
| |  (fixed height, own scrollbar)    | |
| +------------------------------------+
| [ ] "I have read and accept this consent"  <- disabled until inner block scrolled to end
+----------------------------------------+
```
Design any new consent/legal-agreement screen with this same two-region structure (scrollable body + gated checkbox), not a single free-scrolling page with a checkbox at the bottom.

### 5.8 Step wizard shell
Left rail (desktop) / top block (mobile — stacks correctly already):
```
[done]    Step label       <- done: filled circle + check, connecting line filled
  |
[current] Step label       <- current: filled circle, no check
  |
[ ]       Step label       <- upcoming: outline circle, connecting line unfilled
```
Footer, always `flex justify-between`: outline "Back" button (left) + primary action button (right), the primary button's label changing per step (e.g. "Save & Continue" -> "Finish ->" on the last step).

### 5.9 Empty states
Centered icon (Lucide, muted color) + bold one-line message + a lighter one-line explanation, no border needed if the parent is already a card:
```tsx
<div className="text-center py-10">
  <IconComponent className="w-8 h-8 mx-auto text-zinc-600" />
  <p className="text-sm font-bold text-zinc-400 mt-3">No batches yet</p>
  <p className="text-xs text-zinc-600 mt-1">Create your first batch to start assigning players.</p>
</div>
```

### 5.10 Dashboard shell
```tsx
<div className="min-h-screen bg-ax-bg">
  <DashboardSidebar />   {/* fixed left rail, desktop only, role-filtered nav sections */}
  <DashboardTopBar />    {/* small uppercase route label + avatar-initials chip + chevron */}
  <main className="lg:pl-60 p-6">{children}</main>
</div>
```
**No defined mobile pattern exists yet for the sidebar** — this is the single open design decision that affects every authenticated screen. A bottom tab bar (2–4 most-used items per role) + an overflow sheet for the rest is the recommended native-mobile replacement rather than a hamburger drawer reproducing the full desktop rail.

---

## 6. Layout & Responsive Behavior

- Breakpoint in use: Tailwind's default `lg` (1024px) is the one meaningful breakpoint across the app — most "desktop vs. mobile" conditional classes are `hidden lg:block` / `lg:hidden` / `lg:pl-60` pairs, not a finer-grained responsive system.
- Onboarding wizards: two-column desktop (sidebar + form), collapsing to a single stacked column below `lg`. **This already works correctly on mobile** — verified live at 375×812.
- Dashboard pages: some (`/coach`, `/academy`, `/grading`) already reflow into clean single-column card stacks on mobile. Others (`/association`'s data tables, `/selection`'s candidate cards) do not yet and need a mobile-specific card layout rather than a shrunk table.
- Max content widths appear ad hoc per page (`max-w-lg`, `max-w-[1100px]`, `max-w-[1400px]`) rather than one shared constant — pick a sensible width per screen type rather than assuming a single global content-width token exists.

---

## 7. Accessibility notes worth carrying into new designs

- `ax-textFaint`'s opacity (0.5 on `ax-bg`) was deliberately tuned to clear WCAG AA's 4.5:1 contrast ratio for normal-size text — don't lower it further for a "subtler" look without re-checking contrast.
- Scroll-gated consent checkboxes are a genuine compliance mechanism (DPDP guardian consent, data-sharing agreements) — don't simplify them into a plain checkbox when porting to a new surface.
- Every onboarding OTP/dev-mode banner explicitly labels itself as a dev stub ("Dev mode — no SMS gateway connected") rather than pretending to be a real verification — preserve that honesty in any new build rather than implying a real integration exists before one does.

---

## 8. Quick copy-paste reference

```css
/* Page background */         bg-ax-bg
/* Primary text */            text-ax-text
/* Secondary text */          text-ax-textDim
/* Placeholder/tertiary */    text-ax-textFaint
/* Brand action color */      bg-ax-accent / text-ax-accent / border-ax-accent
/* Brand hover */             hover:bg-ax-accentBright
/* On-accent text */          text-[#1a0e02]
/* Card border */             border-ax-cardBorder
/* Field fill */              bg-ax-fieldBg
/* Heading */                 font-anton uppercase
/* Eyebrow/label */           font-barlow-semi uppercase tracking-[0.14em]-[0.22em] font-bold text-[11px]
/* Standard card */           bg-white/[0.02] border border-white/[0.06] rounded-xl p-4
/* Standard button radius */  rounded-xl
```
