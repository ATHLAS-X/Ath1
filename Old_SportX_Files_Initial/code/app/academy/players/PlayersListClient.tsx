"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { AddPlayerForm, BulkCsvForm } from "@/components/academy/forms";
import { Skeleton, SkeletonStyles } from "@/components/ui/Skeleton";

/* /academy/players — list view with filters, table, bulk actions,
   pagination. Edit + Send Invite per row. Same --ax-* dark theme as the
   dashboard. */

interface Props {
  academyName: string;
  logoUrl: string | null;
  adminName: string;
  adminEmail: string;
}

interface PlayerRow {
  id: string;
  user_id: string | null;
  name: string;
  playing_role: string | null;
  batting_style: string | null;
  bowling_style: string | null;
  verification_level: number;
  profile_status: string;
  invite_sent: boolean;
  invite_sent_at: string | null;
  claimed_at: string | null;
  created_at: string;
  age_groups: string[];
}

const NAV = [
  { label: "Dashboard",             href: "/academy/dashboard" },
  { label: "Players",               href: "/academy/players" },
  { label: "Coaches",               href: "/academy/coaches" },
  { label: "Fitness & Assessments", href: "/academy/fitness" },
  { label: "Settings",              href: "/academy/settings" },
];

const VL_META: Record<number, { label: string; bg: string; fg: string; border: string }> = {
  1: { label: "Unverified",           bg: "var(--ax-field)",      fg: "var(--ax-text-dim)",     border: "var(--ax-border)" },
  2: { label: "Identity Verified",    bg: "var(--ax-accent-14)",  fg: "var(--ax-accent-bright)", border: "var(--ax-accent-22)" },
  3: { label: "Performance Verified", bg: "var(--ax-ok-soft)",    fg: "var(--ax-ok)",            border: "var(--ax-ok-border)" },
  4: { label: "Scout Verified",       bg: "rgba(74,158,255,0.14)", fg: "#7DBBFF",                border: "rgba(74,158,255,0.35)" },
};

const STATUS_META: Record<string, { bg: string; fg: string }> = {
  "Draft":             { bg: "var(--ax-field)",     fg: "var(--ax-text-dim)" },
  "Pending Approval":  { bg: "var(--ax-accent-14)",  fg: "var(--ax-accent-bright)" },
  "Live":              { bg: "var(--ax-ok-soft)",    fg: "var(--ax-ok)" },
  "Rejected":          { bg: "var(--ax-bad-soft)",   fg: "var(--ax-bad-text)" },
};

