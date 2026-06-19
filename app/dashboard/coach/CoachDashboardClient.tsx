"use client";

import Link from "next/link";
import { useState, useCallback } from "react";
import { initials, Ring, Vlvl } from "@/components/sx/widgets";
import { AVA_COLORS, roleColor } from "@/lib/score-utils";
import type { CoachDashboardData, CoachAssignedPlayer, CoachSubmission } from "@/lib/dashboard-data";
import AthlasXLogo from "@/components/AthlasXLogo";
import "@/app/athlasx.css";

const NAV = [
  { n: "Dashboard",  href: "/dashboard/coach",                      ic: '<rect x="1.5" y="1.5" width="4.5" height="4.5" rx="1"/><rect x="8" y="1.5" width="4.5" height="4.5" rx="1"/><rect x="1.5" y="8" width="4.5" height="4.5" rx="1"/><rect x="8" y="8" width="4.5" height="4.5" rx="1"/>' },
  { n: "My Players", href: "/dashboard/coach/players",              ic: '<circle cx="7" cy="4.5" r="2.2"/><path d="M2.5 12C2.5 9.5 4.5 8 7 8s4.5 1.5 4.5 4"/>' },
  { n: "Fitness Log",href: "/dashboard/coach/fitness", badge: "pending_fitness",   ic: '<path d="M1.5 7H4.5M9.5 7H12.5"/><rect x="4.5" y="4.5" width="5" height="5" rx="0.8"/>' },
  { n: "Behavioural",href: "/dashboard/coach/behaviour", badge: "pending_behaviour", ic: '<circle cx="7" cy="6" r="2.5"/><path d="M3 12C3 10 4.5 9 7 9s4 1 4 3"/>' },
  { n: "Milestones", href: "/dashboard/coach/milestones",           ic: '<path d="M7 1.5L8.5 5L12 5.5L9.5 8L10 11.5L7 9.8L4 11.5L4.5 8L2 5.5L5.5 5L7 1.5Z"/>' },
  { n: "Workflow",   href: "/workflow",                              ic: '<rect x="1.5" y="3.5" width="3" height="3" rx="0.5"/><rect x="9.5" y="3.5" width="3" height="3" rx="0.5"/><rect x="1.5" y="9" width="3" height="3" rx="0.5"/><rect x="9.5" y="9" width="3" height="3" rx="0.5"/><path d="M4.5 5H9.5M4.5 10.5H9.5"/>' },
];

const ACT_LABEL: Record<NonNullable<CoachAssignedPlayer["pending_action"]>, string> = {
  fitness:   "Fitness due",
  behaviour: "Eval due",
  milestone: "Milestone",
};

const ACT_COLOR: Record<NonNullable<CoachAssignedPlayer["pending_action"]>, string> = {
  fitness:   "amber",
  behaviour: "blue",
  milestone: "purple",
};

const KIND_ICON: Record<CoachSubmission["kind"], string> = {
  fitness:   "💪",
  behaviour: "🧠",
  milestone: "★",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
}

