"use client";

import Image from "next/image";
import { signOut } from "next-auth/react";

/**
 * Shared chrome for all four onboarding wizards (Player/Coach/Academy/Scout),
 * ported from "AthlasX Onboarding.html" (the rail + topbar + scroller + footer
 * layout). Each wizard keeps its own state/handlers/step components — this
 * only replaces the outer shell each one used to hand-roll (pw-shell,
 * cw-shell, sw-shell, ap-shell) with one shared, visually-faithful version.
 *
 * Deliberately NOT ported: the HTML demo's #roleswitch topbar and its
 * resetRole() logic for flipping between all four flows client-side. Every
 * page that renders this shell is already locked server-side to one role
 * (each onboarding/<role>/page.tsx does getServerSession + role check +
 * redirect("/dashboard") on mismatch) — a role-switch control here would
 * visually imply a capability that doesn't exist.
 */

export interface ShellStep {
  label: string;
  optional?: boolean;
}

const ROLE_AVATAR: Record<string, string> = { player: "P", coach: "C", academy: "A", scout: "S" };

/* Rail backdrop per role. */
const RAIL_IMAGE: Record<string, string> = {
  player: "/images/onboarding/player.jpg",
  coach: "/images/onboarding/coach.jpg",
  academy: "/images/hero/Badminton2.jpg",
  scout: "/images/onboarding/scout.jpg",
};

interface Props {
  role: "player" | "coach" | "academy" | "scout";
  eyebrow: string;
  title: React.ReactNode;
  desc: string;
  /** Omit for the academy single-page form (no stepper). */
  steps?: ShellStep[];
  stepIdx?: number;
  /** Lets the rail stepper jump back to any already-visited step. */
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
  /** Extra content rendered above the nav buttons (errors, saved-badges). */
  belowBody?: React.ReactNode;
}

