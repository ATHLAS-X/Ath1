"use client";

import { useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { initials, Ring, Vlvl } from "@/components/sx/widgets";
import SportXLogo from "@/components/SportXLogo";
import "@/app/sportx.css";

const NAV = [
  { n: "Overview",            href: "/admin",          ic: '<rect x="1.5" y="1.5" width="11" height="11" rx="2"/><path d="M1.5 5.5H12.5M5.5 5.5V12.5"/>' },
  { n: "Verification Queue",  href: "/admin#verifications", badgeKey: "pending_verifications", bc: "amber",
    ic: '<path d="M7 1L12 3V7C12 10 10 12.4 7 13C4 12.4 2 10 2 7V3L7 1Z"/><path d="M5 7L6.4 8.4L9 5.6"/>' },
  { n: "Consent Alerts",      href: "/admin#consent",  badgeKey: "consent_blocked", bc: "red",
    ic: '<path d="M7 1.5L13 12H1L7 1.5Z"/><path d="M7 6V8.5M7 10.5V10.6"/>' },
  { n: "Approvals",           href: "/admin#approvals", ic: '<circle cx="7" cy="4.5" r="2.5"/><path d="M2.5 12C2.5 9.8 4.5 8.3 7 8.3C9.5 8.3 11.5 9.8 11.5 12"/>' },
  { n: "Users",               href: "/admin/users",    ic: '<circle cx="5" cy="5" r="2"/><circle cx="9.5" cy="5.5" r="1.5"/><path d="M1.8 11.5C1.8 9.7 3.2 8.5 5 8.5C6.8 8.5 8.2 9.7 8.2 11.5M9.3 8.7C10.9 8.7 12.2 9.8 12.2 11.5"/>' },
  { n: "Workflow",            href: "/workflow",       ic: '<rect x="1.5" y="3.5" width="3" height="3" rx="0.5"/><rect x="9.5" y="3.5" width="3" height="3" rx="0.5"/><rect x="1.5" y="9" width="3" height="3" rx="0.5"/><rect x="9.5" y="9" width="3" height="3" rx="0.5"/><path d="M4.5 5H9.5M4.5 10.5H9.5"/>' },
  { n: "Settings",            href: "/admin/settings", ic: '<circle cx="7" cy="7" r="2"/><path d="M7 1.5V3M7 11V12.5M12.5 7H11M3 7H1.5M10.9 3.1L9.8 4.2M4.2 9.8L3.1 10.9M10.9 10.9L9.8 9.8M4.2 4.2L3.1 3.1"/>' },
];

const TYPE_COLOR: Record<string, string> = {
  IDENTITY: "blue", PERFORMANCE: "green", SCOUT: "amber", FITNESS: "purple", ACADEMY: "purple",
};

interface Props {
  session: any;
  stats: { total_players: number; scout_visible: number; active_scouts: number; pending_verifications: number; consent_blocked: number };
  verificationQueue: any[];
  pendingPlayers: any[];
  pendingAcademies: any[];
  pendingScouts: any[];
  consent: { minors: number; minors_with_consent: number };
  consentBlocked: any[];
  levelDistribution: any[];
  signups: any[];
  activity: Array<{ day: string; players: number; scouts: number }>;
}

/* 30-day registrations line chart (players + scouts) */
function ActivityChart({ data }: { data: Array<{ day: string; players: number; scouts: number }> }) {
  const W = 700, H = 200;
  const p = { t: 12, r: 10, b: 24, l: 36 };
  const cw = W - p.l - p.r, ch = H - p.t - p.b;
  const maxY = Math.max(4, ...data.map((d) => Math.max(d.players, d.scouts)));
  const n = Math.max(2, data.length);

  const pathFor = (key: "players" | "scouts") =>
    data.map((d, i) => {
      const x = p.l + (i / (n - 1)) * cw;
      const y = p.t + ch - (d[key] / maxY) * ch;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");

  const pPath = pathFor("players");
  const area = `${pPath} L ${(p.l + cw).toFixed(1)},${(p.t + ch).toFixed(1)} L ${p.l},${(p.t + ch).toFixed(1)} Z`;
  const gridVals = [0.25, 0.5, 0.75, 1].map((f) => Math.round(maxY * f));
  const xTicks = [0, 7, 14, 21, 29].filter((i) => i < n);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: "block", height: 200 }}>
      <defs>
        <linearGradient id="actg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2EE07B" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#2EE07B" stopOpacity="0" />
        </linearGradient>
      </defs>
      {gridVals.map((gv) => {
        const gy = p.t + ch - (gv / maxY) * ch;
        return (
          <g key={gv}>
            <line x1={p.l} y1={gy} x2={p.l + cw} y2={gy} stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="2,5" />
            <text x={p.l - 6} y={gy} textAnchor="end" dominantBaseline="middle" fill="#4A534F" fontSize="8.5" fontFamily="Space Grotesk,monospace">{gv}</text>
          </g>
        );
      })}
      {xTicks.map((i) => {
        const x = p.l + (i / (n - 1)) * cw;
        const d = new Date(data[i].day);
        const lbl = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
        return (
          <text key={i} x={x} y={p.t + ch + 15} textAnchor="middle" fill="#4A534F" fontSize="8.5" fontFamily="Space Grotesk,monospace">{lbl}</text>
        );
      })}
      <path d={area} fill="url(#actg)" />
      <path d={pPath} fill="none" stroke="#2EE07B" strokeWidth="1.8" strokeLinejoin="round" style={{ filter: "drop-shadow(0 2px 6px rgba(46,224,123,0.3))" }} />
      <path d={pathFor("scouts")} fill="none" stroke="#4D9FFF" strokeWidth="1.5" strokeLinejoin="round" opacity="0.85" />
    </svg>
  );
}

