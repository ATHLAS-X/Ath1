"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { DsIcon, DsPill, DsAvatar, DsButton, DsToast, useToast } from "@/app/_ds";

/* Real destinations for the verification ladder's per-rung action button —
   these pages exist (app/verify/scorecards, app/verify/scout-review); the
   ladder used to just toast "Submit Scorecards" with no navigation at all. */
const RUNG_HREF: Record<number, string> = {
  3: "/verify/scorecards",
  4: "/verify/scout-review",
};

// ─── Types & Mock Data ────────────────────────────────────────────────────────

type CheckItem  = { label: string; done: boolean };
type LadderRung = { lvl: number; title: string; sub: string; state: "done" | "active" | "todo"; action?: string };

/* Verification ladder is the same 4 fixed steps for every player — this is
   product structure, not per-user mock data. What WAS mock (and the actual
   bug) is that the rung states below were hardcoded to "done"/"active"/"todo"
   regardless of who was logged in; buildLadder() now derives state from the
   real `verification.level` prop the server computes per-account. */
const LADDER_DEFS: Array<{ lvl: number; title: string; sub: string; action?: string }> = [
  { lvl: 1, title: "Self Registered",      sub: "Default on signup" },
  { lvl: 2, title: "Identity Verified",    sub: "Aadhaar OTP confirmed" },
  { lvl: 3, title: "Performance Verified", sub: "Submit your scorecards",  action: "Submit Scorecards" },
  { lvl: 4, title: "Scout Verified",       sub: "Request a scout review",  action: "Request Scout Review" },
];

/* currentLevel is the highest level already achieved (getVerificationLevelMeta's
   .level from page.tsx) — so that rung and everything below it is "done",
   the next one up is the active target, and the rest are still "todo". */
function buildLadder(currentLevel: number): LadderRung[] {
  return LADDER_DEFS.map((d) => ({
    ...d,
    state: d.lvl <= currentLevel ? "done" : d.lvl === currentLevel + 1 ? "active" : "todo",
  }));
}

// ─── CompletionRing ───────────────────────────────────────────────────────────

function CompletionRing({ percent, size = 168, stroke = 13 }: { percent: number; size?: number; stroke?: number }) {
  const r             = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const [animated, setAnimated] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const start  = performance.now();
    const dur    = 900;
    const target = percent;

    const tick = (now: number) => {
      const t  = Math.min((now - start) / dur, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setAnimated(ease * target);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [percent]);

  const color  = animated >= 80 ? "var(--ax-ok)" : animated >= 50 ? "var(--ax-accent)" : "var(--ax-bad)";
  const offset = circumference - (animated / 100) * circumference;

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ax-field)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ filter: `drop-shadow(0 0 6px ${color}55)`, transition: "stroke 0.3s" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex",
        flexDirection: "column", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontFamily: "var(--ax-font-display)", fontSize: "2.8rem", lineHeight: 1, color }}>
          {Math.round(animated)}<span style={{ fontSize: "1.2rem" }}>%</span>
        </span>
        <span style={{
          fontFamily: "var(--ax-font-label)", textTransform: "uppercase",
          fontSize: "0.62rem", color: "var(--ax-text-faint)", marginTop: "0.25rem",
        }}>COMPLETE</span>
      </div>
    </div>
  );
}

// ─── ChecklistRow ─────────────────────────────────────────────────────────────

function ChecklistRow({ label, done, bonus }: { label: string; done: boolean; bonus?: boolean }) {
  const iconStyle: React.CSSProperties = done && bonus
    ? { background: "rgba(167,139,250,0.16)", color: "#C4B5FD",              border: "1px solid #C4B5FD" }
    : done
    ? { background: "var(--ax-ok-soft)",      color: "var(--ax-ok)",          border: "1px solid var(--ax-ok)" }
    : { background: "var(--ax-field)",         color: "var(--ax-text-faint)",  border: "1px solid var(--ax-border)" };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", padding: "0.3rem 0" }}>
      <span style={{
        width: 20, height: 20, borderRadius: "50%",
        display: "grid", placeItems: "center", flexShrink: 0,
        ...iconStyle,
      }}>
        <DsIcon name={done ? "check" : "x"} size={12} stroke={3} />
      </span>
      <span style={{
        fontSize: "0.84rem",
        color: done ? "var(--ax-text)" : "var(--ax-text-dim)",
        fontWeight: done ? 600 : 500,
      }}>{label}</span>
    </div>
  );
}

