/**
 * Auth page (sign-in/sign-up) layout styles — ported from the standalone
 * "AthlasX Auth.html" spec. Deliberately does NOT redeclare --hx-* tokens:
 * the auth page's root reuses the `.hx-stage` class verbatim (same as the
 * "what we do" section in Hero/styles.ts) so it inherits the single
 * --hx-* definition from there. Reduced-motion handling for everything in
 * here is covered by that same reuse — `.hx-stage *` in the existing
 * @media (prefers-reduced-motion) block already catches every descendant,
 * so no second block is declared here. Class names are prefixed `ax-`
 * (Auth + X) to avoid colliding with `.hx-*` / `.wd-*` / `.ls-*` / `.sx-*`.
 */
export const authStyles = `
.auth-stage { display: grid; grid-template-columns: 1fr 2fr; }

/* ---------------------------------------------------------------- SHOWCASE */
.ax-showcase { position: relative; overflow: hidden; background: var(--hx-seam); }
.ax-grid {
  position: absolute;
  inset: 0;
  display: grid;
  gap: var(--hx-gap);
  grid-template-columns: 1.618fr 1fr 0.618fr;
  grid-template-rows: 1fr 1.618fr 1fr;
  grid-template-areas:
    "a a b"
    "a a c"
    "d e c";
}
.ax-tile { position: relative; overflow: hidden; background: var(--hx-bg-soft); }
.ax-tile::after {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--hx-overlay-accent-08);
  mix-blend-mode: overlay;
  pointer-events: none;
}
.ax-ta { grid-area: a; }
.ax-tb { grid-area: b; }
.ax-tc { grid-area: c; }
.ax-td { grid-area: d; }
.ax-te { grid-area: e; }

.ax-vignette {
  position: absolute; inset: 0; z-index: 2; pointer-events: none;
  background:
    radial-gradient(120% 100% at 40% 42%,
      rgba(13,13,13,0) 0%, rgba(13,13,13,0.12) 40%,
      rgba(13,13,13,0.55) 74%, rgba(13,13,13,0.9) 100%),
    linear-gradient(90deg, rgba(13,13,13,0) 55%, rgba(13,13,13,0.7) 100%);
}
.ax-copy {
  position: absolute; z-index: 3; left: var(--hx-phi2); bottom: var(--hx-phi2);
  right: var(--hx-phi2); max-width: 30rem;
}
.ax-eyebrow {
  font-family: var(--font-barlow-semi), sans-serif; text-transform: uppercase;
  letter-spacing: 0.32em; font-weight: 700; font-size: 12px;
  color: var(--hx-accent-bright); margin: 0 0 0.7rem 0;
  text-shadow: 0 0.06em 0.5em rgba(0,0,0,0.65), 0 0 10px rgba(0,0,0,0.5);
}
.ax-h2 {
  font-family: var(--font-anton), var(--font-barlow-semi), sans-serif;
  text-transform: uppercase; font-weight: 400; line-height: 0.92; letter-spacing: -0.01em;
  font-size: clamp(34px, 4vw, 60px); margin: 0; color: var(--hx-text);
  text-shadow: 0 0.06em 0.5em rgba(0,0,0,0.55);
}
.ax-h2 b { color: var(--hx-accent); }
.ax-p {
  margin: 1rem 0 0; font-size: 1rem; line-height: 1.5;
  color: rgba(245,245,240,0.82); max-width: 24rem;
}

/* ------------------------------------------------------------------- PANEL */
.ax-panel {
  position: relative; display: flex; flex-direction: column; justify-content: center;
  padding: clamp(1.75rem, 4vw, 3.4rem); background: var(--hx-bg);
}
.ax-panel::before {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(120% 60% at 100% 0%, var(--hx-overlay-accent-08), transparent 60%);
}
.ax-form-wrap { position: relative; width: 100%; max-width: 30rem; margin: 0 auto; }

.ax-kicker {
  font-family: var(--font-barlow-semi), sans-serif; text-transform: uppercase;
  letter-spacing: 0.2em; font-size: 11px; font-weight: 700;
  color: var(--hx-accent-bright); margin: 0 0 0.5rem 0;
}
.ax-title {
  font-family: var(--font-anton), sans-serif; text-transform: uppercase;
  font-weight: 400; line-height: 0.95; font-size: clamp(30px, 4.5vw, 46px);
  margin: 0 0 0.45rem 0; color: var(--hx-text);
}
.ax-subtitle { margin: 0 0 1.6rem 0; font-size: 0.92rem; color: var(--hx-text-dim); }

.ax-toggle {
  display: grid; grid-template-columns: 1fr 1fr; gap: 0.25rem;
  padding: 0.28rem; margin-bottom: 1.5rem;
  background: var(--hx-field-bg); border: 1px solid var(--hx-card-border); border-radius: 11px;
}
.ax-toggle button {
  appearance: none; cursor: pointer; border: 0; border-radius: 8px;
  padding: 0.62rem 0.5rem; font-family: var(--font-barlow-semi), sans-serif;
  text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700;
  font-size: 0.92rem; color: var(--hx-text-dim); background: transparent;
  transition: background 0.25s var(--hx-ease), color 0.25s var(--hx-ease);
}
.ax-toggle button[aria-selected="true"] {
  background: var(--hx-accent); color: #1a0e02;
  box-shadow: 0 6px 18px -8px rgba(var(--hx-accent-rgb), 0.7);
}

.ax-field-label {
  font-family: var(--font-barlow-semi), sans-serif; text-transform: uppercase;
  letter-spacing: 0.14em; font-size: 11px; font-weight: 700;
  color: var(--hx-text-dim); margin: 0 0 0.55rem 0;
}
.ax-roles { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem; margin-bottom: 1.4rem; }
.ax-role {
  cursor: pointer; text-align: left; padding: 0.7rem 0.8rem; border-radius: 10px;
  background: var(--hx-field-bg); border: 1.5px solid var(--hx-card-border);
  transition: border-color 0.2s var(--hx-ease), background 0.2s var(--hx-ease), transform 0.15s var(--hx-ease);
  display: flex; align-items: center; gap: 0.6rem;
}
.ax-role:hover { border-color: rgba(245,245,240,0.32); }
.ax-role:active { transform: translateY(1px); }
.ax-role[aria-pressed="true"] { border-color: var(--hx-accent); background: var(--hx-overlay-accent-14); }
.ax-role-ico {
  width: 30px; height: 30px; flex: 0 0 auto; border-radius: 8px;
  display: grid; place-items: center;
  background: rgba(var(--hx-accent-rgb), 0.16); color: var(--hx-accent-bright);
}
.ax-role[aria-pressed="true"] .ax-role-ico { background: var(--hx-accent); color: #1a0e02; }
.ax-role-ico svg { width: 17px; height: 17px; display: block; }
.ax-role-rl { display: flex; flex-direction: column; line-height: 1.15; }
.ax-role-rl b { font-size: 0.92rem; font-weight: 700; color: var(--hx-text); }
.ax-role-rl small { font-size: 0.68rem; color: var(--hx-text-dim); }

.ax-between {
  display: flex; align-items: center; justify-content: space-between;
  margin: 0.1rem 0 1.1rem; font-size: 0.82rem; color: var(--hx-text-dim);
}
.ax-between label { display: flex; align-items: center; gap: 0.45rem; cursor: pointer; }
.ax-between input { accent-color: var(--hx-accent); width: 15px; height: 15px; }
.ax-between a { color: var(--hx-accent-bright); text-decoration: none; }
.ax-between a:hover { text-decoration: underline; }

.ax-divider {
  display: flex; align-items: center; gap: 0.8rem;
  margin: 1.3rem 0; color: var(--hx-text-dim); font-size: 0.74rem;
  text-transform: uppercase; letter-spacing: 0.14em;
}
.ax-divider::before, .ax-divider::after { content: ""; flex: 1; height: 1px; background: var(--hx-card-border); }

.ax-btn-ghost {
  width: 100%; padding: 0.82rem 0.6rem; cursor: pointer;
  font-family: var(--font-barlow-semi), sans-serif; text-transform: uppercase;
  letter-spacing: 0.06em; font-weight: 700; font-size: 0.92rem;
  border-radius: 10px; border: 1.5px solid var(--hx-card-border);
  background: transparent; color: var(--hx-text);
  transition: border-color 0.2s var(--hx-ease), background 0.2s var(--hx-ease), transform 0.15s var(--hx-ease);
}
.ax-btn-ghost:hover { border-color: var(--hx-text); background: rgba(245,245,240,0.06); }
.ax-btn-ghost:active { transform: translateY(1px); }
.ax-btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }

.ax-swap { margin: 1.4rem 0 0; text-align: center; font-size: 0.88rem; color: var(--hx-text-dim); }
.ax-swap button {
  appearance: none; background: none; border: 0; cursor: pointer; padding: 0;
  font: inherit; font-weight: 700; color: var(--hx-accent-bright);
}
.ax-swap button:hover { text-decoration: underline; }

.ax-legal { margin: 1.4rem 0 0; font-size: 0.72rem; line-height: 1.45; color: var(--hx-text-dim); text-align: center; }
.ax-legal a { color: var(--hx-accent-bright); text-decoration: none; }
.ax-legal a:hover { text-decoration: underline; }

.ax-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.7rem; }

/* ============================ RESPONSIVE =============================== */
@media (max-width: 880px) {
  .auth-stage { grid-template-columns: 1fr; }
  .ax-showcase { min-height: 38vh; }
  .ax-grid {
    grid-template-columns: 1.618fr 1fr 0.618fr;
    grid-template-rows: 1fr 1fr;
    grid-template-areas: "a b c" "a d e";
  }
  .ax-h2 { font-size: clamp(26px, 7vw, 40px); }
  .ax-p { display: none; }
}
@media (max-width: 480px) {
  .ax-showcase { min-height: 30vh; }
  .ax-roles { grid-template-columns: 1fr; }
  .ax-row2 { grid-template-columns: 1fr; gap: 0; }
  .ax-panel { padding: 1.5rem 1.25rem 2rem; }
}
`;
