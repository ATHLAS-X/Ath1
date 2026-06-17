"use client";

import Link from "next/link";
import "@/app/sportx.css";

const AVA_COLORS = ["#22C55E","#3B82F6","#F59E0B","#8B5CF6","#EC4899","#14B8A6","#EAB308","#F97316"];
function initials(name: string) { return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(); }

interface Props {
  academyName: string;
  profileStatus: string;
  verificationStatus: string;
  counts: { total_players: number; active_players: number; verified_players: number };
  scoutViews30d: number;
  scoutSaves: number;
  invites: { total: number; claimed: number; pending: number };
  fitness: { avg_yoyo: number | null; avg_sprint: number | null; avg_fitness_score: number | null };
  behavioural: { avg_mindset: number | null };
  topPerformers: any[];
  recentPlayers: any[];
}

function fmt(v: number | null | undefined, d = 1) {
  if (v === null || v === undefined || isNaN(v as number)) return "—";
  return Number(v).toFixed(d);
}

export default function AcademyDashboardClient(p: Props) {
  return (
    <div className="sx-root" style={{ minHeight: "100vh", padding: 24 }}>
      <style>{styles}</style>
      <div className="ad-shell">

        <header className="ad-head">
          <div>
            <div className="sect-title">Academy Dashboard</div>
            <h1 className="ad-title">{p.academyName}</h1>
            <div className="ad-badges">
              <span className={`bdg ${p.profileStatus === "Approved" ? "green" : p.profileStatus === "Pending Approval" ? "amber" : "ghost"}`}>
                {p.profileStatus}
              </span>
              <span className="bdg blue">Verification · {p.verificationStatus}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/onboarding/academy" className="btn">Edit profile</Link>
            <Link href="/dashboard/academy/players" className="btn green">+ Add players</Link>
          </div>
        </header>

        {/* Top stat row */}
        <div className="ad-stats">
          <StatCard label="Total players"    value={p.counts.total_players}      icol="#22C55E" />
          <StatCard label="Active"           value={p.counts.active_players}     icol="#3B82F6" sub={`${p.invites.claimed}/${p.invites.total} invites claimed`} />
          <StatCard label="Verified"         value={p.counts.verified_players}   icol="#22C55E" />
          <StatCard label="Scout views (30d)" value={p.scoutViews30d}            icol="#8B5CF6" />
          <StatCard label="Scout saves"      value={p.scoutSaves}                icol="#F59E0B" />
        </div>

        <div className="ad-row2">
          {/* Athletic + behavioural averages */}
          <div className="card ad-card">
            <div className="chead2"><span className="sect-title">Athletic & Behavioral Averages</span></div>
            <div className="cb ad-avg-grid">
              <Avg label="Avg YoYo"     value={fmt(p.fitness.avg_yoyo, 1)} max="20" col="#22C55E" />
              <Avg label="Avg 30m sprint" value={fmt(p.fitness.avg_sprint, 2)} unit="s" col="#3B82F6" />
              <Avg label="Avg fitness score" value={fmt(p.fitness.avg_fitness_score, 0)} max="100" col="#F59E0B" />
              <Avg label="Avg mindset"  value={fmt(p.behavioural.avg_mindset, 1)} max="10" col="#EC4899" />
            </div>
          </div>

          {/* Top performers */}
          <div className="card ad-card">
            <div className="chead2">
              <span className="sect-title">Top Performers</span>
              <span className="bdg ghost">Top 5</span>
            </div>
            <div className="cb">
              {p.topPerformers.length === 0 ? (
                <div style={{ color: "var(--mut)", fontSize: 12.5 }}>No verified scores yet</div>
              ) : (
                p.topPerformers.map((t: any, i: number) => (
                  <Link key={t.user_id} href={`/profile/${t.user_id}`} className="ad-top-row">
                    <span className="ad-rank">{i + 1}</span>
                    <span className="ava" style={{ width: 26, height: 26, fontSize: "9.5px", background: AVA_COLORS[i % AVA_COLORS.length] }}>
                      {initials(t.name)}
                    </span>
                    <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>{t.name}</span>
                    <span style={{ fontFamily: "var(--num)", fontSize: 13, fontWeight: 700, color: "var(--green)" }}>
                      {t.total_score ?? "—"}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Recent players */}
        <div className="card ad-card">
          <div className="chead2">
            <span className="sect-title">Recent Players</span>
            <Link href="/dashboard/academy/players" style={{ color: "var(--green)", fontSize: 12, textDecoration: "none" }}>
              Manage roster →
            </Link>
          </div>
          <div className="cb">
            {p.recentPlayers.length === 0 ? (
              <div style={{ color: "var(--mut)", fontSize: 12.5, padding: "12px 0" }}>
                No players yet —
                <Link href="/dashboard/academy/players" style={{ color: "var(--green)", marginLeft: 6 }}>
                  bulk upload a CSV →
                </Link>
              </div>
            ) : (
              <table className="ad-table">
                <thead><tr><th>Player</th><th>Status</th><th>Claimed</th><th>Created</th></tr></thead>
                <tbody>
                  {p.recentPlayers.map((r: any, i: number) => (
                    <tr key={r.player_profile_id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <span className="ava" style={{ background: AVA_COLORS[i % AVA_COLORS.length] }}>
                            {initials(r.name)}
                          </span>
                          {r.user_id ? (
                            <Link href={`/profile/${r.user_id}`} style={{ color: "var(--text)", fontWeight: 600, textDecoration: "none" }}>
                              {r.name}
                            </Link>
                          ) : (
                            <span style={{ fontWeight: 600 }}>{r.name}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`bdg ${r.profile_status === "Approved" ? "green" : r.profile_status === "Pending Approval" ? "amber" : "ghost"}`}>
                          {r.profile_status ?? "Draft"}
                        </span>
                      </td>
                      <td style={{ color: r.claimed_at ? "var(--green)" : "var(--mut)", fontSize: 11.5 }}>
                        {r.claimed_at ? "✓ Claimed" : "Awaiting claim"}
                      </td>
                      <td style={{ color: "var(--mut)", fontSize: 11.5 }}>
                        {new Date(r.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icol, sub }: { label: string; value: number | string; icol: string; sub?: string }) {
  return (
    <div className="card ad-stat">
      <div className="ad-stat-bar" style={{ background: icol }} />
      <div className="ad-stat-v">{value}</div>
      <div className="ad-stat-l">{label}</div>
      {sub && <div className="ad-stat-sub">{sub}</div>}
    </div>
  );
}

function Avg({ label, value, max, unit, col }: { label: string; value: string; max?: string; unit?: string; col: string }) {
  return (
    <div className="ad-avg">
      <div className="ad-avg-l">{label}</div>
      <div className="ad-avg-v" style={{ color: col }}>
        {value}{unit ? <small style={{ marginLeft: 3, color: "var(--mut)", fontSize: 13 }}>{unit}</small> : null}
        {max && <small style={{ marginLeft: 4, color: "var(--mut)", fontSize: 13, fontWeight: 500 }}>/{max}</small>}
      </div>
    </div>
  );
}

const styles = `
.ad-shell { max-width: 1300px; margin: 0 auto; }
.ad-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
.ad-title { font-family: var(--num); font-size: 30px; font-weight: 700; margin: 4px 0 6px; }
.ad-badges { display: flex; gap: 6px; flex-wrap: wrap; }
.ad-stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 14px; }
@media (max-width: 900px) { .ad-stats { grid-template-columns: repeat(2, 1fr); } }
.ad-stat { padding: 14px 16px; position: relative; overflow: hidden; }
.ad-stat-bar { position: absolute; left: 0; top: 0; bottom: 0; width: 3px; }
.ad-stat-v { font-family: var(--num); font-size: 28px; font-weight: 700; line-height: 1; }
.ad-stat-l { font-size: 11px; color: var(--lbl); margin-top: 4px; }
.ad-stat-sub { font-family: var(--num); font-size: 10.5px; color: var(--mut); margin-top: 6px; }
.ad-row2 { display: grid; grid-template-columns: 1.4fr 1fr; gap: 14px; margin-bottom: 14px; }
@media (max-width: 900px) { .ad-row2 { grid-template-columns: 1fr; } }
.ad-card { overflow: hidden; }
.ad-avg-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.ad-avg { background: var(--card-alt); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; }
.ad-avg-l { font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--lbl); font-family: var(--num); font-weight: 600; }
.ad-avg-v { font-family: var(--num); font-size: 28px; font-weight: 700; margin-top: 4px; line-height: 1; }
.ad-top-row { display: flex; align-items: center; gap: 9px; padding: 9px 0; border-bottom: 1px solid var(--line); text-decoration: none; color: var(--text); }
.ad-top-row:last-child { border-bottom: 0; }
.ad-top-row:hover { background: var(--card-alt); }
.ad-rank { font-family: var(--num); font-size: 13px; font-weight: 700; color: var(--gold); width: 18px; text-align: center; }
.ad-table { width: 100%; border-collapse: collapse; }
.ad-table th { background: var(--head); font-family: var(--num); font-size: 9.5px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: var(--lbl); text-align: left; padding: 9px 12px; }
.ad-table th:first-child { border-radius: 7px 0 0 7px; }
.ad-table th:last-child  { border-radius: 0 7px 7px 0; }
.ad-table td { padding: 9px 12px; font-size: 12.5px; border-top: 1px solid var(--line); }
`;