function fmtRelative(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

interface Props {
  data: CoachDashboardData;
}

export default function CoachDashboardClient({ data }: Props) {
  const [filter, setFilter] = useState<"all" | "fitness" | "behaviour">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const filtered = data.assigned_players.filter((p) => {
    if (filter === "all") return true;
    if (filter === "fitness")   return p.pending_action === "fitness";
    if (filter === "behaviour") return p.pending_action === "behaviour";
    return true;
  });

  const quickLog = useCallback(async (playerId: string, kind: "fitness" | "behaviour") => {
    setBusy(playerId + kind);
    // Endpoint per architecture doc — does not exist yet, falls back silently.
    await fetch(`/api/coach/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_user_id: playerId }),
    }).catch(() => {});
    setBusy(null);
    setToast(`Opened ${kind} form for ${playerId.slice(0, 6)}…`);
    setTimeout(() => setToast(null), 2200);
  }, []);

  const coachInits = initials(data.coach_name);

  const KPIS = [
    { c: data.counts.assigned,          n: "Assigned",          col: "#2EE07B" },
    { c: data.counts.pending_fitness,   n: "Fitness Due",       col: "#FBBF24" },
    { c: data.counts.pending_behaviour, n: "Evals Due",         col: "#4D9FFF" },
    { c: data.counts.submissions_30d,   n: "Submitted · 30d",   col: "#A78BFA" },
  ];

  return (
    <div className="sx-root">
      <style dangerouslySetInnerHTML={{ __html: styles }} />

      <div className="shell">

        {/* ════ SIDEBAR ════ */}
        <aside className="sidebar">
          <div className="logo-row">
            <AthlasXLogo />
          </div>

          <nav className="nav">
            {NAV.map((item) => {
              const active = item.href === "/dashboard/coach";
              const badge = item.badge ? (data.counts as any)[item.badge] : 0;
              return (
                <Link key={item.n} href={item.href} className={`nav-item${active ? " active" : ""}`}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                    stroke={active ? "#2EE07B" : "#6A746C"}
                    strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"
                    dangerouslySetInnerHTML={{ __html: item.ic }} />
                  {item.n}
                  {badge > 0 && <span className="nav-count">{badge}</span>}
                </Link>
              );
            })}
          </nav>

          <div className="card coach-card">
            <div className="coach-ava">{coachInits}</div>
            <div style={{ minWidth: 0 }}>
              <div className="coach-name">{data.coach_name}</div>
              <span className={`bdg ${data.coach_status === "APPROVED" ? "green" : data.coach_status === "PENDING_REVIEW" ? "amber" : "red"}`} style={{ marginTop: 3 }}>
                {data.coach_status === "APPROVED" ? "Verified Coach" : data.coach_status === "PENDING_REVIEW" ? "Pending Review" : "Rejected"}
              </span>
              {data.academy_name && (
                <div className="coach-academy">{data.academy_name}</div>
              )}
            </div>
          </div>

          {!data.can_submit_fitness && (
            <div className="card alert">
              <div className="alert-h">Submission locked</div>
              <div className="alert-b">
                Your coach status must be <strong>Approved</strong> and you must be
                bound to an academy to log fitness/behavioural rows.
              </div>
            </div>
          )}
        </aside>

        {/* ════ CENTRE ════ */}
        <div className="colstack">

          {/* Hero header */}
          <div className="card hero">
            <div className="hero-inner">
              <div>
                <div className="sect-title">Coach Dashboard</div>
                <h1 className="hero-title">Hi, {data.coach_name.replace(/^Coach\s+/, "").split(" ")[0]}</h1>
                <div className="hero-sub">
                  {data.academy_name ?? "Independent coach"} · {data.counts.assigned} players assigned
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  <span className="bdg blue">Workflow P3 · Capture</span>
                  <span className="bdg blue">Workflow P4 · Endorse Scorecards</span>
                  <Link href="/workflow" className="bdg ghost" style={{ textDecoration: "none" }}>How it fits →</Link>
                </div>
              </div>
              <div className="kpi-strip">
                {KPIS.map((k) => (
                  <div key={k.n} className="kpi">
                    <div className="kpi-v" style={{ color: k.col, textShadow: `0 0 14px ${k.col}44` }}>{k.c}</div>
                    <div className="kpi-l">{k.n}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Assigned players table */}
          <div className="card" style={{ overflow: "hidden" }}>
            <div className="chead2" style={{ paddingBottom: 11 }}>
              <span className="sect-title">My Players</span>
              <div className="role-pills" style={{ gap: 4 }}>
                {(["all", "fitness", "behaviour"] as const).map((f) => (
                  <button key={f} className={`rpill${filter === f ? " on" : ""}`} onClick={() => setFilter(f)}>
                    {f === "all" ? `All ${data.counts.assigned}` :
                     f === "fitness"   ? `Fitness ${data.counts.pending_fitness}` :
                                         `Behaviour ${data.counts.pending_behaviour}`}
                  </button>
                ))}
              </div>
            </div>
            <table className="ptable">
              <thead>
                <tr>
                  <th style={{ width: "26%" }}>Player</th>
                  <th>Role</th>
                  <th>Age</th>
                  <th>Verification</th>
                  <th>Last YoYo</th>
                  <th>Last assessed</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Quick log</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--mut)", padding: "24px 12px" }}>
                    No players in this view
                  </td></tr>
                ) : filtered.map((p, i) => (
                  <tr key={p.user_id}>
                    <td>
                      <div className="pcell">
                        <span className="ava" style={{
                          background: `radial-gradient(circle at 32% 28%, ${AVA_COLORS[i % AVA_COLORS.length]}, rgba(0,0,0,0.55))`,
                          color: "#fff",
                        }}>{initials(p.name)}</span>
                        <span>
                          <span className="nm">{p.name}</span><br />
                          <span className="ds">{[p.city, p.state].filter(Boolean).join(" · ")}</span>
                        </span>
                      </div>
                    </td>
                    <td><span className={`bdg ${roleColor(p.playing_role)}`}>{p.playing_role}</span></td>
                    <td style={{ fontFamily: "var(--num)", fontWeight: 600 }}>{p.age ?? "—"}</td>
                    <td><Vlvl level={p.verification_level} compact /></td>
                    <td style={{ fontFamily: "var(--num)", fontWeight: 600 }}>
                      {p.latest_yoyo != null ? p.latest_yoyo.toFixed(1) : <span style={{ color: "var(--mut)" }}>—</span>}
                    </td>
                    <td style={{ color: "#8B958D" }}>{fmtDate(p.last_assessment_at)}</td>
                    <td>
                      {p.pending_action ? (
                        <span className={`bdg ${ACT_COLOR[p.pending_action]}`}>{ACT_LABEL[p.pending_action]}</span>
                      ) : (
                        <span className="bdg ghost">Up to date</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button className="btn sm"
                        disabled={!data.can_submit_fitness || busy === p.user_id + "fitness"}
                        onClick={() => quickLog(p.user_id, "fitness")}
                        style={{ marginRight: 4 }}>
                        {busy === p.user_id + "fitness" ? "…" : "Fitness"}
                      </button>
                      <button className="btn sm"
                        disabled={!data.can_submit_fitness || busy === p.user_id + "behaviour"}
                        onClick={() => quickLog(p.user_id, "behaviour")}>
                        {busy === p.user_id + "behaviour" ? "…" : "Eval"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ════ RIGHT ════ */}
        <div className="colstack">

          {/* Submission permission card */}
          <div className="card">
            <div className="chead2"><span className="sect-title">Submission Permissions</span></div>
            <div className="cb">
              <div className="perm-row">
                <span className={`perm-dot${data.coach_status === "APPROVED" ? " on" : ""}`} />
                <span>Coach status approved</span>
                <span className="bdg ghost" style={{ marginLeft: "auto" }}>{data.coach_status}</span>
              </div>
              <div className="perm-row">
                <span className={`perm-dot${data.academy_name ? " on" : ""}`} />
                <span>Bound to academy</span>
                <span className="bdg ghost" style={{ marginLeft: "auto" }}>{data.academy_name ?? "None"}</span>
              </div>
              <div className="perm-row">
                <span className={`perm-dot${data.can_submit_fitness ? " on" : ""}`} />
                <span>Can submit fitness/behaviour</span>
                <span className={`bdg ${data.can_submit_fitness ? "green" : "amber"}`} style={{ marginLeft: "auto" }}>
                  {data.can_submit_fitness ? "Yes" : "No"}
                </span>
              </div>
            </div>
          </div>

          {/* Recent submissions */}
          <div className="card">
            <div className="chead2">
              <span className="sect-title">Recent Submissions</span>
              <span className="bdg ghost">{data.recent_submissions.length}</span>
            </div>
            <div className="cb">
              {data.recent_submissions.length === 0 ? (
                <div style={{ color: "var(--mut)", fontSize: 12 }}>No submissions yet.</div>
              ) : data.recent_submissions.map((s, i) => (
                <Link key={s.id} href={`/profile/${s.player_user_id}`} className="sub-row" style={{ textDecoration: "none", color: "inherit" }}>
                  <span className="sub-icon" style={{
                    background: `radial-gradient(circle at 32% 28%, ${AVA_COLORS[(i + 2) % AVA_COLORS.length]}, rgba(0,0,0,0.55))`,
                  }}>{KIND_ICON[s.kind]}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <div className="sub-name">{s.player_name}</div>
                    <div className="sub-sum">{s.summary}</div>
                  </span>
                  <span className="sub-when">{fmtRelative(s.submitted_at)}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div className="card">
            <div className="chead2"><span className="sect-title">Quick Actions</span></div>
            <div className="cb" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Link href="/dashboard/coach/fitness/new" className="btn green" style={{ textDecoration: "none", textAlign: "center" }}>
                + Log Fitness Assessment
              </Link>
              <Link href="/dashboard/coach/behaviour/new" className="btn" style={{ textDecoration: "none", textAlign: "center" }}>
                + Add Behavioural Evaluation
              </Link>
              <Link href="/dashboard/coach/milestones/new" className="btn" style={{ textDecoration: "none", textAlign: "center" }}>
                + Record Milestone
              </Link>
            </div>
          </div>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

const styles = `
.sx-root { font-family: 'Instrument Sans', system-ui, sans-serif; }
.shell { max-width: 1500px; margin: 0 auto; display: grid; grid-template-columns: 21% 1fr 27%; gap: 16px; padding: 18px; align-items: start; }
.colstack { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
@media (max-width: 1100px) { .shell { grid-template-columns: 1fr; } .sidebar { position: static; } }

.sidebar { position: sticky; top: 18px; display: flex; flex-direction: column; gap: 16px; }
.logo-row { display: flex; align-items: center; gap: 10px; padding: 6px 4px 0; }
.logo-ball { width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0; background: radial-gradient(circle at 32% 28%, #46ff97, #0e6e33 72%); position: relative; box-shadow: 0 0 16px var(--green-glow), inset 0 -5px 8px rgba(0,0,0,0.35), inset 0 2px 3px rgba(255,255,255,0.4); }
.logo-ball::after { content: ''; position: absolute; left: 50%; top: 3px; bottom: 3px; width: 1.5px; background: rgba(4,20,10,0.5); transform: translateX(-50%) rotate(14deg); border-radius: 99px; }
.logo-word { font-family: var(--num); font-size: 17px; font-weight: 700; letter-spacing: 0.05em; }
.logo-word em { font-style: normal; color: var(--green); text-shadow: 0 0 14px var(--green-glow); }

.nav { display: flex; flex-direction: column; gap: 5px; }
.nav-item { display: flex; align-items: center; gap: 10px; border: 1px solid transparent; border-radius: 11px; padding: 10px 12px; color: var(--lbl); font-size: 12.5px; font-weight: 500; cursor: pointer; text-decoration: none; transition: all 0.16s; }
.nav-item:hover { color: var(--text); background: var(--card-alt); border-color: var(--line); }
.nav-item.active { color: var(--text); background: linear-gradient(168deg, rgba(46,224,123,0.13), rgba(46,224,123,0.04)); border-color: var(--green-bd); box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 6px 18px -8px var(--green-glow); }
.nav-count { margin-left: auto; min-width: 19px; height: 18px; padding: 0 6px; border-radius: 99px; display: grid; place-items: center; font-family: var(--num); font-size: 9.5px; font-weight: 700; background: var(--amber-bg, rgba(251,191,36,0.16)); color: var(--amber, #FBBF24); border: 1px solid var(--amber-bd, rgba(251,191,36,0.4)); }

.coach-card { padding: 13px; display: flex; align-items: flex-start; gap: 11px; }
.coach-ava { width: 38px; height: 38px; border-radius: 50%; background: radial-gradient(circle at 32% 28%, #46ff97, #0e6e33 75%); display: grid; place-items: center; font-family: var(--num); font-weight: 700; font-size: 13px; color: #04140a; flex-shrink: 0; box-shadow: inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -7px 10px rgba(0,0,0,0.3), 0 3px 10px rgba(0,0,0,0.5); }
.coach-name { font-size: 13px; font-weight: 600; }
.coach-academy { font-size: 10.5px; color: var(--mut); margin-top: 4px; }

.alert { padding: 12px 14px; border-color: var(--amber-bd, rgba(251,191,36,0.4)); background: linear-gradient(150deg, rgba(251,191,36,0.06), transparent); }
.alert-h { font-family: var(--num); font-size: 11px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: var(--amber, #FBBF24); margin-bottom: 5px; }
.alert-b { font-size: 11.5px; color: var(--lbl); line-height: 1.45; }

.hero { overflow: hidden; position: relative; }
.hero::after { content: ''; position: absolute; right: -40px; top: -80px; width: 320px; height: 320px; border-radius: 50%; background: radial-gradient(circle, rgba(46,224,123,0.10), transparent 68%); pointer-events: none; }
.hero-inner { padding: 20px 22px; display: flex; justify-content: space-between; align-items: center; gap: 18px; flex-wrap: wrap; position: relative; z-index: 2; }
.hero-title { font-family: var(--num); font-size: 30px; font-weight: 700; margin-top: 4px; }
.hero-sub { font-size: 11.5px; color: var(--mut); margin-top: 4px; }
.kpi-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; flex: 1; min-width: 360px; max-width: 520px; }
.kpi { padding: 11px 12px; border: 1px solid var(--line); border-radius: 11px; background: var(--card-alt); text-align: center; }
.kpi-v { font-family: var(--num); font-size: 22px; font-weight: 700; }
.kpi-l { font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--lbl2); margin-top: 3px; }

.chead2 { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px 0; }
.cb { padding: 12px 14px 14px; }
.role-pills { display: flex; gap: 5px; flex-wrap: wrap; padding-right: 8px; }
.rpill { height: 25px; padding: 0 11px; border-radius: 99px; display: inline-flex; align-items: center; background: var(--card-alt); border: 1px solid var(--line2); color: var(--lbl); font-family: var(--num); font-size: 10.5px; font-weight: 600; cursor: pointer; transition: all 0.13s; }
.rpill:hover { color: var(--text); border-color: rgba(255,255,255,0.25); }
.rpill.on { background: var(--green-bg); border-color: var(--green-bd); color: var(--green); }

.ptable { width: 100%; border-collapse: collapse; }
.ptable th { background: var(--head); font-family: var(--num); font-size: 9.5px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: var(--lbl); text-align: left; padding: 9px 12px; }
.ptable th:first-child { border-radius: 8px 0 0 8px; }
.ptable th:last-child { border-radius: 0 8px 8px 0; }
.ptable td { padding: 9px 12px; font-size: 12.5px; vertical-align: middle; }
.ptable tbody tr { border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.12s; }
.ptable tbody tr:last-child { border-bottom: none; }
.ptable tbody tr:hover { background: rgba(46,224,123,0.05); }
.pcell { display: flex; align-items: center; gap: 10px; }
.pcell .ava { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; font-family: var(--num); font-weight: 700; font-size: 11px; flex-shrink: 0; }
.pcell .nm { font-weight: 600; line-height: 1.2; }
.pcell .ds { font-size: 10.5px; color: var(--mut); }

.perm-row { display: flex; align-items: center; gap: 8px; padding: 8px 0; font-size: 12.5px; }
.perm-row + .perm-row { border-top: 1px solid var(--line); }
.perm-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--line2); border: 1px solid var(--line2); flex-shrink: 0; }
.perm-dot.on { background: var(--green); box-shadow: 0 0 8px var(--green-glow); border-color: var(--green); }

.sub-row { display: flex; align-items: center; gap: 10px; padding: 9px 0; }
.sub-row + .sub-row { border-top: 1px solid var(--line); }
.sub-icon { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; font-size: 14px; flex-shrink: 0; }
.sub-name { font-size: 12.5px; font-weight: 600; line-height: 1.2; }
.sub-sum { font-size: 10.5px; color: var(--mut); margin-top: 2px; }
.sub-when { font-size: 10.5px; color: var(--lbl2); font-family: var(--num); white-space: nowrap; }

.toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); padding: 10px 18px; background: var(--card); border: 1px solid var(--green-bd); border-radius: 99px; font-size: 12.5px; box-shadow: 0 8px 24px rgba(0,0,0,0.5), 0 0 18px -4px var(--green-glow); z-index: 50; }
`;
