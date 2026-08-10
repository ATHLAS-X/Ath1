"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { Skeleton, SkeletonStyles } from "@/components/ui/Skeleton";

/* /academy/fitness — academy-wide fitness assessment overview.
   Filters: player name search, date range, supervised-only, coach.
   The Coach Verified vs Self-reported badge is ALWAYS visible per the
   spec. Permanent (not dismissible) info banner explains the scoring
   rule at the top of the page. CSV export is client-side. */

interface Props {
  academyName: string;
  adminName: string;
  adminEmail: string;
}

interface AssessmentRow {
  id: string;
  assessment_date: string;
  yoyo_score: number | null;
  sprint_30m: number | null;
  run_2km: number | null;
  notes: string | null;
  is_supervised: boolean;
  assessed_by_coach_id: string | null;
  player_id: string;
  player_name: string;
  player_user_id: string | null;
  playing_role: string | null;
  coach_name: string | null;
  specialization: string | null;
}

interface Coach { id: string; coach_name: string }

const NAV = [
  { label: "Dashboard",             href: "/academy/dashboard" },
  { label: "Players",               href: "/academy/players" },
  { label: "Coaches",               href: "/academy/coaches" },
  { label: "Fitness & Assessments", href: "/academy/fitness" },
  { label: "Settings",              href: "/academy/settings" },
];

