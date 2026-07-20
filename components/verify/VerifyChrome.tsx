"use client";

import Link from "next/link";
import { VERIFICATION_LEVELS } from "@/lib/profile-completion";
import { DsIcon, DsPill } from "@/app/_ds";

interface ChromeProps {
  title: string;
  level: number;
  children: React.ReactNode;
}

/* Shared chrome for the /verify/* pages, on the same --ax-* dark design
   system as the dashboards (and the Player dashboard's own Verification
   Ladder card, which this mirrors). Three-column grid with the ladder on
   the left, the active step in the middle, and contextual cards on the
   right. */

const cardShell: React.CSSProperties = {
  position: "relative", overflow: "hidden", borderRadius: "var(--ax-radius-xl)",
  background: "var(--ax-card)", border: "1px solid var(--ax-border)", boxShadow: "var(--ax-shadow-card)",
};

export function VerifyChrome({ title, level, children }: ChromeProps) {
  return (
    <div style={{ minHeight: "100vh", padding: "1.5rem 1.1rem 3rem", background: "var(--ax-bg)", color: "var(--ax-text)" }}>
      <style dangerouslySetInnerHTML={{ __html: VC_STYLES }} />
      <div className="vc-shell">
        <header className="vc-head">
          <Link href="/dashboard/player" className="vc-back">
            <DsIcon name="chevron" size={12} style={{ transform: "rotate(180deg)" }} />
            Back to Dashboard
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span style={{ fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "0.95rem", fontWeight: 700 }}>{title}</span>
            <DsPill tone={level >= 3 ? "ok" : level >= 2 ? "blue" : "accent"}>Level {level} / 4</DsPill>
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
    <div style={cardShell}>
      <div style={{ padding: "1rem 1.1rem 0" }}>
        <span style={{ fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "0.95rem", fontWeight: 700 }}>Verification Ladder</span>
      </div>
      <div style={{ padding: "0.4rem 1.1rem 1.1rem" }}>
        {VERIFICATION_LEVELS.map((v) => {
          const state = v.level <= level ? "done" : v.level === level + 1 ? "active" : "todo";
          const coin = state === "done"
            ? { bg: "var(--ax-ok-soft)", bd: "var(--ax-ok-border)", fg: "var(--ax-ok)" }
            : state === "active"
            ? { bg: "var(--ax-accent-14)", bd: "var(--ax-accent)", fg: "var(--ax-accent-bright)" }
            : { bg: "var(--ax-field)", bd: "var(--ax-border)", fg: "var(--ax-text-faint)" };
          return (
            <div key={v.level} style={{
              display: "flex", alignItems: "center", gap: "0.7rem", padding: "0.75rem 0",
              borderTop: v.level === VERIFICATION_LEVELS[0].level ? "none" : "1px solid var(--ax-border)",
            }}>
              <span style={{
                width: 26, height: 26, flex: "0 0 auto", borderRadius: "50%", display: "grid", placeItems: "center",
                background: coin.bg, border: `1.5px solid ${coin.bd}`, color: coin.fg,
                fontFamily: "var(--ax-font-label)", fontWeight: 700, fontSize: "0.72rem",
              }}>
                {state === "done" ? <DsIcon name="check" size={13} stroke={3} /> : v.level}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 700, color: state === "todo" ? "var(--ax-text-dim)" : "var(--ax-text)" }}>{v.name}</div>
                <div style={{ fontSize: "0.68rem", color: "var(--ax-text-faint)", marginTop: "0.1rem" }}>{v.desc}</div>
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
    <div style={cardShell}>
      {(title || action) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.6rem", padding: "1rem 1.1rem 0" }}>
          {title && <span style={{ fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "0.95rem", fontWeight: 700 }}>{title}</span>}
          {action}
        </div>
      )}
      <div style={{ padding: "0.85rem 1.1rem 1.1rem" }}>{children}</div>
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
    <label style={{ display: "block", marginBottom: "0.85rem" }}>
      <span style={{
        display: "flex", justifyContent: "space-between",
        fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.1em",
        fontSize: "0.62rem", fontWeight: 700, color: "var(--ax-text-dim)", marginBottom: "0.4rem",
      }}>
        {label}
        {hint && <span style={{ color: "var(--ax-ok)", letterSpacing: 0, textTransform: "none", fontWeight: 600 }}>{hint}</span>}
      </span>
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
    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", margin: "0.3rem 0 1.3rem" }}>
      {steps.map((s, i) => {
        const state = i < current ? "done" : i === current ? "active" : "todo";
        const coin = state === "done"
          ? { bg: "var(--ax-ok-soft)", bd: "var(--ax-ok-border)", fg: "var(--ax-ok)" }
          : state === "active"
          ? { bg: "var(--ax-accent-14)", bd: "var(--ax-accent)", fg: "var(--ax-accent-bright)" }
          : { bg: "var(--ax-field)", bd: "var(--ax-border)", fg: "var(--ax-text-faint)" };
        return (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: "0.55rem", flex: "0 0 auto" }}>
            <span style={{
              width: 24, height: 24, flex: "0 0 auto", borderRadius: "50%", display: "grid", placeItems: "center",
              fontFamily: "var(--ax-font-label)", fontSize: "0.68rem", fontWeight: 700,
              background: coin.bg, border: `1.5px solid ${coin.bd}`, color: coin.fg,
            }}>
              {i < current ? <DsIcon name="check" size={12} stroke={3} /> : i + 1}
            </span>
            <span style={{
              fontFamily: "var(--ax-font-label)", fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.03em",
              color: state === "todo" ? "var(--ax-text-faint)" : "var(--ax-text)",
            }}>{s}</span>
            {i < steps.length - 1 && <span style={{ width: 22, height: 1.5, background: "var(--ax-border)", margin: "0 0.2rem" }} />}
          </div>
        );
      })}
    </div>
  );
}