export default function PlayersListClient(p: Props) {
  const pathname = usePathname() ?? "";
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const SIZE = 20;

  /* Filters */
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("All");
  const [level, setLevel] = useState("All");
  const [status, setStatus] = useState("All");
  const [ageGroup, setAgeGroup] = useState("All");

  /* Selection (Set of row ids) */
  const [selected, setSelected] = useState<Set<string>>(new Set());

  /* Modals */
  const [openAddPlayer, setOpenAddPlayer] = useState(false);
  const [openBulkCsv, setOpenBulkCsv] = useState(false);
  const [editPlayer, setEditPlayer] = useState<PlayerRow | null>(null);

  /* Fetch state — error surfaces a "Try again" card instead of a generic
     empty state. */
  const [fetchError, setFetchError] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true); setFetchError(false);
    const qs = new URLSearchParams({
      page: String(page), size: String(SIZE),
      ...(search ? { search } : {}),
      ...(role !== "All" ? { role } : {}),
      ...(level !== "All" ? { level } : {}),
      ...(status !== "All" ? { status } : {}),
      ...(ageGroup !== "All" ? { age_group: ageGroup } : {}),
    });
    try {
      const res = await fetch(`/api/academy/players?${qs.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (data?.success) {
        setPlayers(data.players ?? []);
        setTotal(data.total ?? 0);
      } else {
        setFetchError(true);
      }
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [page, search, role, level, status, ageGroup]);

  useEffect(() => { fetchList(); }, [fetchList]);

  /* Reset to page 1 whenever filters change. */
  useEffect(() => { setPage(1); setSelected(new Set()); }, [search, role, level, status, ageGroup]);

  const clearFilters = () => { setSearch(""); setRole("All"); setLevel("All"); setStatus("All"); setAgeGroup("All"); };

  const toggle = (id: string) => setSelected((s) => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const toggleAll = () => setSelected((s) => {
    if (s.size === players.length) return new Set();
    return new Set(players.map((p) => p.id));
  });

  const sendInvite = async (row: PlayerRow) => {
    try {
      const res = await fetch(`/api/academy/players/${row.id}/invite`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (data?.success) {
        toast.success(`Invite sent to ${row.name}`);
        fetchList();
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  };

  const bulkInvite = async () => {
    if (selected.size === 0) return;
    try {
      const res = await fetch("/api/academy/players/bulk/invite", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected] }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.success) {
        toast.success(`Sent ${data.sent} invite${data.sent === 1 ? "" : "s"}`);
        setSelected(new Set()); fetchList();
      } else toast.error("Something went wrong. Please try again.");
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  };

  const bulkStatus = async () => {
    if (selected.size === 0) return;
    try {
      const res = await fetch("/api/academy/players/bulk/status", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected], status: "Pending Approval" }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.success) {
        toast.success(`Updated ${data.updated} player${data.updated === 1 ? "" : "s"}`);
        setSelected(new Set()); fetchList();
      } else toast.error("Something went wrong. Please try again.");
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / SIZE));
  const initials = p.adminName.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--ax-bg)", color: "var(--ax-text)", fontFamily: "var(--ax-font-body)" }}>
      <style>{STYLES}</style>

      {/* Sidebar */}
      <aside className="ap-sidebar">
        <div className="ap-brand">
          <div>
            <div className="ap-word">ATHLAS<em>X</em></div>
            <div className="ap-sub">Academy admin</div>
          </div>
        </div>
        <nav className="ap-nav">
          {NAV.map((item) => {
            const active = pathname === item.href || (item.href !== "/academy/dashboard" && pathname.startsWith(item.href));
            return <Link key={item.href} href={item.href} className={`ap-link${active ? " on" : ""}`}>{item.label}</Link>;
          })}
        </nav>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <header className="ap-topbar">
          <div className="ap-title">
            <h1>Players</h1>
            <div className="ap-tsub">{p.academyName} · roster · {total} player{total === 1 ? "" : "s"}</div>
          </div>
          <div className="ap-top-right">
            <div className="ap-admin">
              <div className="ap-avatar">{initials}</div>
              <div>
                <div className="ap-admin-n">{p.adminName}</div>
                <div className="ap-admin-e">{p.adminEmail}</div>
              </div>
            </div>
            <button className="ap-logout" onClick={() => signOut({ callbackUrl: "/auth/login" })}>Logout</button>
          </div>
        </header>

        <main className="ap-main">

          {/* Filters */}
          <div className="ap-filters">
            <input
              className="ap-input ap-search"
              placeholder="Search by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="ap-input" value={role} onChange={(e) => setRole(e.target.value)}>
              {["All", "Batter", "Bowler", "All-Rounder", "Wicketkeeper"].map((o) => <option key={o}>{o}</option>)}
            </select>
            <select className="ap-input" value={level} onChange={(e) => setLevel(e.target.value)}>
              <option>All</option>
              {[1, 2, 3, 4].map((n) => <option key={n} value={String(n)}>Level {n}</option>)}
            </select>
            <select className="ap-input" value={status} onChange={(e) => setStatus(e.target.value)}>
              {["All", "Draft", "Pending Approval", "Live"].map((o) => <option key={o}>{o}</option>)}
            </select>
            <select className="ap-input" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} aria-label="Filter by age group">
              {["All", "U-10", "U-13", "U-17", "Senior"].map((o) => <option key={o}>{o === "All" ? "All age groups" : o}</option>)}
            </select>
            <button className="ap-clear" onClick={clearFilters}
              disabled={search === "" && role === "All" && level === "All" && status === "All" && ageGroup === "All"}>
              Clear filters
            </button>
            <button className="ap-add" onClick={() => setOpenAddPlayer(true)}>+ Add player</button>
          </div>

          {/* Bulk action bar */}
          {selected.size > 0 && (
            <div className="ap-bulk">
              <div>{selected.size} selected</div>
              <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                <button className="ap-bulk-btn" onClick={bulkInvite}>Send Invites to Selected</button>
                <button className="ap-bulk-btn" onClick={bulkStatus}>Change Status to Pending Approval</button>
                <button className="ap-bulk-cancel" onClick={() => setSelected(new Set())}>Cancel</button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="ap-card">
            <div className="ap-table-wrap">
              <table className="ap-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>
                      <input type="checkbox"
                        checked={players.length > 0 && selected.size === players.length}
                        onChange={toggleAll} />
                    </th>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Age group</th>
                    <th>Batting Style</th>
                    <th>Verification</th>
                    <th>Status</th>
                    <th>Added</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <>
                      {[0, 1, 2, 3, 4].map((i) => (
                        <tr key={`sk-${i}`}>
                          <td><Skeleton width={16} height={16} /></td>
                          <td><Skeleton width="65%" height={14} /></td>
                          <td><Skeleton width="55%" height={14} /></td>
                          <td><Skeleton width="55%" height={14} /></td>
                          <td><Skeleton width="70%" height={14} /></td>
                          <td><Skeleton width={120} height={20} /></td>
                          <td><Skeleton width={80} height={20} /></td>
                          <td><Skeleton width="50%" height={14} /></td>
                          <td style={{ textAlign: "right" }}><Skeleton width={140} height={14} /></td>
                        </tr>
                      ))}
                    </>
                  )}
                  {!loading && fetchError && (
                    <tr><td colSpan={9} className="ap-empty">
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#0F172A", marginBottom: 6 }}>
                        Something went wrong loading players
                      </div>
                      <div style={{ fontSize: 12.5, color: "#64748B", marginBottom: 12 }}>
                        We couldn&apos;t reach the database. Check your connection and try again.
                      </div>
                      <button className="ap-add" style={{ height: 32, padding: "0 14px" }} onClick={() => fetchList()}>
                        Try again
                      </button>
                    </td></tr>
                  )}
                  {!loading && !fetchError && players.length === 0 && (
                    <tr><td colSpan={9} className="ap-empty">
                      {(search || role !== "All" || level !== "All" || status !== "All" || ageGroup !== "All") ? (
                        <>
                          No players match these filters.{" "}
                          <button className="ap-link-btn" onClick={clearFilters}>Clear filters</button>
                        </>
                      ) : (
                        <div style={{ padding: "8px 0" }}>
                          <div style={{ fontSize: 30, marginBottom: 6 }}>🏏</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", marginBottom: 6, fontFamily: "'Space Grotesk', monospace" }}>
                            No players yet
                          </div>
                          <div style={{ fontSize: 12.5, color: "#475569", marginBottom: 14 }}>
                            Get your roster started by importing a CSV or adding a player one at a time.
                          </div>
                          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                            <button className="ap-add" onClick={() => setOpenBulkCsv(true)}>↑ Upload CSV</button>
                            <button className="ap-clear" style={{ background: "#FFFFFF" }} onClick={() => setOpenAddPlayer(true)}>+ Add Player</button>
                          </div>
                        </div>
                      )}
                    </td></tr>
                  )}
                  {!loading && players.map((row) => {
                    const lvl = VL_META[Math.max(1, Math.min(4, row.verification_level))] ?? VL_META[1];
                    const st  = STATUS_META[row.profile_status] ?? STATUS_META["Draft"];
                    return (
                      <tr key={row.id}>
                        <td>
                          <input type="checkbox" checked={selected.has(row.id)}
                            onChange={() => toggle(row.id)} />
                        </td>
                        <td className="ap-name">{row.name || "—"}</td>
                        <td>{row.playing_role ?? "—"}</td>
                        <td className="ap-muted">{row.age_groups?.length ? row.age_groups.join(", ") : "—"}</td>
                        <td className="ap-muted">{row.batting_style ?? "—"}</td>
                        <td><Badge bg={lvl.bg} fg={lvl.fg} border={lvl.border}>{lvl.label}</Badge></td>
                        <td><Badge bg={st.bg} fg={st.fg}>{row.profile_status}</Badge></td>
                        <td className="ap-muted">
                          {row.created_at ? new Date(row.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                        </td>
                        <td className="ap-actions">
                          <button className="ap-link-btn" onClick={() => setEditPlayer(row)}>Edit</button>
                          {!row.claimed_at && (
                            <button className="ap-link-btn" onClick={() => sendInvite(row)}>
                              {row.invite_sent ? "Resend Invite" : "Send Invite"}
                            </button>
                          )}
                          <Link className="ap-link-btn" href={`/academy/players/${row.id}`}>View Profile</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="ap-pager">
              <div>
                Showing {players.length === 0 ? 0 : (page - 1) * SIZE + 1}–{(page - 1) * SIZE + players.length} of {total}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="ap-page-btn" disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>← Previous</button>
                <span className="ap-page-num">Page {page} / {totalPages}</span>
                <button className="ap-page-btn" disabled={page >= totalPages} onClick={() => setPage((n) => n + 1)}>Next →</button>
              </div>
            </div>
          </div>
        </main>
      </div>

      <SkeletonStyles />

      {/* Add player modal */}
      {openAddPlayer && (
        <Modal title="Add Player" onClose={() => { setOpenAddPlayer(false); fetchList(); }}>
          <AddPlayerForm variant="dark" onSuccess={() => { fetchList(); toast.success("Player added"); }} />
        </Modal>
      )}

      {/* Bulk CSV modal */}
      {openBulkCsv && (
        <Modal title="Bulk Upload Players" onClose={() => { setOpenBulkCsv(false); fetchList(); }} width={820}>
          <BulkCsvForm
            variant="dark"
            onSuccess={(created) => {
              fetchList();
              if (created > 0) toast.success(`${created} player${created === 1 ? "" : "s"} imported`);
            }}
          />
        </Modal>
      )}

      {/* Edit player modal */}
      {editPlayer && (
        <Modal title={`Edit · ${editPlayer.name}`} onClose={() => { setEditPlayer(null); fetchList(); }}>
          <EditPlayerForm
            playerId={editPlayer.id}
            onSuccess={() => { setEditPlayer(null); fetchList(); toast.success("Player updated"); }}
          />
        </Modal>
      )}
    </div>
  );
}

/* ─────── Inline edit form (loads current values, PUTs back) ─────── */
function EditPlayerForm({ playerId, onSuccess }: { playerId: string; onSuccess: () => void }) {
  const [form, setForm] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/academy/players/${playerId}`);
      const data = await res.json().catch(() => ({}));
      if (data?.success && data.player) {
        const p = data.player;
        setForm({
          first_name: p.first_name ?? "",
          last_name:  p.last_name  ?? "",
          date_of_birth: p.date_of_birth ? p.date_of_birth.slice(0, 10) : "",
          gender: p.gender ?? "",
          playing_role: p.playing_role ?? "",
          batting_style: p.batting_style ?? "",
          bowling_style: p.bowling_style ?? "",
          city: p.city ?? "",
          state: p.state ?? "",
          height_cm: p.height_cm ?? "",
          weight_kg: p.weight_kg ?? "",
        });
      }
      setLoading(false);
    })();
  }, [playerId]);

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/academy/players/${playerId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!data?.success) { setError(data?.error ?? "Save failed"); return; }
      onSuccess();
    } finally { setBusy(false); }
  };

  if (loading) return <div style={{ padding: 12, fontSize: 13, color: "#64748B" }}>Loading…</div>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      {[
        ["first_name", "First name *"],
        ["last_name", "Last name *"],
        ["date_of_birth", "Date of birth", "date"],
        ["gender", "Gender", "select", ["Male", "Female", "Other"]],
        ["playing_role", "Primary role", "select", ["Batsman", "Bowler", "All-Rounder", "WK"]],
        ["batting_style", "Batting style", "select", ["Right-hand bat", "Left-hand bat"]],
        ["bowling_style", "Bowling style", "select", ["Right-arm fast", "Left-arm fast", "Right-arm medium", "Left-arm medium", "Off Spin", "Leg Spin", "Left-arm Spin"]],
        ["city", "City"],
        ["state", "State"],
        ["height_cm", "Height (cm)", "number"],
        ["weight_kg", "Weight (kg)", "number"],
      ].map(([key, label, type, options]: any) => (
        <label key={key} style={{ display: "block" }}>
          <span style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#475569", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>{label}</span>
          {type === "select" ? (
            <select style={inputStyle} value={form[key] ?? ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })}>
              <option value="">Select…</option>
              {options.map((o: string) => <option key={o}>{o}</option>)}
            </select>
          ) : (
            <input style={inputStyle} type={type ?? "text"} value={form[key] ?? ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
          )}
        </label>
      ))}
      {error && <div style={{ gridColumn: "1 / -1", color: "#DC2626", fontSize: 12 }}>{error}</div>}
      <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button onClick={save} disabled={busy} style={btnGreen}>{busy ? "Saving…" : "Save changes"}</button>
      </div>
    </div>
  );
}

