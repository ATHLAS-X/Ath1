/**
 * Hero collage styles — ported from the standalone "AthlasX Hero.html" spec.
 * Scoped entirely to `.hx-stage` (not `:root`): the dark/amber palette here
 * is deliberately separate from the rest of the app's green (athlasx.css)
 * system, and `.hx-stage`'s own custom properties (--bg, --text, --accent...)
 * would otherwise collide with athlasx.css's global tokens of the same name.
 * CSS variables only cascade downward, so scoping them here can't leak out
 * and override anything outside this subtree.
 *
 * Class names are prefixed `hx-` (Hero + X) to avoid any collision with the
 * app's existing `.pw-*` / `.ls-*` / `.sx-*` prefixes.
 */
export const heroStyles = `
/* Token-only selector — reused by pages that need the --hx-* palette
   without the Hero's own full-bleed layout (fixed overflow:hidden, forced
   100vh). Onboarding wizards (normal-flow, scrollable forms) apply
   .hx-tokens; the Hero itself keeps using .hx-stage for both. Values are
   written once here, not duplicated. */
.hx-stage, .hx-tokens {
  --hx-bg:            #0D0D0D;
  --hx-bg-soft:       #141312;
  --hx-text:          #F5F5F0;
  --hx-text-dim:      rgba(245, 245, 240, 0.62);
  --hx-accent:        #FF8A1E;
  --hx-accent-rgb:    255, 138, 30;
  --hx-accent-bright: #FFA64D;

  --hx-overlay-accent-08: rgba(var(--hx-accent-rgb), 0.08);
  --hx-overlay-accent-14: rgba(var(--hx-accent-rgb), 0.14);
  --hx-overlay-accent-22: rgba(var(--hx-accent-rgb), 0.22);

  --hx-seam:        rgba(13, 13, 13, 0.9);
  --hx-gap:         3px;
  --hx-phi2:        2.618rem;
  --hx-card-border: rgba(245, 245, 240, 0.14);
  --hx-field-bg:    rgba(245, 245, 240, 0.06);
  --hx-ease:        cubic-bezier(0.22, 1, 0.36, 1);
}
.hx-stage {
  position: relative;
  width: 100vw;
  min-height: 100vh;
  min-height: 100dvh;
  overflow: hidden;
  background: var(--hx-bg);
  color: var(--hx-text);
  font-family: var(--font-barlow), system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* ---------------------------------------------------------------- COLLAGE */
.hx-collage {
  position: absolute;
  inset: 0;
  display: grid;
  gap: var(--hx-gap);
  background: var(--hx-seam);
  grid-template-columns: 1.618fr 1fr 1fr 0.618fr;
  grid-template-rows: 1fr 1.618fr 1fr;
  grid-template-areas:
    "p1 p2 p3 p3"
    "p1 p4 p5 p7"
    "p6 p4 p5 p7";
}

.hx-panel {
  position: relative;
  overflow: hidden;
  background: var(--hx-bg-soft);
}
.hx-panel::after {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--hx-overlay-accent-08);
  mix-blend-mode: overlay;
  pointer-events: none;
}

.hx-img {
  transform: scale(1.06);
  transition: transform 1.1s var(--hx-ease), filter 0.6s var(--hx-ease);
  will-change: transform;
}
.hx-img--ready { transform: scale(1.001); }
.hx-panel:hover .hx-img { transform: scale(1.05); }

.hx-p1 { grid-area: p1; }
.hx-p2 { grid-area: p2; }
.hx-p3 { grid-area: p3; clip-path: polygon(0 0, 100% 0, 100% 100%, 0 92%); }
.hx-p4 { grid-area: p4; }
.hx-p5 { grid-area: p5; }
.hx-p6 { grid-area: p6; clip-path: polygon(0 8%, 100% 0, 100% 100%, 0 100%); }
.hx-p7 { grid-area: p7; }

/* ------------------------------------------------- GLOBAL DARK VIGNETTE */
.hx-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
  background:
    radial-gradient(115% 95% at 50% 46%,
      rgba(13,13,13,0.0)   0%,
      rgba(13,13,13,0.12) 38%,
      rgba(13,13,13,0.52) 72%,
      rgba(13,13,13,0.86) 100%),
    linear-gradient(to bottom,
      rgba(13,13,13,0.55) 0%,
      rgba(13,13,13,0.0) 24%,
      rgba(13,13,13,0.0) 62%,
      rgba(13,13,13,0.72) 100%);
}

/* ------------------------------------------------------- BRAND OVERLAY */
.hx-brand {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 6vmin;
  pointer-events: none;
}
.hx-brand .hx-eyebrow {
  font-family: var(--font-barlow-semi), sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.42em;
  font-weight: 600;
  font-size: clamp(10px, 1.05vw, 14px);
  color: var(--hx-accent-bright);
  margin: 0 0 0.9rem 0;
  padding-left: 0.42em;
  text-shadow: 0 0.06em 0.5em rgba(0,0,0,0.65), 0 0 10px rgba(0,0,0,0.5);
}
.hx-brand .hx-logotype {
  font-family: var(--font-anton), var(--font-barlow-semi), sans-serif;
  text-transform: uppercase;
  font-weight: 400;
  line-height: 0.84;
  letter-spacing: -0.01em;
  font-size: clamp(64px, 17vw, 320px);
  margin: 0;
  color: var(--hx-text);
  text-shadow: 0 0.06em 0.5em rgba(0,0,0,0.55);
}
.hx-brand .hx-logotype .hx-x { color: var(--hx-accent); }
.hx-brand .hx-tagline {
  font-family: var(--font-barlow), sans-serif;
  font-weight: 500;
  font-size: clamp(15px, 2.1vw, 30px);
  letter-spacing: 0.02em;
  margin: 1.4rem 0 0 0;
  color: var(--hx-text);
}
.hx-brand .hx-tagline b { color: var(--hx-accent-bright); font-weight: 700; }
.hx-brand .hx-rule {
  width: clamp(120px, 18vw, 260px);
  height: 2px;
  margin: 1.8rem auto 0;
  background: linear-gradient(90deg, transparent, var(--hx-accent), transparent);
}

/* --------------------------------------------------------- ACCOUNT BAR */
.hx-auth {
  position: absolute;
  top: 1.4rem;
  right: 1.4rem;
  z-index: 4;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem;
  background: rgba(13, 13, 13, 0.42);
  border: 1px solid var(--hx-card-border);
  border-radius: 12px;
  -webkit-backdrop-filter: blur(14px) saturate(1.2);
  backdrop-filter: blur(14px) saturate(1.2);
  box-shadow: 0 12px 34px -14px rgba(0,0,0,0.6);
  pointer-events: auto;
}
.hx-auth .hx-btn {
  flex: 0 0 auto;
  padding: 0.52rem 1.1rem;
  white-space: nowrap;
  font-family: var(--font-barlow-semi), sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 700;
  font-size: 0.84rem;
  border-radius: 9px;
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
  transition: transform 0.18s var(--hx-ease), background 0.22s var(--hx-ease), border-color 0.22s var(--hx-ease), color 0.22s var(--hx-ease), box-shadow 0.22s var(--hx-ease);
}
.hx-auth .hx-btn:active { transform: translateY(1px); }
.hx-btn-outline {
  background: transparent;
  color: var(--hx-text);
  border: 1.5px solid var(--hx-card-border);
}
.hx-btn-outline:hover {
  border-color: var(--hx-text);
  background: rgba(245,245,240,0.06);
}
.hx-btn-fill {
  background: var(--hx-accent);
  color: #1a0e02;
  border: 1.5px solid var(--hx-accent);
  box-shadow: 0 8px 22px -8px rgba(var(--hx-accent-rgb), 0.7);
}
.hx-btn-fill:hover {
  background: var(--hx-accent-bright);
  border-color: var(--hx-accent-bright);
  box-shadow: 0 10px 26px -8px rgba(var(--hx-accent-rgb), 0.85);
}

/* corner brandmark, top-left */
.hx-corner {
  position: absolute;
  top: var(--hx-phi2);
  left: var(--hx-phi2);
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 0.55rem;
  pointer-events: none;
}
.hx-corner .hx-dot {
  width: 12px; height: 12px; border-radius: 50%;
  background: var(--hx-accent);
  box-shadow: 0 0 14px 1px rgba(var(--hx-accent-rgb), 0.8);
}
.hx-corner .hx-mark {
  font-family: var(--font-barlow-semi), sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.22em;
  font-weight: 700;
  font-size: 0.82rem;
  color: var(--hx-text);
}
.hx-corner .hx-mark span { color: var(--hx-accent); }

/* ============================ RESPONSIVE — down to 375px ============== */
@media (max-width: 860px) {
  .hx-auth { width: clamp(280px, 42vw, 360px); }
  .hx-brand .hx-logotype { font-size: clamp(56px, 20vw, 200px); }
}

@media (max-width: 640px) {
  .hx-stage { min-height: 100dvh; }
  .hx-collage {
    position: absolute;
    inset: 0;
    grid-template-columns: 1fr;
    grid-template-rows: 1.618fr 1fr 1fr;
    grid-template-areas:
      "p1"
      "p3"
      "p4";
  }
  .hx-p2, .hx-p5, .hx-p6, .hx-p7 { display: none; }
  .hx-p3 { clip-path: none; }
  .hx-p6 { clip-path: none; }

  .hx-brand { justify-content: flex-start; padding-top: 16vh; }
  .hx-brand .hx-logotype { font-size: clamp(64px, 22vw, 130px); }
  .hx-brand .hx-tagline { font-size: clamp(14px, 4.4vw, 20px); }

  .hx-corner { top: 1.4rem; left: 1.4rem; }

  .hx-auth {
    top: 1.3rem;
    right: 1.3rem;
    left: auto;
    bottom: auto;
  }
  .hx-auth .hx-btn { padding: 0.5rem 0.9rem; font-size: 0.8rem; }
}

@media (max-width: 380px) {
  .hx-brand .hx-logotype { font-size: clamp(54px, 24vw, 96px); }
  .hx-auth { padding: 1.2rem 1.15rem calc(1.25rem + env(safe-area-inset-bottom, 0px)); }
}

/* ===================================================================
   "WHAT WE DO" SECTION (LandingSections.tsx) — same .hx-stage class is
   reused verbatim on this section's root (not a second declaration of
   --hx-* tokens), so it inherits the identical palette/spacing/easing
   values defined once above. Layout-only rules below are scoped under
   .wd-section so they don't affect the Hero's own full-bleed sizing.
   =================================================================== */
.wd-section {
  min-height: 0;
  width: 100%;
  overflow: visible;
  padding: var(--hx-phi2) var(--hx-phi2);
}
.wd-shell { max-width: 1100px; margin: 0 auto; }

.wd-eyebrow {
  font-family: var(--font-barlow-semi), sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.42em;
  font-weight: 600;
  font-size: clamp(10px, 1.05vw, 14px);
  color: var(--hx-accent-bright);
  margin: 0 0 0.9rem 0;
  padding-left: 0.42em;
}
.wd-heading {
  font-family: var(--font-anton), var(--font-barlow-semi), sans-serif;
  text-transform: uppercase;
  font-weight: 400;
  line-height: 0.96;
  letter-spacing: -0.01em;
  font-size: clamp(28px, 4.4vw, 56px);
  margin: 0 0 1rem 0;
  color: var(--hx-text);
  max-width: 760px;
}
.wd-heading .wd-accent { color: var(--hx-accent); }
.wd-sub {
  font-family: var(--font-barlow), sans-serif;
  font-weight: 500;
  font-size: clamp(14px, 1.3vw, 17px);
  line-height: 1.6;
  color: var(--hx-text-dim);
  max-width: 620px;
  margin: 0 0 calc(var(--hx-phi2) * 0.9) 0;
}

/* Glass cards — same surface treatment as .hx-auth (the account bar) */
.wd-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}
.wd-card {
  position: relative;
  padding: 1.4rem 1.3rem;
  background: rgba(13, 13, 13, 0.42);
  border: 1px solid var(--hx-card-border);
  border-radius: 14px;
  -webkit-backdrop-filter: blur(14px) saturate(1.2);
  backdrop-filter: blur(14px) saturate(1.2);
  box-shadow: 0 12px 34px -14px rgba(0,0,0,0.6);
  transition: transform 0.22s var(--hx-ease), border-color 0.22s var(--hx-ease), box-shadow 0.22s var(--hx-ease);
}
.wd-card:hover {
  transform: translateY(-3px);
  border-color: var(--hx-accent);
  box-shadow: 0 16px 40px -16px rgba(var(--hx-accent-rgb), 0.35);
}
.wd-card-role {
  font-family: var(--font-barlow-semi), sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--hx-accent-bright);
  margin: 0 0 0.55rem 0;
}
.wd-card-d {
  font-family: var(--font-barlow), sans-serif;
  font-size: 0.85rem;
  line-height: 1.55;
  color: var(--hx-text-dim);
  margin: 0 0 1rem 0;
  min-height: 3.4em;
}
.wd-card .hx-btn { width: 100%; text-align: center; padding: 0.5rem 0.8rem; font-size: 0.78rem; }

/* Small accent thumbnails reusing the Hero's own collage images for visual
   continuity — not new assets. */
.wd-thumbs { display: flex; gap: 0.6rem; margin-bottom: calc(var(--hx-phi2) * 0.7); }
.wd-thumb {
  position: relative;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  overflow: hidden;
  border: 1.5px solid var(--hx-card-border);
  background: var(--hx-bg-soft);
  flex-shrink: 0;
}
.wd-thumb img { object-fit: cover; }

/* Footer — minimal, same token source as Hero, not athlasx.css */
.wd-foot {
  padding: 1.2rem var(--hx-phi2);
  border-top: 1px solid var(--hx-card-border);
  font-family: var(--font-barlow), sans-serif;
  font-size: 0.78rem;
  color: var(--hx-text-dim);
  text-align: center;
}

@media (max-width: 860px) {
  .wd-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 640px) {
  .wd-section { padding: 1.6rem 1.3rem; }
  .wd-grid { grid-template-columns: 1fr; }
}

/* ----------------------------- prefers-reduced-motion ----------------- */
@media (prefers-reduced-motion: reduce) {
  .hx-img {
    transition: none !important;
    transform: none !important;
  }
  .hx-img--ready { transform: none !important; }
  .hx-panel:hover .hx-img { transform: none !important; }
  .wd-card { transition: none !important; }
  .wd-card:hover { transform: none !important; }
  .hx-stage *, .hx-stage *::before, .hx-stage *::after {
    animation-duration: 0.001ms !important;
    transition-duration: 0.001ms !important;
  }
}
`;