// ─── LadderRung ──────────────────────────────────────────────────────────────

function LadderRungRow({ rung, onAction }: { rung: LadderRung; onAction: (rung: LadderRung) => void }) {
  const isActive = rung.state === "active";
  const isDone   = rung.state === "done";

  const badgeStyle: React.CSSProperties = isDone
    ? { background: "var(--ax-ok-soft)",   border: "1.5px solid var(--ax-ok-border)", color: "var(--ax-ok)" }
    : isActive
    ? { background: "var(--ax-accent-14)", border: "1.5px solid var(--ax-accent)",    color: "var(--ax-accent-bright)" }
    : { background: "var(--ax-field)",     border: "1.5px solid var(--ax-border)",    color: "var(--ax-text-faint)" };

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "0.85rem",
      padding: "0.7rem 0.8rem", borderRadius: "var(--ax-radius-md)",
      background: isActive ? "var(--ax-accent-08)" : "transparent",
      border: isActive ? "1px solid var(--ax-accent-22)" : "1px solid var(--ax-border)",
    }}>
      <span style={{
        width: 34, height: 34, borderRadius: "50%",
        display: "grid", placeItems: "center", flexShrink: 0,
        fontFamily: "var(--ax-font-label)", fontWeight: 700, fontSize: "0.82rem",
        ...badgeStyle,
      }}>
        {isDone ? <DsIcon name="check" size={16} stroke={3} /> : rung.lvl}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: "0.86rem", fontWeight: 700,
          color: isDone || isActive ? "var(--ax-text)" : "var(--ax-text-dim)",
        }}>L{rung.lvl} · {rung.title}</div>
        <div style={{ fontSize: "0.72rem", color: "var(--ax-text-faint)", marginTop: "0.15rem" }}>{rung.sub}</div>
      </div>
      {isActive && rung.action && (
        <DsButton variant="fill" size="sm" onClick={() => onAction(rung)}>{rung.action}</DsButton>
      )}
      {isDone && (
        <DsIcon name="check" size={18} stroke={2.5} style={{ color: "var(--ax-ok)", flexShrink: 0 }} />
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface PlayerDashboardProps {
  userName?: string;
  profileStatus?: string;
  visibility?: string;
  accountStatus?: string;
  /* Matches lib/profile-completion.ts's getVerificationLevelMeta() return shape
     exactly — {level, label, next} was never what the server actually sends. */
  verification?: { level: number; name: string; desc: string };
  /* Matches calcProfileCompletion()'s real CompletionResult shape. */
  completion?: {
    pct: number;
    required: Array<{ name: string; done: boolean }>;
    optional: Array<{ name: string; done: boolean }>;
  };
  profileId?: string;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function PlayerDashboardClient({
  userName = "Player",
  profileStatus = "Draft",
  visibility = "Private",
  accountStatus = "pending",
  verification = { level: 1, name: "Self Registered", desc: "Profile created" },
  completion = { pct: 0, required: [], optional: [] },
  profileId,
}: PlayerDashboardProps = {}) {
  const router = useRouter();
  const { toast, showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  async function submitForApproval() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/player/profile/submit", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        const missingList = Array.isArray(data?.missing) ? ` — missing: ${data.missing.join(", ")}` : "";
        showToast((data?.error ?? "Submission failed") + missingList);
        return;
      }
      showToast("Profile submitted for approval.");
      router.refresh();
    } catch {
      showToast("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const required = completion.required.map((r) => ({ label: r.name, done: r.done }));
  const bonus = completion.optional.map((r) => ({ label: r.name, done: r.done }));
  const doneRequired = required.filter((r) => r.done).length;
  const totalRequired = required.length;
  const percent = completion.pct;
  const missing = required.filter((r) => !r.done);
  const ladder = buildLadder(verification.level);
  const firstName = userName.trim().split(/\s+/)[0] ?? userName;

  const kicker: React.CSSProperties = {
    fontFamily: "var(--ax-font-label)", textTransform: "uppercase",
    letterSpacing: "0.18em", fontSize: "11px", fontWeight: 700,
    color: "var(--ax-accent-bright)", margin: "0 0 0.4rem",
  };

  const cardShell: React.CSSProperties = {
    position: "relative", overflow: "hidden",
    borderRadius: "var(--ax-radius-xl)",
    background: "var(--ax-card)",
    border: "1px solid var(--ax-border)",
    boxShadow: "var(--ax-shadow-card)",
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflowY: "auto", background: "var(--ax-bg)", color: "var(--ax-text)" }}>

      {/* ── Topbar ──────────────────────────────────────────────────────── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 20,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem",
        padding: "0.85rem 1.8rem",
        borderBottom: "1px solid var(--ax-border)",
        background: "rgba(13,13,13,0.72)", backdropFilter: "blur(12px)",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
          <span style={{ fontFamily: "var(--ax-font-display)", fontSize: "1.45rem", textTransform: "uppercase", letterSpacing: "0.04em", lineHeight: 1 }}>
            ATHLAS<span style={{ color: "var(--ax-accent)" }}>X</span>
          </span>
          <span style={{
            fontFamily: "var(--ax-font-label)", fontSize: "0.68rem", fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.12em",
            color: "var(--ax-text-faint)", paddingLeft: "0.7rem",
            borderLeft: "1px solid var(--ax-border)",
          }}>Player</span>
        </div>

        {/* Right: bell + avatar */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.9rem" }}>
          <button style={{
            width: 38, height: 38, borderRadius: "var(--ax-radius-md)",
            background: "var(--ax-field)", border: "1px solid var(--ax-border)",
            color: "var(--ax-text-dim)", cursor: "pointer",
            display: "grid", placeItems: "center", position: "relative",
          }} onClick={() => showToast("No new notifications.")}>
            <DsIcon name="bell" size={17} />
            <span style={{
              position: "absolute", top: 7, right: 7, width: 7, height: 7,
              borderRadius: "50%", background: "var(--ax-accent)",
              boxShadow: "var(--ax-glow-dot)",
            }} />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <DsAvatar initial={initialsOf(userName)} size={34} solid />
            <div>
              <div style={{ fontSize: "0.86rem", fontWeight: 700, lineHeight: 1.2 }}>{userName}</div>
              <div style={{ fontSize: "0.7rem", color: "var(--ax-text-faint)", lineHeight: 1 }}>{verification.name}</div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "1.8rem 1.8rem 3.5rem" }}>

        {/* Header + Buttons row */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "1.4rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          <div>
            <p style={kicker}>Player Dashboard</p>
            <h1 style={{ fontFamily: "var(--ax-font-display)", textTransform: "uppercase", fontWeight: 400, lineHeight: 0.92, fontSize: "clamp(32px,4vw,52px)", margin: 0 }}>
              Welcome back, <span style={{ color: "var(--ax-accent)" }}>{firstName}</span>
            </h1>
          </div>
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            <DsButton variant="ghost" size="sm" leadingIcon={<DsIcon name="help" size={15} />} onClick={() => router.push("/workflow")}>How it works</DsButton>
            <DsButton
              variant="ghost" size="sm" leadingIcon={<DsIcon name="eye" size={15} />}
              disabled={!profileId}
              onClick={() => profileId ? router.push(`/profile/${profileId}`) : showToast("Profile isn't public yet.")}
            >View Public Profile</DsButton>
            <DsButton variant="fill" size="sm" leadingIcon={<DsIcon name="edit" size={15} />} onClick={() => router.push("/onboarding/player")}>Edit Profile</DsButton>
          </div>
        </div>

        {/* Status badges */}
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginBottom: "1.6rem" }}>
          <DsPill tone="accent" dot>Profile: {profileStatus}</DsPill>
          <DsPill tone="ok"     dot>Visibility: {visibility}</DsPill>
          <DsPill tone="ok"     dot>Account: {accountStatus}</DsPill>
          <DsPill tone="accent">Level {verification.level} / 4</DsPill>
        </div>

        {/* Two-column grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "1.1rem", marginBottom: "1.1rem" }}>

          {/* Left — Profile Completion */}
          <div style={cardShell}>
            <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "var(--ax-corner-glow)" }} />
            <div style={{ position: "relative", padding: "1.3rem 1.4rem" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: "1.1rem" }}>
                <h2 style={{ fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "1.05rem", fontWeight: 700, margin: 0 }}>
                  Profile Completion
                </h2>
                <DsPill tone={percent >= 80 ? "ok" : percent >= 50 ? "accent" : "bad"}>{doneRequired}/{totalRequired} required</DsPill>
              </div>
              <div style={{ display: "flex", gap: "1.6rem", alignItems: "center", flexWrap: "wrap" }}>
                <CompletionRing percent={percent} />
                <div style={{ flex: 1, minWidth: 220, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.4rem" }}>
                  <div>
                    <p style={kicker}>Required</p>
                    {required.map(it => <ChecklistRow key={it.label} {...it} />)}
                  </div>
                  <div>
                    <p style={kicker}>Bonus</p>
                    {bonus.map(it => <ChecklistRow key={it.label} {...it} bonus />)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right — Verification Ladder */}
          <div style={cardShell}>
            <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "var(--ax-corner-glow)" }} />
            <div style={{ position: "relative", padding: "1.3rem 1.4rem" }}>
              <h2 style={{ fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "1.05rem", fontWeight: 700, margin: "0 0 0.25rem" }}>
                Verification Ladder
              </h2>
              <p style={{ margin: "0 0 1rem", fontSize: "0.82rem", color: "var(--ax-text-faint)" }}>Level {verification.level} of 4</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                {[...ladder].reverse().map(rung => (
                  <LadderRungRow
                    key={rung.lvl}
                    rung={rung}
                    onAction={(r) => {
                      const href = RUNG_HREF[r.lvl];
                      if (href) router.push(href);
                      else showToast(`${r.action} isn't available yet.`);
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Next Steps card */}
        <div style={cardShell}>
          <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "var(--ax-corner-glow)" }} />
          <div style={{ position: "relative", padding: "1.3rem 1.4rem" }}>
            <h2 style={{ fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "1.05rem", fontWeight: 700, margin: "0 0 1rem" }}>
              Next Steps
            </h2>

            {missing.length > 0 ? (
              <>
                {/* Amber callout */}
                <div style={{
                  display: "flex", gap: "0.7rem", padding: "0.9rem 1rem",
                  borderRadius: "var(--ax-radius-md)",
                  background: "var(--ax-accent-08)", border: "1px solid var(--ax-accent-22)",
                  marginBottom: "1.1rem",
                }}>
                  <DsIcon name="spark" size={18} style={{ color: "var(--ax-accent-bright)", flexShrink: 0 }} />
                  <p style={{ margin: 0, fontSize: "0.86rem", lineHeight: 1.5 }}>
                    <b style={{ color: "var(--ax-accent-bright)" }}>Almost there.</b>{" "}
                    <span style={{ color: "var(--ax-text-dim)" }}>Complete the remaining required item below to submit your profile for approval.</span>
                  </p>
                </div>

                {/* Missing chips */}
                <p style={kicker}>Missing required</p>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.3rem" }}>
                  {missing.map(m => (
                    <span key={m.label} style={{
                      background: "var(--ax-accent-14)", border: "1px solid var(--ax-accent)",
                      color: "var(--ax-accent-bright)", padding: "0.4rem 0.8rem",
                      borderRadius: "var(--ax-radius-pill)", fontSize: "0.82rem", fontWeight: 600,
                      display: "inline-flex", alignItems: "center", gap: "0.4rem",
                    }}>
                      <DsIcon name="x" size={13} stroke={2.5} />
                      {m.label}
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                  <DsButton variant="fill" leadingIcon={<DsIcon name="video" size={16} />} onClick={() => router.push("/videos/upload")}>
                    Add Videos
                  </DsButton>
                  <DsButton variant="ghost" disabled>Submit for Approval</DsButton>
                </div>
                <p style={{ margin: "0.8rem 0 0", fontSize: "0.78rem", color: "var(--ax-text-faint)" }}>
                  Submission is blocked until all required items are complete.
                </p>
              </>
            ) : (
              <DsButton variant="fill" disabled={submitting} onClick={submitForApproval}>
                {submitting ? "Submitting…" : "Submit for Approval"}
              </DsButton>
            )}
          </div>
        </div>
      </div>

      <DsToast message={toast} fixed />
    </div>
  );
}