const VC_STYLES = `
.vc-shell { max-width: 1280px; margin: 0 auto; }
.vc-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.vc-back { display: inline-flex; align-items: center; gap: 6px; color: var(--ax-text-dim); font-size: 0.78rem; text-decoration: none; transition: color var(--ax-dur-fast) var(--ax-ease); }
.vc-back:hover { color: var(--ax-text); }

.vc-grid { display: grid; grid-template-columns: 26% 1fr 28%; gap: 16px; align-items: start; }
@media (max-width: 1100px) { .vc-grid { grid-template-columns: 1fr; } }
.vc-col { display: flex; flex-direction: column; gap: 14px; min-width: 0; }

.vc-li { display: flex; gap: 9px; padding: 6px 0; align-items: flex-start; font-size: 0.82rem; color: var(--ax-text-dim); line-height: 1.55; }
.vc-li + .vc-li { border-top: 1px solid var(--ax-border); }
.vc-li .m { width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center; flex-shrink: 0; margin-top: 1px; font-size: 0.62rem; font-weight: 700; font-family: var(--ax-font-label); background: var(--ax-ok-soft); color: var(--ax-ok); border: 1px solid var(--ax-ok-border); }
.vc-li .m.x { background: var(--ax-bad-soft); color: var(--ax-bad-text); border-color: var(--ax-bad); }
.vc-li .m.n { background: transparent; color: var(--ax-text-dim); border-color: var(--ax-border); }

.vc-kv { display: flex; align-items: center; gap: 10px; padding: 8px 0; font-size: 0.78rem; }
.vc-kv + .vc-kv { border-top: 1px solid var(--ax-border); }
.vc-kv .k { width: 130px; color: var(--ax-text-faint); flex-shrink: 0; }
.vc-kv .v { flex: 1; min-width: 0; color: var(--ax-text); font-weight: 600; }

.otp-row { display: flex; gap: 8px; margin-top: 4px; }
.otp-box {
  width: 44px; height: 50px; border-radius: var(--ax-radius-md);
  background: var(--ax-field); border: 1.5px solid var(--ax-border);
  color: var(--ax-text); font-family: var(--ax-font-display); font-size: 22px; font-weight: 400;
  text-align: center; outline: none; transition: border-color var(--ax-dur-fast), box-shadow var(--ax-dur-fast);
}
.otp-box:focus { border-color: var(--ax-accent); box-shadow: var(--ax-glow-accent); }

.vc-success { text-align: center; padding: 18px 6px 8px; }
.vc-success .vc-disc { width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; font-size: 26px; font-family: var(--ax-font-display); font-weight: 400; color: var(--ax-text-on-accent); background: var(--ax-accent); box-shadow: var(--ax-glow-accent-strong); margin: 0 auto 12px; }
.vc-success h2 { font-family: var(--ax-font-display); text-transform: uppercase; font-weight: 400; font-size: 1.3rem; margin-bottom: 6px; }
.vc-success p { font-size: 0.82rem; color: var(--ax-text-dim); line-height: 1.55; max-width: 340px; margin: 0 auto; }

.vc-tile { background: var(--ax-field); border: 1px solid var(--ax-border); border-radius: var(--ax-radius-md); padding: 10px 12px; text-align: center; }
.vc-tile .v { font-family: var(--ax-font-display); font-size: 1.4rem; font-weight: 400; }
.vc-tile .l { font-size: 0.6rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ax-text-faint); margin-top: 3px; }
`;