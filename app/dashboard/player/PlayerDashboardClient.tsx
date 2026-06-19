"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import "@/app/athlasx.css";
import { VERIFICATION_LEVELS } from "@/lib/profile-completion";
import type { CompletionResult } from "@/lib/profile-completion";

interface Props {
  userName: string;
  profileStatus: string;
  visibility: string;
  accountStatus: string;
  verification: { level: number; name: string; desc: string };
  completion: CompletionResult;
  profileId: string;
}

const RUNG_ACTIONS: Record<number, { label: string; href: string }> = {
  2: { label: "Verify Aadhaar",       href: "/verify/aadhaar" },
  3: { label: "Submit Scorecards",    href: "/verify/scorecards" },
  4: { label: "Request Scout Review", href: "/verify/scout-review" },
};

const STATUS_COLOR: Record<string, string> = {
  "Draft":            "ghost",
  "Pending Approval": "amber",
  "Approved":         "green",
  "Live":             "green",
  "Rejected":         "red",
};

/* Any non-Draft + non-Rejected status means the profile has been submitted,
   either still in review or already approved/live. */
const APPROVED_STATUSES = new Set(["Approved", "Live"]);
const REVIEWING_STATUSES = new Set(["Pending Approval", "Submitted"]);

export default function PlayerDashboardClient(p: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const pct = p.completion.pct;
  const ringR = 52;
  const ringC = 2 * Math.PI * ringR;
  const ringFill = (pct / 100) * ringC;
  const ringColor = pct >= 80 ? "#22C55E" : pct >= 50 ? "#F59E0B" : "#EF4444";

  async function submitForApproval() {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/player/profile/submit", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        const missing = Array.isArray(data?.missing) ? ` (Missing: ${data.missing.join(", ")})` : "";
        setSubmitError((data?.error ?? "Submission failed") + missing);
        return;
      }
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="sx-root" style={{ minHeight: "100vh", padding: 24 }}>
      <style>{styles}</style>

      <div className="pd-shell">

        <header className="pd-head">
          <div>
            <div className="sect-title">My Player Profile</div>
            <h1 className="pd-title">Hi, {p.userName.split(" ")[0]}</h1>
            <div className="pd-badges">
              <span className={`bdg ${STATUS_COLOR[p.profileStatus] ?? "ghost"}`}>
                {p.profileStatus}
              </span>
              <span className="bdg ghost">Visibility · {p.visibility}</span>
              <span className={`bdg ${p.accountStatus === "active" ? "green" : "amber"}`}>
                Account · {p.accountStatus}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/workflow" className="btn">How it works</Link>
            <Link href="/onboarding/player" className="btn">Edit profile</Link>
            <Link href={`/profile/${p.profileId}`} className="btn green">View public profile</Link>
          </div>
        </header>

        <div className="pd-grid">

          {/* Completion meter */}
          <div className="card pd-meter-card">
            <div className="chead2" style={{ paddingBottom: 8 }}>
              <span className="sect-title">Profile Completion</span>
              <span className="bdg ghost">
                {p.completion.done_required}/{p.completion.total_required} required
              </span>
            </div>
            <div className="cb pd-meter-body">
              <svg width="140" height="140" viewBox="0 0 140 140">
                <circle cx="70" cy="70" r={ringR} fill="none" stroke="#1A1A1A" strokeWidth="10" />
                <circle cx="70" cy="70" r={ringR} fill="none" stroke={ringColor} strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${ringFill.toFixed(1)} ${(ringC - ringFill).toFixed(1)}`}
                  transform="rotate(-90 70 70)" />
                <text x="70" y="74" textAnchor="middle" fill="#F0F0F0"
                  fontSize="34" fontWeight="700" fontFamily="Space Grotesk,monospace">
                  {pct}<tspan fontSize="14" fill="#555">%</tspan>
                </text>
                <text x="70" y="92" textAnchor="middle" fill="#555"
                  fontSize="8.5" letterSpacing="2" fontFamily="Space Grotesk,monospace">
                  COMPLETE
                </text>
              </svg>
              <div className="pd-meter-lists">
                <div>
                  <div className="sect-label2">Required</div>
                  {p.completion.required.map((r) => (
                    <div key={r.name} className="pd-check-row">
                      <span className={`pd-check ${r.done ? "pd-check--done" : ""}`}>
                        {r.done ? "✓" : ""}
                      </span>
                      <span>{r.name}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="sect-label2">Bonus</div>
                  {p.completion.optional.map((o) => (
                    <div key={o.name} className="pd-check-row">
                      <span className={`pd-check pd-check--bonus ${o.done ? "pd-check--done" : ""}`}>
                        {o.done ? "✓" : "+"}
                      </span>
                      <span style={{ color: o.done ? "var(--text)" : "var(--mut)" }}>{o.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Verification ladder */}
          <div className="card pd-ver-card">
            <div className="chead2" style={{ paddingBottom: 8 }}>
              <span className="sect-title">Verification Level · Workflow P2 → P6</span>
              <span className="bdg blue">Level {p.verification.level} / 4</span>
            </div>
            <div className="cb">
              <div className="pd-ladder">
                {VERIFICATION_LEVELS.map((v) => {
                  /* The active rung is the *next* one to unlock — one above
                     the player's current level. Active rungs get an action
                     button so the player can start the next verification. */
                  const state = v.level <= p.verification.level
                    ? "done"
                    : v.level === p.verification.level + 1
                      ? "active"
                      : "todo";
                  const action = state === "active" ? RUNG_ACTIONS[v.level] : null;
                  return (
                    <div key={v.level} className={`pd-rung pd-rung--${state}`}>
                      <div className="pd-rung-dot">{state === "done" ? "✓" : v.level}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="pd-rung-name">{v.name}</div>
                        <div className="pd-rung-desc">{v.desc}</div>
                      </div>
                      {action && (
                        <Link href={action.href} className="btn sm green" style={{ textDecoration: "none", flexShrink: 0 }}>
                          {action.label}
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Next steps */}
          <div className="card pd-next-card">
            <div className="chead2" style={{ paddingBottom: 8 }}>
              <span className="sect-title">Next Steps</span>
            </div>
            <div className="cb">
              {pct < 100 ? (
                <>
                  <p style={{ color: "var(--mut)", fontSize: 12.5, marginBottom: 12 }}>
                    Finish the missing categories to reach 100% and unlock submission.
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {p.completion.required.filter((r) => !r.done).map((r) => (
                      <span key={r.name} className="bdg amber">{r.name}</span>
                    ))}
                  </div>
                </>
              ) : REVIEWING_STATUSES.has(p.profileStatus) ? (
                <p style={{ color: "var(--amber)", fontSize: 13 }}>
                  ⏳ AthlasX Admin is reviewing your profile. You&apos;ll be notified
                  once it goes Live.
                </p>
              ) : APPROVED_STATUSES.has(p.profileStatus) ? (
                <>
                  <p style={{ color: "var(--green)", fontSize: 13, marginBottom: 10 }}>
                    ✓ Profile {p.profileStatus.toLowerCase()}. Visibility:{" "}
                    <strong>{p.visibility}</strong>.
                  </p>
                  <Link href={`/profile/${p.profileId}`} className="btn green"
                    style={{ textDecoration: "none" }}>
                    View Public Profile
                  </Link>
                </>
              ) : (
                <>
                  <button className="btn green" disabled={submitting}
                    onClick={submitForApproval}>
                    {submitting ? "Submitting…" : "Submit for Approval"}
                  </button>
                  {submitError && (
                    <p style={{ color: "var(--red)", fontSize: 12, marginTop: 8 }}>
                      {submitError}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = `
.pd-shell { max-width: 1200px; margin: 0 auto; }
.pd-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
.pd-title { font-family: var(--num); font-size: 32px; font-weight: 700; margin-top: 4px; }
.pd-badges { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.pd-grid { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 14px; align-items: start; }
@media (max-width: 980px) { .pd-grid { grid-template-columns: 1fr; } }
.pd-meter-body { display: flex; gap: 22px; align-items: center; flex-wrap: wrap; padding-top: 4px; }
.pd-meter-lists { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; min-width: 220px; }
.sect-label2 { font-family: var(--num); font-size: 10px; font-weight: 600; letter-spacing: 1.8px; text-transform: uppercase; color: var(--lbl2); margin-bottom: 8px; }
.pd-check-row { display: flex; align-items: center; gap: 8px; font-size: 12.5px; padding: 4px 0; }
.pd-check { width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center; background: var(--card-alt); border: 1px solid var(--line2); color: var(--lbl); font-size: 11px; font-weight: 700; }
.pd-check--done { background: var(--green-bg); border-color: var(--green-bd); color: var(--green); }
.pd-check--bonus { background: transparent; border-style: dashed; }
.pd-check--bonus.pd-check--done { background: var(--purple-bg); border-style: solid; border-color: var(--purple-bd); color: var(--purple); }

.pd-ladder { display: flex; flex-direction: column; gap: 10px; }
.pd-rung { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--card-alt); border: 1px solid var(--line); border-radius: 10px; }
.pd-rung-dot { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; font-family: var(--num); font-weight: 700; font-size: 12px; background: var(--card); border: 1px solid var(--line2); color: var(--lbl); flex-shrink: 0; }
.pd-rung-name { font-size: 13px; font-weight: 600; }
.pd-rung-desc { font-size: 11px; color: var(--mut); }
.pd-rung--done .pd-rung-dot { background: var(--green); color: #000; border-color: var(--green); }
.pd-rung--active { border-color: var(--green-bd); box-shadow: 0 0 0 1px var(--green-bd) inset; }
.pd-rung--active .pd-rung-dot { background: var(--green-bg); color: var(--green); border-color: var(--green-bd); }
.pd-rung--todo .pd-rung-name { color: var(--mut); }
`;