export default function AdminDashboardClient(p: Props) {
  const pathname = usePathname();
  const user = p.session?.user;
  const [toast, setToast] = useState("");
  const [verQueue, setVerQueue] = useState(p.verificationQueue);
  const [queueTab, setQueueTab] = useState("All");
  const [players, setPlayers] = useState(p.pendingPlayers);
  const [academies, setAcademies] = useState(p.pendingAcademies);
  const [scouts, setScouts] = useState(p.pendingScouts);
  const [stats, setStats] = useState(p.stats);

  const showToast = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2600);
  }, []);

  async function verAction(id: string, action: "approve" | "reject") {
    const res = await fetch("/api/admin/verifications", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.success) {
      setVerQueue((q) => q.filter((x) => x.id !== id));
      setStats((s) => ({ ...s, pending_verifications: Math.max(0, s.pending_verifications - 1) }));
      showToast(action === "approve"
        ? `✓ Approved${data.new_level ? ` — player now L${data.new_level}` : ""}`
        : "Verification rejected");
    } else showToast(data.error ?? "Action failed");
  }

  async function profileAction(kind: string, id: string, action: string) {
    const res = await fetch("/api/admin/approvals", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, id, action }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.success) {
      if (kind === "player") setPlayers((x) => x.filter((r) => r.id !== id));
      if (kind === "academy") setAcademies((x) => x.filter((r) => r.id !== id));
      if (kind === "scout") setScouts((x) => x.filter((r) => r.user_id !== id));
      showToast(
        action === "approve"
          ? kind === "player"
            ? `✓ Live — visibility: ${data.visibility}${data.consent_ok === false ? " (no visibility consent)" : ""}`
            : "✓ Approved"
          : action === "reject" ? "Rejected" : "Changes requested",
      );
    } else showToast(data.error ?? "Action failed");
  }

  const consentPct = p.consent.minors > 0
    ? Math.round((p.consent.minors_with_consent / p.consent.minors) * 100)
    : 100;

  const distMax = Math.max(...p.levelDistribution.map((d: any) => Number(d.c)), 1);
  const DIST_META = [
    { lvl: 4, n: "L4 Scout Verified",  col: "#EAB308" },
    { lvl: 3, n: "L3 Performance",     col: "#2EE07B" },
    { lvl: 2, n: "L2 Identity",        col: "#4D9FFF" },
    { lvl: 1, n: "L1 Self Registered", col: "#6A746C" },
  ];

  const STAT_DEFS = [
    { v: stats.total_players.toLocaleString("en-IN"), l: "Total Players", d: "platform-wide", dc: "#2EE07B", icol: "#2EE07B",
      ic: '<circle cx="5" cy="5" r="2"/><circle cx="9.5" cy="5.5" r="1.5"/><path d="M1.8 11.5C1.8 9.7 3.2 8.5 5 8.5C6.8 8.5 8.2 9.7 8.2 11.5M9.3 8.7C10.9 8.7 12.2 9.8 12.2 11.5"/>' },
    { v: stats.scout_visible.toLocaleString("en-IN"), l: "Scout-Visible Profiles", d: "live + consented", dc: "#2EE07B", icol: "#4D9FFF",
      ic: '<path d="M1.5 7C3 4 5 2.5 7 2.5C9 2.5 11 4 12.5 7C11 10 9 11.5 7 11.5C5 11.5 3 10 1.5 7Z"/><circle cx="7" cy="7" r="2"/>' },
    { v: String(stats.active_scouts), l: "Active Scouts", d: "approved accounts", dc: "#2EE07B", icol: "#A78BFA",
      ic: '<circle cx="6" cy="6" r="4"/><path d="M9 9L12.5 12.5"/>' },
    { v: String(stats.pending_verifications), l: "Pending Verifications", d: "needs review", dc: "#FBBF24", icol: "#FBBF24", alert: stats.pending_verifications > 0,
      ic: '<path d="M7 1L12 3V7C12 10 10 12.4 7 13C4 12.4 2 10 2 7V3L7 1Z"/><path d="M7 4.5V7.5M7 9.5V9.6"/>' },
    { v: String(stats.consent_blocked), l: "Consent Blocks", d: "minors · urgent", dc: "#F87171", icol: "#F87171", alert: stats.consent_blocked > 0,
      ic: '<path d="M7 1.5L13 12H1L7 1.5Z"/><path d="M7 6V8.5M7 10.5V10.6"/>' },
  ];

  return (
    <div className="sx-root">
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      {toast && <div className="adm-toast">{toast}</div>}

      <div className="shell">
        {/* ═══ SIDEBAR ═══ */}
        <aside className="sidebar">
          <div className="logo-row">
            <SportXLogo />
          </div>
          <div className="admin-lbl">Admin Panel</div>
          <nav>
            {NAV.map((item) => {
              const active = item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href.split("#")[0]) && item.href !== "/admin";
              const badge = item.badgeKey ? (stats as any)[item.badgeKey] : 0;
              return (
                <Link key={item.n} href={item.href} className={`nav-item${active && !item.href.includes("#") ? " active" : ""}`}>
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none"
                    stroke={active ? "#2EE07B" : "#6A746C"} strokeWidth="1.2"
                    strokeLinecap="round" strokeLinejoin="round"
                    dangerouslySetInnerHTML={{ __html: item.ic }} />
                  {item.n}
                  {badge > 0 && <span className={`nav-count ${item.bc}`}>{badge}</span>}
                </Link>
              );
            })}
          </nav>
          <div className="card admin-card">
            <div className="admin-ava">{initials(user?.name ?? "AD")}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "12.5px", fontWeight: 600 }}>{user?.name ?? "Admin"}</div>
              <div style={{ fontSize: 10, color: "var(--amber)" }}>Super Admin</div>
            </div>
          </div>
        </aside>

        {/* ═══ MAIN ═══ */}
        <div className="main">

          {/* Workflow context strip */}
          <div className="card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span className="sect-title" style={{ marginRight: "auto" }}>Trust & Safety — All Phases</span>
            <span className="bdg red">P1 · Account approval</span>
            <span className="bdg red">P2 · Identity flags</span>
            <span className="bdg red">P4 · Scorecard review</span>
            <span className="bdg red">P5 · Consent compliance</span>
            <span className="bdg red">P6 · Scout endorsement</span>
            <Link href="/workflow" className="btn sm" style={{ textDecoration: "none" }}>View Workflow →</Link>
          </div>

          {/* Stat cards */}
          <div className="stats-row">
            {STAT_DEFS.map((s) => (
              <div key={s.l} className="card stat-card">
                {s.alert && <span className="pulse-dot" style={{ background: s.dc, boxShadow: `0 0 8px ${s.dc}` }} />}
                <div className="ic" style={{ background: `linear-gradient(168deg,${s.icol}2E,${s.icol}10)`, border: `1px solid ${s.icol}40` }}>
                  <svg width="15" height="15" viewBox="0 0 14 14" fill="none" stroke={s.icol}
                    strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"
                    dangerouslySetInnerHTML={{ __html: s.ic }} />
                </div>
                <div className="v">{s.v}</div>
                <div className="l">{s.l}</div>
                <div className="d" style={{ color: s.dc }}>{s.d}</div>
              </div>
            ))}
          </div>

          {/* Verification queue + consent */}
          <div className="row2" id="verifications">
            <div className="card">
              <div className="chead2">
                <span className="sect-title">Verification Review Queue</span>
                <div className="tabs">
                  {["All", "Identity", "Performance", "Scout", "Academy"].map((t) => (
                    <button key={t} className={`tab${queueTab === t ? " on" : ""}`}
                      onClick={() => setQueueTab(t)}>
                      {t}{t === "All" ? ` · ${stats.pending_verifications}` : ""}
                    </button>
                  ))}
                </div>
              </div>
              <div className="cb">
                {(() => {
                  const shown = queueTab === "All"
                    ? verQueue
                    : verQueue.filter((q: any) => String(q.verification_type).toLowerCase() === queueTab.toLowerCase());
                  return shown.length === 0 ? (
                    <div className="adm-empty">No pending {queueTab === "All" ? "" : queueTab.toLowerCase() + " "}verifications</div>
                  ) : shown.map((q: any) => (
                  <div key={q.id} className="q-row">
                    <div className="q-main">
                      <div className="t">{q.player_name ?? "Player"} — {String(q.verification_type).toLowerCase()} verification</div>
                      <div className="s">
                        Submitted {new Date(q.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                        {q.submitted_by ? ` · by ${q.submitted_by}` : ""}
                        {q.evidence_url && (
                          <> · <a href={q.evidence_url} target="_blank" rel="noreferrer" style={{ color: "var(--blue)" }}>evidence ↗</a></>
                        )}
                      </div>
                    </div>
                    <span className={`bdg ${TYPE_COLOR[q.verification_type] ?? "ghost"}`}>{q.verification_type}</span>
                    <div className="q-actions">
                      <button className="btn sm green" onClick={() => verAction(q.id, "approve")}>Approve</button>
                      <button className="btn sm danger" onClick={() => verAction(q.id, "reject")}>Reject</button>
                    </div>
                  </div>
                  ));
                })()}
              </div>
            </div>

            <div className="card" id="consent">
              <div className="chead2">
                <span className="sect-title">Consent Compliance — Minors</span>
                {stats.consent_blocked > 0 && <span className="bdg red">{stats.consent_blocked} blocked</span>}
              </div>
              <div className="cb">
                <div className="consent-big">
                  <Ring pct={consentPct} size={76} stroke={7} />
                  <span className="consent-meta">
                    <span className="v">{p.consent.minors_with_consent.toLocaleString("en-IN")}</span><br />
                    <span className="l">of {p.consent.minors.toLocaleString("en-IN")} minor profiles have<br />parent/guardian consent on file</span>
                  </span>
                </div>
                <div style={{ marginTop: 8 }}>
                  {p.consentBlocked.map((c: any, i: number) => (
                    <div key={i} className="con-row">
                      <span className="nm">{c.name} ({c.age}) <span className="ag">· consent incomplete</span></span>
                      <span className="bdg red" style={{ height: 18 }}>Blocked</span>
                    </div>
                  ))}
                  {p.consentBlocked.length === 0 && <div className="adm-empty">All minors consented ✓</div>}
                </div>
              </div>
            </div>
          </div>

          {/* Platform activity + verification distribution */}
          <div className="row2">
            <div className="card">
              <div className="chead2">
                <span className="sect-title">Platform Activity — Last 30 Days</span>
                <span style={{ display: "flex", gap: 12, fontSize: "10.5px", color: "var(--lbl)" }}>
                  <span><i className="leg-dot" style={{ background: "var(--green)", boxShadow: "0 0 6px var(--green-glow)" }} />Players</span>
                  <span><i className="leg-dot" style={{ background: "var(--blue)" }} />Scouts</span>
                </span>
              </div>
              <div className="cb">
                <ActivityChart data={p.activity} />
              </div>
            </div>

            <div className="card">
              <div className="chead2"><span className="sect-title">Verification Level Distribution</span></div>
              <div className="cb">
                {DIST_META.map((m) => {
                  const row = p.levelDistribution.find((d: any) => Number(d.lvl) === m.lvl);
                  const c = Number(row?.c ?? 0);
                  return (
                    <div key={m.lvl} className="dist-row">
                      <span className="n">{m.n}</span>
                      <div className="track">
                        <div className="fill" style={{ width: `${((c / distMax) * 100).toFixed(1)}%`, background: `linear-gradient(180deg,${m.col}E6,${m.col}88)` }} />
                      </div>
                      <span className="c">{c.toLocaleString("en-IN")}</span>
                    </div>
                  );
                })}
                <div style={{ fontSize: 10, color: "var(--mut)", marginTop: 12 }}>
                  Goal: move players up the ladder — verified profiles get more scout views.
                </div>
              </div>
            </div>
          </div>

          {/* Profile approvals */}
          <div className="row2" id="approvals">
            <div className="card">
              <div className="chead2">
                <span className="sect-title">Player Profile Approvals</span>
                <span className="bdg amber">{players.length} pending</span>
              </div>
              <div className="cb">
                {players.length === 0 ? (
                  <div className="adm-empty">No pending player profiles</div>
                ) : players.map((r: any) => (
                  <div key={r.id} className="q-row">
                    <div className="q-main">
                      <div className="t">{r.name}</div>
                      <div className="s">{r.state ?? "—"} · {r.source_channel ?? "Independent"} · submitted {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}</div>
                    </div>
                    <div className="q-actions">
                      <button className="btn sm green" onClick={() => profileAction("player", r.id, "approve")}>Approve</button>
                      <button className="btn sm" onClick={() => profileAction("player", r.id, "request_changes")}>Changes</button>
                      <button className="btn sm danger" onClick={() => profileAction("player", r.id, "reject")}>Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="chead2"><span className="sect-title">Academy & Scout Approvals</span></div>
              <div className="cb">
                {academies.map((r: any) => (
                  <div key={r.id} className="q-row">
                    <div className="q-main">
                      <div className="t">{r.name}</div>
                      <div className="s">Academy · {r.player_count ?? 0} players · {r.state ?? "—"}</div>
                    </div>
                    <span className="bdg purple">Academy</span>
                    <div className="q-actions">
                      <button className="btn sm green" onClick={() => profileAction("academy", r.id, "approve")}>Approve</button>
                      <button className="btn sm danger" onClick={() => profileAction("academy", r.id, "reject")}>Reject</button>
                    </div>
                  </div>
                ))}
                {scouts.map((r: any) => (
                  <div key={r.user_id} className="q-row">
                    <div className="q-main">
                      <div className="t">{r.name}</div>
                      <div className="s">Scout · {r.email}</div>
                    </div>
                    <span className="bdg amber">Scout</span>
                    <div className="q-actions">
                      <button className="btn sm green" onClick={() => profileAction("scout", r.user_id, "approve")}>Approve</button>
                      <button className="btn sm danger" onClick={() => profileAction("scout", r.user_id, "reject")}>Reject</button>
                    </div>
                  </div>
                ))}
                {academies.length === 0 && scouts.length === 0 && (
                  <div className="adm-empty">No pending academies or scouts</div>
                )}
              </div>
            </div>
          </div>

          {/* Recent registrations */}
          <div>
            <div className="card" style={{ overflow: "hidden" }}>
              <div className="chead2" style={{ paddingBottom: 11 }}>
                <span className="sect-title">Recent Registrations</span>
                <span className="bdg ghost">by source channel</span>
              </div>
              <table className="sg-table">
                <thead><tr><th>Name</th><th>Role</th><th>Source</th><th>State</th><th>Signed Up</th><th>Level</th><th>Status</th></tr></thead>
                <tbody>
                  {p.signups.map((s: any) => {
                    const srcColor = s.source_channel === "Academy" ? "blue" : s.source_channel === "Tournament" ? "purple" : "ghost";
                    const live = s.profile_status === "Live";
                    return (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 600 }}>
                          <a href={`/profile/${s.id}`} target="_blank" rel="noreferrer" style={{ color: "var(--text)", textDecoration: "none" }}>{s.name}</a>
                        </td>
                        <td><span className="bdg blue" style={{ height: 17, fontSize: "8.5px" }}>{s.playing_role}</span></td>
                        <td><span className={`bdg ${srcColor}`} style={{ height: 17, fontSize: "8.5px" }}>{String(s.source_channel).replace(" Player", "")}</span></td>
                        <td style={{ color: "#8B958D" }}>{s.state || "—"}</td>
                        <td className="tm">{relTime(s.created_at)}</td>
                        <td><Vlvl level={s.verification_level} compact /></td>
                        <td><span className={`bdg ${live ? "green" : "ghost"}`} style={{ height: 17, fontSize: "8.5px" }}>{live ? "Live" : s.profile_status}</span></td>
                      </tr>
                    );
                  })}
                  {p.signups.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--mut)", padding: 16 }}>No registrations yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function relTime(d: string): string {
  if (!d) return "—";
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} days ago`;
}

const styles = `
@keyframes softPulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
.sx-root { font-family: 'Instrument Sans', system-ui, sans-serif; }
.shell { max-width: 1500px; margin: 0 auto; display: grid; grid-template-columns: 228px 1fr; gap: 16px; padding: 18px; align-items: start; }
.sidebar { position: sticky; top: 18px; display: flex; flex-direction: column; gap: 4px; }
.logo-row { display: flex; align-items: center; gap: 10px; padding: 6px 4px; }
.logo-ball { width: 26px; height: 26px; border-radius: 50%; background: radial-gradient(circle at 32% 28%, #46ff97, #0e6e33 72%); box-shadow: 0 0 16px var(--green-glow), inset 0 -5px 8px rgba(0,0,0,0.35), inset 0 2px 3px rgba(255,255,255,0.4); position: relative; }
.logo-ball::after { content: ''; position: absolute; left: 50%; top: 3px; bottom: 3px; width: 1.5px; background: rgba(4,20,10,0.5); transform: translateX(-50%) rotate(14deg); border-radius: 99px; }
.logo-word { font-family: var(--num); font-size: 16px; font-weight: 700; letter-spacing: 0.05em; }
.logo-word em { font-style: normal; color: var(--green); text-shadow: 0 0 14px var(--green-glow); }
.admin-lbl { font-family: var(--num); font-size: 9px; font-weight: 600; letter-spacing: 2.5px; text-transform: uppercase; color: var(--amber); padding: 2px 4px 12px; }
.nav-item { display: flex; align-items: center; gap: 9px; padding: 9px 12px; border-radius: 10px; border: 1px solid transparent; color: var(--lbl); font-size: 12.5px; font-weight: 500; cursor: pointer; text-decoration: none; transition: all 0.16s; }
.nav-item:hover { color: var(--text); background: var(--card-alt); border-color: var(--line); }
.nav-item.active { color: var(--text); background: linear-gradient(168deg, rgba(46,224,123,0.13), rgba(46,224,123,0.04)); border-color: var(--green-bd); box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 6px 18px -8px var(--green-glow); }
.nav-count { margin-left: auto; min-width: 19px; height: 18px; padding: 0 6px; border-radius: 99px; display: grid; place-items: center; font-family: var(--num); font-size: 9.5px; font-weight: 700; }
.nav-count.amber { background: var(--amber-bg); color: var(--amber); border: 1px solid var(--amber-bd); }
.nav-count.red   { background: var(--red-bg);   color: var(--red);   border: 1px solid var(--red-bd); }
.admin-card { margin-top: 14px; padding: 12px; display: flex; align-items: center; gap: 10px; }
.admin-ava { width: 34px; height: 34px; border-radius: 50%; background: radial-gradient(circle at 32% 28%, #ffd96b, #9c5d06 75%); display: grid; place-items: center; font-family: var(--num); font-weight: 700; font-size: 11px; color: #140d02; box-shadow: inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -6px 9px rgba(0,0,0,0.3), 0 3px 10px rgba(0,0,0,0.5); }
.main { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.chead2 { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px 0; }
.cb { padding: 12px 14px 14px; }
.stats-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
.stat-card { padding: 14px 15px; position: relative; overflow: hidden; }
.stat-card .ic { width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center; margin-bottom: 10px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), 0 3px 8px -2px rgba(0,0,0,0.5); }
.stat-card .v { font-family: var(--num); font-size: 25px; font-weight: 700; line-height: 1; }
.stat-card .l { font-size: 10.5px; color: var(--lbl); margin-top: 4px; }
.stat-card .d { font-family: var(--num); font-size: 10.5px; font-weight: 600; margin-top: 6px; }
.pulse-dot { position: absolute; top: 13px; right: 13px; width: 7px; height: 7px; border-radius: 50%; animation: softPulse 1.8s ease-in-out infinite; }
.row2 { display: grid; grid-template-columns: 1.45fr 1fr; gap: 16px; align-items: start; }
.row4 { display: grid; grid-template-columns: 1fr 1.45fr; gap: 16px; align-items: start; }
@media (max-width: 1000px) { .row2, .row4 { grid-template-columns: 1fr; } .stats-row { grid-template-columns: repeat(2, 1fr); } }
.q-row { display: flex; align-items: center; gap: 9px; padding: 9px 0; }
.q-row + .q-row { border-top: 1px solid var(--line); }
.q-main { flex: 1; min-width: 0; }
.q-main .t { font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.q-main .s { font-size: 10px; color: var(--mut); margin-top: 1px; }
.q-actions { display: flex; gap: 5px; flex-shrink: 0; }
.leg-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 4px; }
.consent-big { display: flex; align-items: center; gap: 14px; }
.consent-meta .v { font-family: var(--num); font-size: 26px; font-weight: 700; color: var(--green); }
.consent-meta .l { font-size: 10.5px; color: var(--lbl); margin-top: 2px; }
.con-row { display: flex; align-items: center; gap: 8px; padding: 8px 0; font-size: 12px; }
.con-row + .con-row { border-top: 1px solid var(--line); }
.con-row .nm { flex: 1; font-weight: 600; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.con-row .ag { color: var(--mut); font-size: 10.5px; font-weight: 400; }
.dist-row { display: flex; align-items: center; gap: 9px; margin-bottom: 11px; }
.dist-row:last-child { margin-bottom: 0; }
.dist-row .n { font-family: var(--num); font-size: 10px; color: var(--lbl); width: 96px; flex-shrink: 0; }
.dist-row .track { flex: 1; height: 16px; border-radius: 6px; overflow: hidden; background: rgba(0,0,0,0.35); border: 1px solid var(--line); box-shadow: inset 0 2px 4px rgba(0,0,0,0.4); }
.dist-row .fill { height: 100%; border-radius: 5px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.25); }
.dist-row .c { font-family: var(--num); font-size: 11.5px; font-weight: 600; width: 48px; text-align: right; flex-shrink: 0; }
.sg-table { width: 100%; border-collapse: collapse; }
.sg-table th { background: var(--head); font-family: var(--num); font-size: 9px; font-weight: 600; letter-spacing: 1.4px; text-transform: uppercase; color: var(--lbl); text-align: left; padding: 8px 11px; }
.sg-table th:first-child { border-radius: 8px 0 0 8px; }
.sg-table th:last-child { border-radius: 0 8px 8px 0; }
.sg-table td { font-size: 11.5px; padding: 8px 11px; vertical-align: middle; }
.sg-table tbody tr { border-bottom: 1px solid rgba(255,255,255,0.04); }
.sg-table tbody tr:last-child { border-bottom: none; }
.sg-table td .tm { color: var(--mut); font-size: 10.5px; }
.adm-empty { padding: 18px 0; text-align: center; color: var(--mut); font-size: 12.5px; }
.adm-toast { position: fixed; bottom: 24px; right: 24px; z-index: 999; background: #121712; border: 1px solid var(--line2); border-radius: 10px; padding: 10px 18px; font-size: 12.5px; font-weight: 600; color: var(--green); box-shadow: 0 4px 24px rgba(0,0,0,0.6); }
`;