export default function FitnessClient(p: Props) {
  const pathname = usePathname() ?? "";
  const [rows, setRows] = useState<AssessmentRow[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  /* Filters */
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [supervisedOnly, setSupervisedOnly] = useState(false);
  const [coachId, setCoachId] = useState("");

  const fetchList = useCallback(async () => {
    setLoading(true); setFetchError(false);
    const qs = new URLSearchParams();
    if (search) qs.set("search", search);
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    if (supervisedOnly) qs.set("supervised", "1");
    if (coachId) qs.set("coach", coachId);
    try {
      const res = await fetch(`/api/academy/fitness?${qs.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (data?.success) {
        setRows(data.assessments ?? []);
        setCoaches(data.coaches ?? []);
      } else {
        setFetchError(true);
      }
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [search, from, to, supervisedOnly, coachId]);

  /* Debounce search; immediate for the others. */
  useEffect(() => {
    const t = setTimeout(fetchList, 220);
    return () => clearTimeout(t);
  }, [fetchList]);

  const supervisedCount = useMemo(() => rows.filter((r) => r.is_supervised).length, [rows]);
  const selfReportedCount = rows.length - supervisedCount;

  const clearFilters = () => {
    setSearch(""); setFrom(""); setTo(""); setSupervisedOnly(false); setCoachId("");
  };

  const exportCsv = () => {
    const headers = [
      "player_name", "playing_role",
      "assessment_date", "yoyo_score", "sprint_30m_seconds", "run_2km_minutes",
      "is_supervised", "supervised_label", "coach_name", "coach_specialization", "notes",
    ];
    const esc = (v: string) => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    const lines = [headers.join(",")];
    for (const r of rows) {
      const supLabel = r.is_supervised ? "Coach Verified" : "Self-reported";
      lines.push([
        r.player_name ?? "",
        r.playing_role ?? "",
        r.assessment_date ? new Date(r.assessment_date).toISOString().slice(0, 10) : "",
        r.yoyo_score ?? "",
        r.sprint_30m ?? "",
        r.run_2km ?? "",
        String(r.is_supervised),
        supLabel,
        r.coach_name ?? "",
        r.specialization ?? "",
        (r.notes ?? "").replace(/\r?\n/g, " "),
      ].map((v) => esc(String(v))).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `athlasx-fitness-assessments-${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} assessment${rows.length === 1 ? "" : "s"}`);
  };

  const initials = p.adminName.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const hasFilters = search || from || to || supervisedOnly || coachId;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--ax-bg)", color: "var(--ax-text)", fontFamily: "var(--ax-font-body)" }}>
      <style>{STYLES}</style>
      <SkeletonStyles />

      <aside className="fc-sidebar">
        <div className="fc-brand">
          <div>
            <div className="fc-word">ATHLAS<em>X</em></div>
            <div className="fc-sub">Academy admin</div>
          </div>
        </div>
        <nav className="fc-nav">
          {NAV.map((item) => {
            const active = pathname === item.href || (item.href !== "/academy/dashboard" && pathname.startsWith(item.href));
            return <Link key={item.href} href={item.href} className={`fc-link${active ? " on" : ""}`}>{item.label}</Link>;
          })}
        </nav>
      </aside>

      <div style={{ flex: 1, minWidth: 0 }}>
        <header className="fc-topbar">
          <div className="fc-title">
            <h1>Fitness &amp; Assessments</h1>
            <div className="fc-tsub">
              {p.academyName} · {loading ? "loading…" : `${rows.length} assessment${rows.length === 1 ? "" : "s"} · ${supervisedCount} coach-verified · ${selfReportedCount} self-reported`}
            </div>
          </div>
          <div className="fc-top-right">
            <div className="fc-admin">
              <div className="fc-avatar">{initials}</div>
              <div>
                <div className="fc-admin-n">{p.adminName}</div>
                <div className="fc-admin-e">{p.adminEmail}</div>
              </div>
            </div>
            <button className="fc-logout" onClick={() => signOut({ callbackUrl: "/auth/login" })}>Logout</button>
          </div>
        </header>

        <main className="fc-main">
          {/* Always-visible scoring-rule banner — not dismissible. */}
          <div className="fc-banner" role="note">
            <div className="fc-banner-icon" aria-hidden>ⓘ</div>
            <div className="fc-banner-text">
              <strong>Coach-verified assessments contribute to a player&apos;s AthlasX
              Score.</strong> Self-reported entries are displayed but excluded
              from scoring.
            </div>
          </div>

          {/* Filters */}
          <div className="fc-filters">
            <input
              className="fc-input fc-search"
              placeholder="Search by player name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <label className="fc-date">
              <span className="fc-date-label">From</span>
              <input type="date" className="fc-input" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="fc-date">
              <span className="fc-date-label">To</span>
              <input type="date" className="fc-input" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
            <select className="fc-input fc-coach" value={coachId} onChange={(e) => setCoachId(e.target.value)}>
              <option value="">All coaches</option>
              {coaches.map((c) => <option key={c.id} value={c.id}>{c.coach_name}</option>)}
            </select>
            <label className="fc-supervised">
              <input type="checkbox" checked={supervisedOnly} onChange={(e) => setSupervisedOnly(e.target.checked)} />
              <span>Supervised only</span>
            </label>
            <button className="fc-clear" onClick={clearFilters} disabled={!hasFilters}>
              Clear filters
            </button>
            <button className="fc-export" onClick={exportCsv} disabled={rows.length === 0}>
              ↓ Export CSV
            </button>
          </div>

          {/* Table */}
          <div className="fc-card">
            <div className="fc-table-wrap">
              <table className="fc-table">
                <thead>
                  <tr>
                    <th>Player Name</th>
                    <th>Date</th>
                    <th>Yo-Yo</th>
                    <th>30m Sprint</th>
                    <th>2km Run</th>
                    <th>Supervised</th>
                    <th>Coach</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <>
                      {[0, 1, 2, 3, 4].map((i) => (
                        <tr key={`sk-${i}`}>
                          <td><Skeleton width="65%" height={14} /></td>
                          <td><Skeleton width="55%" height={14} /></td>
                          <td><Skeleton width={40} height={14} /></td>
                          <td><Skeleton width={50} height={14} /></td>
                          <td><Skeleton width={60} height={14} /></td>
                          <td><Skeleton width={100} height={20} /></td>
                          <td><Skeleton width="60%" height={14} /></td>
                          <td style={{ textAlign: "right" }}><Skeleton width={90} height={14} /></td>
                        </tr>
                      ))}
                    </>
                  )}
                  {!loading && fetchError && (
                    <tr><td colSpan={8} className="fc-empty">
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ax-text)", marginBottom: 6 }}>
                        Couldn&apos;t load assessments
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--ax-text-faint)", marginBottom: 12 }}>
                        Check your connection and try again.
                      </div>
                      <button className="fc-export" style={{ marginLeft: 0 }} onClick={fetchList}>Try again</button>
                    </td></tr>
                  )}
                  {!loading && !fetchError && rows.length === 0 && (
                    <tr><td colSpan={8} className="fc-empty">
                      {hasFilters
                        ? <>No assessments match these filters. <button className="fc-link-btn" onClick={clearFilters}>Clear filters</button></>
                        : "No assessments recorded yet. Add one from a player profile under Fitness Assessments."}
                    </td></tr>
                  )}
                  {!loading && rows.map((r) => (
                    <tr key={r.id}>
                      <td className="fc-name">{r.player_name || "—"}</td>
                      <td className="fc-muted">
                        {r.assessment_date
                          ? new Date(r.assessment_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                          : "—"}
                      </td>
                      <td className="fc-num">{r.yoyo_score ?? "—"}</td>
                      <td className="fc-num">{r.sprint_30m != null ? `${r.sprint_30m} s` : "—"}</td>
                      <td className="fc-num">{r.run_2km != null ? `${r.run_2km} min` : "—"}</td>
                      <td>
                        {/* Always visible — per the spec, never hide this badge. */}
                        {r.is_supervised
                          ? <Badge bg="var(--ax-ok-soft)" fg="var(--ax-ok)" border="var(--ax-ok-border)">Coach Verified</Badge>
                          : <Badge bg="var(--ax-field)" fg="var(--ax-text-dim)" border="var(--ax-border)">Self-reported</Badge>}
                      </td>
                      <td className="fc-muted">
                        {r.coach_name
                          ? <>{r.coach_name}{r.specialization ? <span className="fc-muted-sm"> · {r.specialization}</span> : null}</>
                          : "—"}
                      </td>
                      <td className="fc-actions">
                        <Link className="fc-link-btn" href={`/academy/players/${r.player_id}`}>View Player</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function Badge({ children, bg, fg, border }: { children: React.ReactNode; bg: string; fg: string; border?: string }) {
  return (
    <span style={{
      display: "inline-flex", padding: "3px 10px", borderRadius: 99,
      background: bg, color: fg, border: `1px solid ${border ?? "transparent"}`,
      fontFamily: "var(--ax-font-display)", fontSize: 10.5, fontWeight: 600,
    }}>{children}</span>
  );
}

const STYLES = `
.fc-sidebar { width: 240px; flex-shrink: 0; background: var(--ax-bg-soft); color: var(--ax-text); display: flex; flex-direction: column; padding: 20px 14px; position: sticky; top: 0; height: 100vh; border-right: 1px solid var(--ax-border); }
.fc-brand { display: flex; align-items: center; gap: 11px; padding: 4px 4px 14px; }
.fc-word { font-family: var(--ax-font-display); font-size: 16px; font-weight: 700; letter-spacing: 0.05em; }
.fc-word em { font-style: normal; color: var(--ax-accent); }
.fc-sub { font-size: 10px; color: var(--ax-text-faint); letter-spacing: 1.5px; text-transform: uppercase; margin-top: 1px; }
.fc-nav { display: flex; flex-direction: column; gap: 4px; padding-top: 8px; }
.fc-link { display: block; padding: 10px 14px; border-radius: var(--ax-radius-md); color: var(--ax-text-dim); font-size: 13px; font-weight: 500; text-decoration: none; border-left: 3px solid transparent; }
.fc-link:hover { color: var(--ax-text); background: var(--ax-bg-elevated); }
.fc-link.on { background: var(--ax-accent-14); color: var(--ax-accent-bright); border-left-color: var(--ax-accent); }
@media (max-width: 800px) { .fc-sidebar { width: 60px; padding: 16px 8px; } .fc-link { padding: 10px 8px; font-size: 10px; text-align: center; } .fc-brand div:nth-child(2) { display: none; } }

.fc-topbar { display: flex; justify-content: space-between; align-items: center; padding: 16px 28px; background: rgba(13,13,13,0.6); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); border-bottom: 1px solid var(--ax-border); position: sticky; top: 0; z-index: 10; }
.fc-title h1 { font-size: 19px; font-weight: 700; color: var(--ax-text); margin: 0; font-family: var(--ax-font-display); }
.fc-tsub { font-size: 12px; color: var(--ax-text-faint); margin-top: 2px; }
.fc-top-right { display: flex; align-items: center; gap: 14px; }
.fc-admin { display: flex; align-items: center; gap: 10px; }
.fc-avatar { width: 34px; height: 34px; border-radius: 50%; background: var(--ax-accent-14); color: var(--ax-accent-bright); display: grid; place-items: center; font-family: var(--ax-font-display); font-weight: 700; font-size: 12px; }
.fc-admin-n { font-size: 12.5px; font-weight: 600; color: var(--ax-text); }
.fc-admin-e { font-size: 10.5px; color: var(--ax-text-faint); }
.fc-logout { padding: 7px 12px; border-radius: var(--ax-radius-md); background: var(--ax-field); border: 1px solid var(--ax-border); color: var(--ax-text-dim); font-size: 12px; font-weight: 600; cursor: pointer; }
.fc-logout:hover { background: var(--ax-bad-soft); color: var(--ax-bad-text); border-color: var(--ax-bad); }
@media (max-width: 600px) { .fc-admin > div:last-child { display: none; } }

.fc-main { padding: 24px 28px 48px; max-width: 1400px; }

/* Always-visible info banner — DO NOT make this dismissible. */
.fc-banner {
  display: flex; align-items: flex-start; gap: 14px; padding: 14px 18px;
  background: var(--ax-accent-08); border: 1px solid var(--ax-accent-22); border-radius: var(--ax-radius-xl); color: var(--ax-text);
  margin-bottom: 16px;
}
.fc-banner-icon {
  width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
  background: var(--ax-accent); color: var(--ax-text-on-accent); font-weight: 800; font-size: 14px;
  display: grid; place-items: center; font-family: var(--ax-font-display);
}
.fc-banner-text { flex: 1; font-size: 13px; line-height: 1.55; color: var(--ax-text-dim); }
.fc-banner-text strong { color: var(--ax-accent-bright); }

.fc-filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 14px; background: var(--ax-card); padding: 14px; border-radius: var(--ax-radius-xl); border: 1px solid var(--ax-border); }
.fc-input { height: 34px; padding: 0 10px; border-radius: var(--ax-radius-md); border: 1px solid var(--ax-border); background: var(--ax-field); color: var(--ax-text); font-size: 12.5px; outline: none; color-scheme: dark; }
.fc-input:focus { border-color: var(--ax-accent); }
.fc-search { flex: 1; min-width: 220px; }
.fc-coach { min-width: 180px; }
.fc-date { display: flex; align-items: center; gap: 6px; }
.fc-date-label { font-size: 10.5px; color: var(--ax-text-dim); font-weight: 600; letter-spacing: 0.6px; text-transform: uppercase; }
.fc-supervised { display: inline-flex; align-items: center; gap: 6px; padding: 0 12px; height: 34px; border-radius: var(--ax-radius-md); background: var(--ax-bg-soft); border: 1px solid var(--ax-border); font-size: 12.5px; color: var(--ax-text-dim); font-weight: 600; cursor: pointer; }
.fc-supervised input { accent-color: var(--ax-accent); }
.fc-clear { background: var(--ax-field); color: var(--ax-text-dim); border: 1px solid var(--ax-border); padding: 0 12px; height: 34px; border-radius: var(--ax-radius-md); font-size: 12px; font-weight: 600; cursor: pointer; }
.fc-clear:hover:not(:disabled) { background: var(--ax-bg-elevated); }
.fc-clear:disabled { opacity: 0.55; cursor: not-allowed; }
.fc-export { background: var(--ax-accent); color: var(--ax-text-on-accent); border: none; padding: 0 16px; height: 34px; border-radius: var(--ax-radius-md); font-size: 12px; font-weight: 600; cursor: pointer; margin-left: auto; box-shadow: var(--ax-glow-accent); }
.fc-export:hover:not(:disabled) { background: var(--ax-accent-bright); }
.fc-export:disabled { opacity: 0.55; cursor: not-allowed; }

.fc-card { background: var(--ax-card); border: 1px solid var(--ax-border); border-radius: var(--ax-radius-xl); overflow: hidden; box-shadow: var(--ax-shadow-card); }
.fc-table-wrap { overflow-x: auto; }
.fc-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.fc-table th { background: var(--ax-bg-soft); color: var(--ax-text-faint); font-size: 10.5px; letter-spacing: 1px; text-transform: uppercase; font-weight: 600; padding: 11px 16px; text-align: left; border-bottom: 1px solid var(--ax-border); white-space: nowrap; }
.fc-table td { padding: 12px 16px; border-bottom: 1px solid var(--ax-border); color: var(--ax-text); }
.fc-table tbody tr { transition: background 0.13s; }
.fc-table tbody tr:hover { background: var(--ax-bg-elevated); }
.fc-table tbody tr:last-child td { border-bottom: none; }
.fc-name { font-weight: 600; }
.fc-muted { color: var(--ax-text-faint); }
.fc-muted-sm { font-size: 11px; color: var(--ax-text-faint); }
.fc-num { font-family: var(--ax-font-display); font-weight: 600; }
.fc-actions { text-align: right; white-space: nowrap; }
.fc-link-btn { background: none; border: none; color: var(--ax-accent-bright); font-size: 12px; font-weight: 600; cursor: pointer; padding: 0; text-decoration: none; }
.fc-link-btn:hover { text-decoration: underline; }
.fc-empty { text-align: center; padding: 38px 16px; color: var(--ax-text-faint); font-size: 13px; }

/* ─── Mobile patches (Task 5) ─── */
@media (max-width: 640px) {
  .fc-sidebar { position: fixed; bottom: 0; left: 0; right: 0; top: auto; width: 100%; height: 60px; padding: 0; flex-direction: row; border-top: 1px solid var(--ax-border); z-index: 50; }
  .fc-brand { display: none; }
  .fc-nav { flex-direction: row; padding-top: 0; gap: 0; flex: 1; height: 100%; align-items: stretch; }
  .fc-link { flex: 1; padding: 8px 4px; font-size: 9.5px; text-align: center; border-left: none; border-top: 3px solid transparent; line-height: 1.2; display: flex; align-items: center; justify-content: center; }
  .fc-link.on { border-top-color: var(--ax-accent); border-left-color: transparent; }
  .fc-main { padding-bottom: 84px; }
}
`;