export default function OnboardingShell(p: Props) {
  return (
    <div className="hx-tokens obs-root">
      <style dangerouslySetInnerHTML={{ __html: SHELL_STYLES }} />
      <div className="obs-ob">
        <aside className="obs-rail">
          <div className="obs-rail-bg">
            <Image src={RAIL_IMAGE[p.role]} alt="" fill sizes="33vw" priority quality={70} />
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
.obs-root { color: var(--hx-text); font-family: var(--font-barlow), system-ui, sans-serif; }
.obs-ob { display: grid; grid-template-columns: 1fr 2.6fr; min-height: 100vh; min-height: 100dvh; background: var(--hx-bg); }

.obs-rail {
  position: sticky; top: 0; height: 100vh; height: 100dvh; overflow: hidden; display: flex; flex-direction: column;
  padding: var(--hx-phi2); background: var(--hx-bg-soft); border-right: 1px solid var(--hx-card-border);
}
.obs-rail-bg { position: absolute; inset: 0; z-index: 0; pointer-events: none; }
.obs-rail-bg img { object-fit: cover; object-position: 50% 35%; filter: saturate(1.05) contrast(1.05) brightness(0.95); }
.obs-rail-bg::after {
  content: ""; position: absolute; inset: 0;
  /* Lighter than the original wash — just enough at the very top/bottom for
     the brandmark and step labels to stay readable over any photo, without
     flattening the image into a near-black silhouette. */
  background:
    linear-gradient(180deg, rgba(13,13,13,0.45) 0%, rgba(13,13,13,0.35) 35%, rgba(13,13,13,0.62) 100%),
    radial-gradient(120% 80% at 0% 0%, var(--hx-overlay-accent-08), transparent 55%);
}
.obs-rail > *:not(.obs-rail-bg) { position: relative; z-index: 1; }
.obs-brandmark { font-family: var(--font-barlow-semi), sans-serif; text-transform: uppercase; letter-spacing: 0.22em; font-weight: 700; font-size: 0.95rem; color: var(--hx-text); }
.obs-brandmark span { color: var(--hx-accent); }
.obs-lead { margin-top: 1.6rem; }
.obs-eyebrow { font-family: var(--font-barlow-semi), sans-serif; text-transform: uppercase; letter-spacing: 0.2em; font-size: 11px; font-weight: 700; color: var(--hx-accent-bright); margin: 0 0 0.55rem 0; }
.obs-lead-title { font-family: var(--font-anton), sans-serif; text-transform: uppercase; font-weight: 400; line-height: 0.92; margin: 0; font-size: clamp(28px, 2.6vw, 40px); color: var(--hx-text); }
.obs-lead-title b { color: var(--hx-accent); }
.obs-lead-desc { margin: 0.8rem 0 0; font-size: 0.92rem; line-height: 1.5; color: var(--hx-text-dim); max-width: 22rem; }

.obs-stepper { margin: 2rem 0 0; display: flex; flex-direction: column; gap: 0.15rem; }
.obs-step { display: flex; align-items: center; gap: 0.85rem; padding: 0.5rem 0.4rem; border-radius: 9px; color: var(--hx-text-dim); transition: background 0.2s var(--hx-ease), color 0.2s var(--hx-ease); }
.obs-step:hover { background: rgba(245,245,240,0.04); }
.obs-step-num { flex: 0 0 auto; width: 27px; height: 27px; border-radius: 50%; display: grid; place-items: center; font-size: 0.78rem; font-weight: 700; font-family: var(--font-barlow-semi), sans-serif; border: 1.5px solid var(--hx-card-border); background: transparent; color: var(--hx-text-dim); transition: all 0.25s var(--hx-ease); }
.obs-step-lbl { font-size: 0.9rem; font-weight: 600; }
.obs-step-lbl small { display: block; font-size: 0.7rem; font-weight: 500; color: rgba(245,245,240,0.4); }
.obs-step--done { color: var(--hx-text); }
.obs-step--done .obs-step-num { border-color: var(--hx-accent); background: var(--hx-overlay-accent-14); color: var(--hx-accent-bright); }
.obs-step--current { color: var(--hx-text); }
.obs-step--current .obs-step-num { border-color: var(--hx-accent); background: var(--hx-accent); color: #1a0e02; box-shadow: 0 0 0 4px var(--hx-overlay-accent-22); }
.obs-step.optional .obs-step-lbl::after { content: " · optional"; color: rgba(245,245,240,0.4); font-weight: 500; font-size: 0.72rem; }

.obs-foot { margin-top: auto; padding-top: 1.5rem; font-size: 0.76rem; color: rgba(245,245,240,0.4); display: flex; align-items: center; gap: 0.5rem; }
.obs-save-dot { width: 7px; height: 7px; border-radius: 50%; background: #38d39f; box-shadow: 0 0 8px #38d39f; flex: 0 0 auto; }

.obs-form-side { position: relative; display: flex; flex-direction: column; background: var(--hx-bg); min-height: 100vh; min-height: 100dvh; }

.obs-topbar { position: relative; z-index: 2; display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1.1rem clamp(1.25rem, 3.5vw, 3rem); border-bottom: 1px solid var(--hx-card-border); }
.obs-acct { display: flex; align-items: center; gap: 0.7rem; font-size: 0.84rem; color: var(--hx-text-dim); }
.obs-logout { appearance: none; cursor: pointer; background: transparent; border: 1px solid rgba(248,113,113,0.35); color: #F87171; font-size: 12px; font-weight: 600; padding: 5px 12px; border-radius: 8px; transition: background 0.14s, border-color 0.14s; font-family: var(--font-barlow-semi), sans-serif; }
.obs-logout:hover { background: rgba(248,113,113,0.1); border-color: rgba(248,113,113,0.6); }
.obs-av { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: var(--hx-overlay-accent-14); color: var(--hx-accent-bright); font-weight: 700; font-size: 0.82rem; font-family: var(--font-barlow-semi), sans-serif; }

.obs-scroller { position: relative; z-index: 1; flex: 1; overflow-y: auto; }
.obs-form-body { width: 100%; max-width: 60rem; margin: 0 auto; padding: clamp(1.5rem, 3.5vw, 2.8rem) clamp(1.25rem, 3.5vw, 3rem) 1.5rem; }
.obs-progress-line { height: 3px; background: var(--hx-card-border); border-radius: 3px; overflow: hidden; margin-bottom: 1.6rem; }
.obs-progress-line i { display: block; height: 100%; background: linear-gradient(90deg, var(--hx-accent), var(--hx-accent-bright)); transition: width 0.5s var(--hx-ease); }

.obs-form-foot { position: relative; z-index: 2; display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem clamp(1.25rem, 3.5vw, 3rem); border-top: 1px solid var(--hx-card-border); background: rgba(13,13,13,0.6); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); }
.obs-foot-meta { font-size: 0.82rem; color: var(--hx-text-dim); }
.obs-foot-btns { display: flex; gap: 0.6rem; }
.obs-btn { padding: 0.78rem 1.5rem; cursor: pointer; font-family: var(--font-barlow-semi), sans-serif; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; font-size: 0.92rem; border-radius: 9px; transition: transform 0.16s var(--hx-ease), background 0.2s var(--hx-ease), border-color 0.2s var(--hx-ease), opacity 0.2s; white-space: nowrap; border: 1.5px solid transparent; }
.obs-btn:active { transform: translateY(1px); }
.obs-btn--fill { background: var(--hx-accent); color: #1a0e02; border-color: var(--hx-accent); box-shadow: 0 8px 22px -8px var(--hx-overlay-accent-22); }
.obs-btn--fill:hover { background: var(--hx-accent-bright); border-color: var(--hx-accent-bright); }
.obs-btn--fill:disabled { opacity: 0.4; cursor: default; pointer-events: none; }
.obs-btn--ghost { background: transparent; color: var(--hx-text); border-color: var(--hx-card-border); }
.obs-btn--ghost:hover { border-color: var(--hx-text); background: rgba(245,245,240,0.06); }
.obs-btn--text { background: transparent; color: var(--hx-text-dim); }
.obs-btn--text:hover { color: var(--hx-text); }

@media (max-width: 900px) {
  .obs-ob { grid-template-columns: 1fr; }
  .obs-rail { position: relative; height: auto; padding: 1.4rem 1.4rem 1.6rem; }
  .obs-lead-desc { display: none; }
  .obs-stepper { flex-direction: row; flex-wrap: wrap; gap: 0.4rem; margin-top: 1.3rem; }
  .obs-step { padding: 0.4rem 0.7rem 0.4rem 0.4rem; background: rgba(245,245,240,0.04); }
  .obs-step-lbl { font-size: 0.8rem; }
  .obs-step-lbl small { display: none; }
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