/* ─────── Helpers ─────── */
function Badge({ children, bg, fg, border }: { children: React.ReactNode; bg: string; fg: string; border?: string }) {
  return (
    <span style={{
      display: "inline-flex", padding: "3px 10px", borderRadius: 99,
      background: bg, color: fg, border: `1px solid ${border ?? "transparent"}`,
      fontFamily: "'Space Grotesk', monospace", fontSize: 10.5, fontWeight: 600,
    }}>{children}</span>
  );
}

function Modal({ title, onClose, children, width = 760 }: { title: string; onClose: () => void; children: React.ReactNode; width?: number }) {
  return (
    <div className="ap-modal-bg" onClick={onClose}>
      <div className="ap-modal" style={{ maxWidth: width }} onClick={(e) => e.stopPropagation()}>
        <header className="ap-modal-head">
          <h3>{title}</h3>
          <button onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="ap-modal-body">{children}</div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", height: 34, padding: "0 11px",
  background: "var(--ax-field)", border: "1px solid var(--ax-border)", borderRadius: 8,
  color: "var(--ax-text)", fontSize: 12.5, outline: "none", colorScheme: "dark",
};
const btnGreen: React.CSSProperties = {
  background: "var(--ax-accent)", border: "1px solid var(--ax-accent)", color: "var(--ax-text-on-accent)",
  height: 34, padding: "0 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
};

const STYLES = `
.ap-sidebar { width: 240px; flex-shrink: 0; background: var(--ax-bg-soft); color: var(--ax-text); display: flex; flex-direction: column; padding: 20px 14px; position: sticky; top: 0; height: 100vh; border-right: 1px solid var(--ax-border); }
.ap-brand { display: flex; align-items: center; gap: 11px; padding: 4px 4px 14px; }
.ap-word { font-family: var(--ax-font-display); font-size: 16px; font-weight: 700; letter-spacing: 0.05em; }
.ap-word em { font-style: normal; color: var(--ax-accent); }
.ap-sub { font-size: 10px; color: var(--ax-text-faint); letter-spacing: 1.5px; text-transform: uppercase; margin-top: 1px; }
.ap-nav { display: flex; flex-direction: column; gap: 4px; padding-top: 8px; }
.ap-link { display: block; padding: 10px 14px; border-radius: var(--ax-radius-md); color: var(--ax-text-dim); font-size: 13px; font-weight: 500; text-decoration: none; border-left: 3px solid transparent; }
.ap-link:hover { color: var(--ax-text); background: var(--ax-bg-elevated); }
.ap-link.on { background: var(--ax-accent-14); color: var(--ax-accent-bright); border-left-color: var(--ax-accent); }
@media (max-width: 800px) { .ap-sidebar { width: 60px; padding: 16px 8px; } .ap-link { padding: 10px 8px; font-size: 10px; text-align: center; } .ap-brand div:nth-child(2) { display: none; } }

.ap-topbar { display: flex; justify-content: space-between; align-items: center; padding: 16px 28px; background: rgba(13,13,13,0.6); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); border-bottom: 1px solid var(--ax-border); position: sticky; top: 0; z-index: 10; }
.ap-title h1 { font-size: 19px; font-weight: 700; color: var(--ax-text); margin: 0; font-family: var(--ax-font-display); }
.ap-tsub { font-size: 12px; color: var(--ax-text-faint); margin-top: 2px; }
.ap-top-right { display: flex; align-items: center; gap: 14px; }
.ap-admin { display: flex; align-items: center; gap: 10px; }
.ap-avatar { width: 34px; height: 34px; border-radius: 50%; background: var(--ax-accent-14); color: var(--ax-accent-bright); display: grid; place-items: center; font-family: var(--ax-font-display); font-weight: 700; font-size: 12px; }
.ap-admin-n { font-size: 12.5px; font-weight: 600; color: var(--ax-text); }
.ap-admin-e { font-size: 10.5px; color: var(--ax-text-faint); }
.ap-logout { padding: 7px 12px; border-radius: var(--ax-radius-md); background: var(--ax-field); border: 1px solid var(--ax-border); color: var(--ax-text-dim); font-size: 12px; font-weight: 600; cursor: pointer; }
.ap-logout:hover { background: var(--ax-bad-soft); color: var(--ax-bad-text); border-color: var(--ax-bad); }
@media (max-width: 600px) { .ap-admin > div:last-child { display: none; } }

.ap-main { padding: 22px 28px 48px; max-width: 1400px; }

.ap-filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 14px; background: var(--ax-card); padding: 14px; border-radius: var(--ax-radius-xl); border: 1px solid var(--ax-border); }
.ap-input { height: 34px; padding: 0 10px; border-radius: var(--ax-radius-md); border: 1px solid var(--ax-border); background: var(--ax-field); color: var(--ax-text); font-size: 12.5px; outline: none; color-scheme: dark; }
.ap-input:focus { border-color: var(--ax-accent); }
.ap-search { flex: 1; min-width: 220px; }
.ap-clear { background: var(--ax-field); color: var(--ax-text-dim); border: 1px solid var(--ax-border); padding: 0 12px; height: 34px; border-radius: var(--ax-radius-md); font-size: 12px; font-weight: 600; cursor: pointer; }
.ap-clear:hover:not(:disabled) { background: var(--ax-bg-elevated); }
.ap-clear:disabled { opacity: 0.55; cursor: not-allowed; }
.ap-add { background: var(--ax-accent); color: var(--ax-text-on-accent); border: none; padding: 0 16px; height: 34px; border-radius: var(--ax-radius-md); font-size: 12px; font-weight: 600; cursor: pointer; margin-left: auto; box-shadow: var(--ax-glow-accent); }
.ap-add:hover { background: var(--ax-accent-bright); }

.ap-bulk { display: flex; align-items: center; gap: 10px; padding: 11px 16px; background: var(--ax-accent-08); border: 1px solid var(--ax-accent-22); border-radius: var(--ax-radius-xl); margin-bottom: 14px; font-size: 13px; font-weight: 600; color: var(--ax-accent-bright); }
.ap-bulk-btn { background: var(--ax-field); color: var(--ax-accent-bright); border: 1px solid var(--ax-accent-22); padding: 6px 12px; border-radius: var(--ax-radius-sm); font-size: 12px; font-weight: 600; cursor: pointer; }
.ap-bulk-btn:hover { background: var(--ax-accent-14); }
.ap-bulk-cancel { background: transparent; color: var(--ax-text-dim); border: 1px solid var(--ax-border); padding: 6px 12px; border-radius: var(--ax-radius-sm); font-size: 12px; font-weight: 600; cursor: pointer; }

.ap-card { background: var(--ax-card); border: 1px solid var(--ax-border); border-radius: var(--ax-radius-xl); overflow: hidden; box-shadow: var(--ax-shadow-card); }
.ap-table-wrap { overflow-x: auto; }
.ap-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.ap-table th { background: var(--ax-bg-soft); color: var(--ax-text-faint); font-size: 10.5px; letter-spacing: 1px; text-transform: uppercase; font-weight: 600; padding: 11px 16px; text-align: left; border-bottom: 1px solid var(--ax-border); }
.ap-table td { padding: 12px 16px; border-bottom: 1px solid var(--ax-border); color: var(--ax-text); }
.ap-table tbody tr { transition: background 0.13s; }
.ap-table tbody tr:hover { background: var(--ax-bg-elevated); }
.ap-table tbody tr:last-child td { border-bottom: none; }
.ap-name { font-weight: 600; }
.ap-muted { color: var(--ax-text-faint); }
.ap-actions { text-align: right; white-space: nowrap; }
.ap-actions > * + * { margin-left: 8px; }
.ap-link-btn { background: none; border: none; color: var(--ax-accent-bright); font-size: 12px; font-weight: 600; cursor: pointer; padding: 0; text-decoration: none; }
.ap-link-btn:hover { text-decoration: underline; }
.ap-empty { text-align: center; padding: 38px 16px; color: var(--ax-text-faint); font-size: 13px; }

.ap-pager { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-top: 1px solid var(--ax-border); font-size: 12px; color: var(--ax-text-dim); }
.ap-page-btn { background: var(--ax-field); border: 1px solid var(--ax-border); color: var(--ax-text-dim); padding: 6px 12px; border-radius: var(--ax-radius-sm); font-size: 12px; font-weight: 600; cursor: pointer; }
.ap-page-btn:hover:not(:disabled) { background: var(--ax-bg-elevated); }
.ap-page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.ap-page-num { padding: 6px 10px; font-size: 12px; font-weight: 600; color: var(--ax-text); }

.ap-toast { position: fixed; bottom: 24px; right: 24px; background: var(--ax-card); color: var(--ax-text); padding: 11px 18px; border-radius: var(--ax-radius-md); font-size: 13px; font-weight: 600; box-shadow: var(--ax-shadow-pop); z-index: 200; border: 1px solid var(--ax-border); }

.ap-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(2px); z-index: 100; display: grid; place-items: start center; padding: 40px 16px; overflow-y: auto; }
.ap-modal { width: 100%; background: var(--ax-card); border: 1px solid var(--ax-border); border-radius: var(--ax-radius-xl); box-shadow: var(--ax-shadow-pop); overflow: hidden; }
.ap-modal-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid var(--ax-border); }
.ap-modal-head h3 { font-size: 16px; font-weight: 700; color: var(--ax-text); margin: 0; }
.ap-modal-head button { width: 32px; height: 32px; border-radius: var(--ax-radius-sm); border: 1px solid var(--ax-border); background: var(--ax-field); font-size: 20px; line-height: 1; color: var(--ax-text-dim); cursor: pointer; }
.ap-modal-body { padding: 18px 20px 20px; max-height: 70vh; overflow-y: auto; }

/* ─── Mobile patches (Task 5) ─── */
@media (max-width: 640px) {
  .ap-sidebar { position: fixed; bottom: 0; left: 0; right: 0; top: auto; width: 100%; height: 60px; padding: 0; flex-direction: row; border-top: 1px solid var(--ax-border); z-index: 50; }
  .ap-brand { display: none; }
  .ap-nav { flex-direction: row; padding-top: 0; gap: 0; flex: 1; height: 100%; align-items: stretch; }
  .ap-link { flex: 1; padding: 8px 4px; font-size: 9.5px; text-align: center; border-left: none; border-top: 3px solid transparent; line-height: 1.2; display: flex; align-items: center; justify-content: center; }
  .ap-link.on { border-top-color: var(--ax-accent); border-left-color: transparent; }
  .ap-main { padding-bottom: 84px; }
  /* Modals: full-screen on mobile, not centered cards. */
  .ap-modal-bg { padding: 0; align-items: stretch; }
  .ap-modal { max-width: 100% !important; max-height: 100vh; min-height: 100vh; border-radius: 0; display: flex; flex-direction: column; }
  .ap-modal-body { max-height: none; flex: 1; }
}
`;
