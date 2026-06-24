"use client";

import { signOut } from "next-auth/react";

export interface ShellStep {
  label: string;
  optional?: boolean;
}

const ROLE_AVATAR: Record<string, string> = { player: "P", coach: "C", academy: "A", scout: "S" };

const RAIL_IMAGE: Record<string, string> = {
  player:  "/images/hero/Badminton2.jpg",
  coach:   "/images/hero/Baseball.jpg",
  academy: "/images/hero/Academy.jpg",
  scout:   "/images/hero/football2.jpg",
};

interface Props {
  role: "player" | "coach" | "academy" | "scout";
  eyebrow: string;
  title: React.ReactNode;
  desc: string;
  steps?: ShellStep[];
  stepIdx?: number;
  onStepClick?: (i: number) => void;
  footMeta: string;
  progressPct: number;
  nextLabel: string;
  onNext: () => void;
  nextDisabled?: boolean;
  onBack?: () => void;
  backHidden?: boolean;
  backLabel?: string;
  backDisabled?: boolean;
  onSkip?: () => void;
  showSkip?: boolean;
  userName: string;
  children: React.ReactNode;
  belowBody?: React.ReactNode;
}

export default function OnboardingShell(p: Props) {
  const railImg = RAIL_IMAGE[p.role];

  return (
    <div className="obs-root">
      <style dangerouslySetInnerHTML={{ __html: SHELL_STYLES }} />
      <div className="obs-ob">

        {/* LEFT RAIL */}
        <aside className="obs-rail">
          <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={railImg}
              alt=""
              style={{
                position: "absolute", inset: 0, width: "100%", height: "100%",
                objectFit: "cover", objectPosition: "center 30%",
                filter: "saturate(1.1) contrast(1.05) brightness(1)",
              }}
            />
            {/* gradient overlay so text is always readable over any image */}
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(to bottom, rgba(240,236,228,0.92) 0%, rgba(240,236,228,0.7) 30%, rgba(240,236,228,0.2) 60%, rgba(240,236,228,0) 100%)",
            }} />
          </div>

          <div className="obs-brandmark">
            ATHLAS<span>X</span>
          </div>
          <div className="obs-lead">
            <p className="obs-eyebrow">{p.eyebrow}</p>
            <h1 className="obs-lead-title">{p.title}</h1>
            <p className="obs-lead-desc">{p.desc}</p>
          </div>

          {p.steps && p.steps.length > 0 && (
            <nav className="obs-stepper" aria-label="Onboarding steps">
              {p.steps.map((s, i) => {
                const idx = p.stepIdx ?? 0;
                const state = i < idx ? "done" : i === idx ? "current" : "todo";
                const clickable = !!p.onStepClick && i <= idx;
                return (
                  <div
                    key={s.label}
                    className={`obs-step obs-step--${state}${s.optional ? " optional" : ""}`}
                    onClick={() => clickable && p.onStepClick!(i)}
                    style={{ cursor: clickable ? "pointer" : "default" }}
                  >
                    <span className="obs-step-num">{state === "done" ? "✓" : i + 1}</span>
                    <span className="obs-step-lbl">{s.label}</span>
                  </div>
                );
              })}
            </nav>
          )}

          <div className="obs-foot">
            <span className="obs-save-dot" />
            All progress saved automatically
          </div>
        </aside>

        {/* RIGHT FORM */}
        <main className="obs-form-side">
          <div className="obs-topbar">
            <div className="obs-acct">
              <span>{p.userName}</span>
              <span className="obs-av">{ROLE_AVATAR[p.role]}</span>
            </div>
            <button
              type="button"
              className="obs-logout"
              onClick={() => signOut({ callbackUrl: "/auth/login" })}
            >
              Logout
            </button>
          </div>

          <div className="obs-scroller">
            <div className="obs-form-body">
              <div className="obs-progress-line">
                <i style={{ width: `${p.progressPct}%` }} />
              </div>
              {p.children}
              {p.belowBody}
            </div>
          </div>

          <div className="obs-form-foot">
            <div className="obs-foot-meta">{p.footMeta}</div>
            <div className="obs-foot-btns">
              {p.showSkip && (
                <button type="button" className="obs-btn obs-btn--text" onClick={p.onSkip}>
                  Skip
                </button>
              )}
              {!p.backHidden && (
                <button type="button" className="obs-btn obs-btn--ghost" onClick={p.onBack} disabled={p.backDisabled}>
                  {p.backLabel ?? "Back"}
                </button>
              )}
              <button
                type="button"
                className="obs-btn obs-btn--fill"
                onClick={p.onNext}
                disabled={p.nextDisabled}
              >
                {p.nextLabel}
              </button>
            </div>
          </div>
        </main>

      </div>
    </div>
  );
}

