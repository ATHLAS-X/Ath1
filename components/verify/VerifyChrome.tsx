"use client";

import Link from "next/link";
import { VERIFICATION_LEVELS } from "@/lib/profile-completion";
import "@/app/athlasx.css";

interface ChromeProps {
  title: string;
  level: number;
  children: React.ReactNode;
}

/* Shared chrome for the /verify/* pages — ported from the mockup's
   VerifyChrome + VerifyLadder. Three-column grid with the ladder on the
   left, the active step in the middle, and contextual cards on the right. */

export function VerifyChrome({ title, level, children }: ChromeProps) {
  return (
    <div className="sx-root vc-root">
      <style dangerouslySetInnerHTML={{ __html: VC_STYLES }} />
      <div className="vc-shell">
        <header className="vc-head">
          <Link href="/dashboard/player" className="vc-back">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M7.5 2L3.5 6L7.5 10" stroke="currentColor" strokeWidth="1.4"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to Dashboard
          </Link>
          <div className="vc-title">
            <span className="sect-title">{title}</span>
            <span className={`bdg ${level >= 3 ? "green" : level >= 2 ? "blue" : "amber"}`}>
              Level {level} / 4
            </span>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

interface LadderProps {
  level: number;
  /* Action button to render on a specific rung (e.g. only the user's next
     unlock gets a CTA). Keyed by level number. */
  actions?: Partial<Record<number, React.ReactNode>>;
}

export function VerifyLadder({ level, actions }: LadderProps) {
  return (
    <div className="card vc-ladder-card">
      <div className="chead2"><span className="sect-title">Verification Ladder</span></div>
      <div className="cb">
        {VERIFICATION_LEVELS.map((v) => {
          const state = v.level <= level
            ? "done"
            : v.level === level + 1 ? "active" : "todo";
          return (
            <div key={v.level} className={`vc-rung vc-rung--${state}`}>
              <div className="vc-rung-dot">{state === "done" ? "✓" : v.level}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="vc-rung-name">{v.name}</div>
                <div className="vc-rung-desc">{v.desc}</div>
              </div>
              {actions?.[v.level] ?? null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface CardProps {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function VCCard({ title, action, children }: CardProps) {
  return (
    <div className="card vc-card">
      {(title || action) && (
        <div className="chead2">
          {title && <span className="sect-title">{title}</span>}
          {action}
        </div>
      )}
      <div className="cb">{children}</div>
    </div>
  );
}

interface FieldProps {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}

export function VCField({ label, hint, children }: FieldProps) {
  return (
    <label className="vc-field">
      <span className="vc-field-label">{label}{hint && <span className="vc-field-hint">{hint}</span>}</span>
      {children}
    </label>
  );
}

interface StepperProps {
  steps: string[];
  current: number;
}

export function Stepper({ steps, current }: StepperProps) {
  return (
    <div className="vc-stepper">
      {steps.map((s, i) => {
        const state = i < current ? "done" : i === current ? "active" : "todo";
        return (
          <div key={s} className={`vc-step vc-step--${state}`}>
            <div className="vc-step-dot">{i < current ? "✓" : i + 1}</div>
            <div className="vc-step-lbl">{s}</div>
            {i < steps.length - 1 && <div className="vc-step-line" />}
          </div>
        );
      })}
    </div>
  );
}

const VC_STYLES = `
.vc-root { min-height: 100vh; padding: 24px 18px 48px; }
.vc-shell { max-width: 1280px; margin: 0 auto; }
.vc-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.vc-back { display: inline-flex; align-items: center; gap: 6px; color: var(--lbl); font-size: 12px; text-decoration: none; transition: color 0.15s; }
.vc-back:hover { color: var(--text); }
.vc-title { display: flex; align-items: center; gap: 10px; }

.vc-grid { display: grid; grid-template-columns: 26% 1fr 28%; gap: 16px; align-items: start; }
@media (max-width: 1100px) { .vc-grid { grid-template-columns: 1fr; } }
.vc-col { display: flex; flex-direction: column; gap: 14px; min-width: 0; }

.vc-card { padding: 0; }
.chead2 { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px 0; gap: 10px; }
.cb { padding: 12px 14px 14px; }

.vc-ladder-card .cb { padding-top: 6px; }
.vc-rung { display: flex; align-items: center; gap: 11px; padding: 12px 0; }
.vc-rung + .vc-rung { border-top: 1px solid var(--line); }
.vc-rung-dot {
  width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center;
  font-family: var(--num); font-size: 11px; font-weight: 700; flex-shrink: 0;
  background: var(--card-base); border: 1.5px solid var(--line2); color: var(--mut);
}
.vc-rung-name { font-size: 12.5px; font-weight: 600; color: var(--lbl); }
.vc-rung-desc { font-size: 10.5px; color: var(--mut); margin-top: 2px; }
.vc-rung--done .vc-rung-dot { background: radial-gradient(circle at 32% 28%, #46ff97, #0e6e33 75%); border-color: rgba(46,224,123,0.5); color: #04140a; box-shadow: 0 0 10px var(--green-glow); }
.vc-rung--done .vc-rung-name { color: var(--text); }
.vc-rung--active .vc-rung-dot { border-color: var(--green); color: var(--green); box-shadow: 0 0 8px var(--green-glow); }
.vc-rung--active .vc-rung-name { color: var(--text); }

.vc-stepper { display: flex; align-items: center; gap: 8px; margin: 4px 0 18px; }
.vc-step { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }
.vc-step-dot {
  width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center;
  font-family: var(--num); font-size: 11px; font-weight: 700;
  background: var(--card-base); border: 1.5px solid var(--line2); color: var(--mut); flex-shrink: 0;
}
.vc-step-lbl { font-size: 11px; color: var(--mut); font-family: var(--num); font-weight: 600; letter-spacing: 0.5px; }
.vc-step-line { width: 22px; height: 1.5px; background: var(--line2); margin: 0 4px; }
.vc-step--done .vc-step-dot { background: radial-gradient(circle at 32% 28%, #46ff97, #0e6e33 75%); border-color: rgba(46,224,123,0.5); color: #04140a; }
.vc-step--done .vc-step-lbl { color: var(--green); }
.vc-step--active .vc-step-dot { border-color: var(--green); color: var(--green); }
.vc-step--active .vc-step-lbl { color: var(--text); }

.vc-field { display: block; margin-bottom: 12px; }
.vc-field-label { display: flex; justify-content: space-between; font-size: 10px; letter-spacing: 1.4px; text-transform: uppercase; color: var(--lbl2); margin-bottom: 6px; font-family: var(--num); font-weight: 600; }
.vc-field-hint { color: var(--green); letter-spacing: 0; text-transform: none; font-weight: 600; }

.vc-li { display: flex; gap: 9px; padding: 6px 0; align-items: flex-start; font-size: 12.5px; color: var(--lbl); line-height: 1.55; }
.vc-li + .vc-li { border-top: 1px solid var(--line); }
.vc-li .m { width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center; flex-shrink: 0; margin-top: 1px; font-size: 10px; font-weight: 700; font-family: var(--num); background: var(--green-bg); color: var(--green); border: 1px solid var(--green-bd); }
.vc-li .m.x { background: var(--red-bg); color: var(--red); border-color: var(--red-bd); }
.vc-li .m.n { background: transparent; color: var(--lbl); border-color: var(--line2); }

.vc-kv { display: flex; align-items: center; gap: 10px; padding: 8px 0; font-size: 12px; }
.vc-kv + .vc-kv { border-top: 1px solid var(--line); }
.vc-kv .k { width: 130px; color: var(--mut); flex-shrink: 0; }
.vc-kv .v { flex: 1; min-width: 0; color: var(--text); font-weight: 600; }

.otp-row { display: flex; gap: 8px; margin-top: 4px; }
.otp-box {
  width: 44px; height: 50px; border-radius: 10px;
  background: var(--card-alt); border: 1.5px solid var(--line2);
  color: var(--text); font-family: var(--num); font-size: 22px; font-weight: 700;
  text-align: center; outline: none; transition: border-color 0.15s, box-shadow 0.15s;
}
.otp-box:focus { border-color: var(--green); box-shadow: 0 0 12px var(--green-glow); }

.vc-success { text-align: center; padding: 18px 6px 8px; }
.vc-success .vc-disc { width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; font-size: 26px; font-family: var(--num); font-weight: 700; color: #04140a; background: radial-gradient(circle at 32% 28%, #46ff97, #0e6e33 75%); box-shadow: 0 0 22px var(--green-glow); margin: 0 auto 12px; }
.vc-success h2 { font-family: var(--num); font-size: 18px; font-weight: 700; margin-bottom: 6px; }
.vc-success p { font-size: 12.5px; color: var(--mut); line-height: 1.55; max-width: 340px; margin: 0 auto; }

.f-label { font-size: 10px; letter-spacing: 1.4px; text-transform: uppercase; color: var(--lbl2); margin: 13px 0 6px; font-family: var(--num); font-weight: 600; }

.vc-tile { background: var(--card-alt); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; text-align: center; }
.vc-tile .v { font-family: var(--num); font-size: 22px; font-weight: 700; }
.vc-tile .l { font-size: 9.5px; letter-spacing: 1.4px; text-transform: uppercase; color: var(--mut); margin-top: 3px; }
`;