const SHELL_STYLES = `
/* ── design tokens ── */
.obs-root {
  --obs-bg:           #0D0D0D;
  --obs-bg-soft:      #141312;
  --obs-text:         #F5F5F0;
  --obs-text-dim:     rgba(245,245,240,0.62);
  --obs-text-faint:   rgba(245,245,240,0.4);
  --obs-accent:       #FF8A1E;
  --obs-accent-rgb:   255,138,30;
  --obs-accent-b:     #FFA64D;
  --obs-ov08:         rgba(255,138,30,0.08);
  --obs-ov14:         rgba(255,138,30,0.14);
  --obs-ov22:         rgba(255,138,30,0.22);
  --obs-phi2:         2.618rem;
  --obs-border:       rgba(245,245,240,0.14);
  --obs-field:        rgba(245,245,240,0.06);
  --obs-ok:           #38d39f;
  --obs-ease:         cubic-bezier(0.22,1,0.36,1);
  --obs-font-body:    'Barlow', system-ui, sans-serif;
  --obs-font-semi:    'Barlow Semi Condensed', sans-serif;
  --obs-font-display: 'Anton', sans-serif;
}

/* ── root + grid ── */
.obs-root {
  width: 100%; min-height: 100vh; min-height: 100dvh;
  display: flex; flex-direction: column;
  background: var(--obs-bg); color: var(--obs-text);
  font-family: var(--obs-font-body); -webkit-font-smoothing: antialiased;
}
.obs-ob {
  display: grid; grid-template-columns: 1fr 2fr;
  flex: 1; min-height: 100vh; min-height: 100dvh; width: 100%;
  background: var(--obs-bg);
}

/* ── left rail ── */
.obs-rail {
  position: relative; overflow: hidden;
  display: flex; flex-direction: column;
  padding: var(--obs-phi2);
  background: #f0ece4;
  border-right: 1px solid var(--obs-border);
}

/* rail background image */
.obs-rail-bg {
  position: absolute; inset: 0; z-index: 0; pointer-events: none;
}
.obs-rail-bg img {
  position: absolute; inset: 0; width: 100%; height: 100%;
  object-fit: contain; object-position: center bottom;
  filter: saturate(1.1) contrast(1.05) brightness(1);
}

/* all direct rail children sit above the image */
.obs-rail > * { position: relative; z-index: 1; }

.obs-brandmark {
  font-family: var(--obs-font-semi); text-transform: uppercase;
  letter-spacing: 0.22em; font-weight: 700; font-size: 0.95rem; color: #1a1a1a;
}
.obs-brandmark span { color: var(--obs-accent); }

.obs-lead { margin-top: 1.6rem; }
.obs-eyebrow {
  font-family: var(--obs-font-semi); text-transform: uppercase;
  letter-spacing: 0.2em; font-size: 11px; font-weight: 700;
  color: var(--obs-accent-b); margin: 0 0 0.55rem 0;
}
.obs-lead-title {
  font-family: var(--obs-font-display); text-transform: uppercase;
  font-weight: 400; line-height: 0.92; margin: 0;
  font-size: clamp(28px, 2.6vw, 40px); color: #1a1a1a;
}
.obs-lead-title b { color: var(--obs-accent); }
.obs-lead-desc {
  margin: 0.8rem 0 0; font-size: 0.92rem;
  line-height: 1.5; color: rgba(26,26,26,0.7); max-width: 22rem;
}

/* stepper */
.obs-stepper { margin: 2rem 0 0; display: flex; flex-direction: column; gap: 0.15rem; }
.obs-step {
  display: flex; align-items: center; gap: 0.85rem;
  padding: 0.5rem 0.4rem; border-radius: 9px;
  color: rgba(26,26,26,0.6);
  transition: background 0.2s var(--obs-ease), color 0.2s var(--obs-ease);
}
.obs-step:hover { background: rgba(245,245,240,0.04); }
.obs-step-num {
  flex: 0 0 auto; width: 27px; height: 27px; border-radius: 50%;
  display: grid; place-items: center; font-size: 0.78rem; font-weight: 700;
  font-family: var(--obs-font-semi);
  border: 1.5px solid rgba(26,26,26,0.25); background: transparent; color: rgba(26,26,26,0.6);
  transition: all 0.25s var(--obs-ease);
}
.obs-step-lbl { font-size: 0.9rem; font-weight: 600; }
.obs-step--done { color: #1a1a1a; }
.obs-step--done .obs-step-num { border-color: var(--obs-accent); background: var(--obs-ov14); color: var(--obs-accent-b); }
.obs-step--current { color: #1a1a1a; }
.obs-step--current .obs-step-num { border-color: var(--obs-accent); background: var(--obs-accent); color: #1a0e02; box-shadow: 0 0 0 4px var(--obs-ov22); }
.obs-step.optional .obs-step-lbl::after { content: " · optional"; color: var(--obs-text-faint); font-weight: 500; font-size: 0.72rem; }

.obs-foot {
  margin-top: auto; padding-top: 1.5rem; font-size: 0.76rem;
  color: rgba(26,26,26,0.5); display: flex; align-items: center; gap: 0.5rem;
}
.obs-save-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--obs-ok); box-shadow: 0 0 8px var(--obs-ok); flex: 0 0 auto; }

/* ── right form ── */
.obs-form-side {
  position: relative; display: flex; flex-direction: column;
  background: var(--obs-bg); min-height: 100vh; min-height: 100dvh;
}
.obs-form-side::before {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(110% 50% at 100% 0%, var(--obs-ov08), transparent 55%);
}

.obs-topbar {
  position: relative; z-index: 2;
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  padding: 1.1rem clamp(1.25rem, 3.5vw, 3rem);
  border-bottom: 1px solid var(--obs-border);
}
.obs-acct { display: flex; align-items: center; gap: 0.7rem; font-size: 0.84rem; color: var(--obs-text-dim); }
.obs-av {
  width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center;
  background: var(--obs-ov14); color: var(--obs-accent-b);
  font-weight: 700; font-size: 0.82rem; font-family: var(--obs-font-semi);
}
.obs-logout {
  appearance: none; cursor: pointer; background: transparent;
  border: 1px solid rgba(248,113,113,0.35); color: #F87171;
  font-size: 12px; font-weight: 600; padding: 5px 12px; border-radius: 8px;
  transition: background 0.14s, border-color 0.14s; font-family: var(--obs-font-semi);
}
.obs-logout:hover { background: rgba(248,113,113,0.1); border-color: rgba(248,113,113,0.6); }

.obs-scroller { position: relative; z-index: 1; flex: 1; overflow-y: auto; }
.obs-form-body {
  width: 100%; max-width: 40rem; margin: 0 auto;
  padding: clamp(1.5rem, 3.5vw, 2.8rem) clamp(1.25rem, 3.5vw, 3rem) 1.5rem;
}
.obs-progress-line { height: 3px; background: var(--obs-border); border-radius: 3px; overflow: hidden; margin-bottom: 1.6rem; }
.obs-progress-line i { display: block; height: 100%; background: linear-gradient(90deg, var(--obs-accent), var(--obs-accent-b)); transition: width 0.5s var(--obs-ease); }

.obs-form-foot {
  position: relative; z-index: 2;
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  padding: 1rem clamp(1.25rem, 3.5vw, 3rem); border-top: 1px solid var(--obs-border);
  background: rgba(13,13,13,0.6); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
}
.obs-foot-meta { font-size: 0.82rem; color: var(--obs-text-dim); }
.obs-foot-btns { display: flex; gap: 0.6rem; }
.obs-btn {
  padding: 0.78rem 1.5rem; cursor: pointer;
  font-family: var(--obs-font-semi); text-transform: uppercase;
  letter-spacing: 0.06em; font-weight: 700; font-size: 0.92rem;
  border-radius: 9px; border: 1.5px solid transparent; white-space: nowrap;
  transition: transform 0.16s var(--obs-ease), background 0.2s var(--obs-ease), border-color 0.2s var(--obs-ease), opacity 0.2s;
}
.obs-btn:active { transform: translateY(1px); }
.obs-btn--fill { background: var(--obs-accent); color: #1a0e02; border-color: var(--obs-accent); box-shadow: 0 8px 22px -8px var(--obs-ov22); }
.obs-btn--fill:hover { background: var(--obs-accent-b); border-color: var(--obs-accent-b); }
.obs-btn--fill:disabled { opacity: 0.4; cursor: default; pointer-events: none; }
.obs-btn--ghost { background: transparent; color: var(--obs-text); border-color: var(--obs-border); }
.obs-btn--ghost:hover { border-color: var(--obs-text); background: rgba(245,245,240,0.06); }
.obs-btn--text { background: transparent; color: var(--obs-text-dim); }
.obs-btn--text:hover { color: var(--obs-text); }

/* ── responsive ── */
@media (max-width: 900px) {
  .obs-ob { grid-template-columns: 1fr; }
  .obs-rail { padding: 1.4rem 1.4rem 1.6rem; }
  .obs-lead-desc { display: none; }
  .obs-stepper { flex-direction: row; flex-wrap: wrap; gap: 0.4rem; margin-top: 1.3rem; }
  .obs-step { padding: 0.4rem 0.7rem 0.4rem 0.4rem; background: rgba(245,245,240,0.04); }
  .obs-step-lbl { font-size: 0.8rem; }
  .obs-step.optional .obs-step-lbl::after { content: ""; }
  .obs-foot { display: none; }
}
@media (max-width: 560px) {
  .obs-topbar { flex-direction: column; align-items: stretch; }
  .obs-acct { display: none; }
  .obs-step-lbl { display: none; }
  .obs-step { padding: 0.4rem; }
  .obs-form-foot { flex-direction: column-reverse; align-items: stretch; }
  .obs-foot-btns { justify-content: space-between; }
  .obs-foot-btns .obs-btn { flex: 1; text-align: center; }
}
`;
