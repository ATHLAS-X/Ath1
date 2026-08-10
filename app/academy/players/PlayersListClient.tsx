"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { AddPlayerForm, BulkCsvForm } from "@/components/academy/forms";
import { Skeleton, SkeletonStyles } from "@/components/ui/Skeleton";

/* /academy/players — list view with filters, table, bulk actions,
   pagination. Edit + Send Invite per row. Same dark-navy sidebar /
   white topbar / light grey main as the dashboard. */

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
  1: { label: "Unverified",           bg: "#F1F5F9", fg: "#475569", border: "#CBD5E1" },
  2: { label: "Identity Verified",    bg: "#FEF3C7", fg: "#92400E", border: "#FCD34D" },
  3: { label: "Performance Verified", bg: "#DCFCE7", fg: "#15803D", border: "#86EFAC" },
  4: { label: "Scout Verified",       bg: "#DBEAFE", fg: "#1D4ED8", border: "#93C5FD" },
};

const STATUS_META: Record<string, { bg: string; fg: string }> = {
  "Draft":             { bg: "#F1F5F9", fg: "#475569" },
  "Pending Approval":  { bg: "#FEF3C7", fg: "#92400E" },
  "Live":              { bg: "#DCFCE7", fg: "#15803D" },
  "Rejected":          { bg: "#FEE2E2", fg: "#B91C1C" },
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
    <div style={{ display: "flex", minHeight: "100vh", background: "#F5F5F5", color: "#0F172A", fontFamily: "'Instrument Sans', system-ui, sans-serif" }}>
      <style>{STYLES}</style>

      {/* Sidebar */}
      <aside className="ap-sidebar">
        <div className="ap-brand">
          <div className="ap-ball" />
          <div>
            <div className="ap-word">SPORT<em>X</em></div>
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
          <AddPlayerForm variant="light" onSuccess={() => { fetchList(); toast.success("Player added"); }} />
        </Modal>
      )}

      {/* Bulk CSV modal */}
      {openBulkCsv && (
        <Modal title="Bulk Upload Players" onClose={() => { setOpenBulkCsv(false); fetchList(); }} width={820}>
          <BulkCsvForm
            variant="light"
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
  background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: 8,
  color: "#0F172A", fontSize: 12.5, outline: "none",
};
const btnGreen: React.CSSProperties = {
  background: "#22C55E", border: "1px solid #16A34A", color: "#FFFFFF",
  height: 34, padding: "0 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
};

const STYLES = `
.ap-sidebar { width: 240px; flex-shrink: 0; background: #0A1628; color: #F1F5F9; display: flex; flex-direction: column; padding: 20px 14px; position: sticky; top: 0; height: 100vh; }
.ap-brand { display: flex; align-items: center; gap: 11px; padding: 4px 4px 14px; }
.ap-ball { width: 28px; height: 28px; border-radius: 50%; background: radial-gradient(circle at 32% 28%, #46ff97, #0e6e33 72%); box-shadow: 0 0 16px rgba(46,224,123,0.45); flex-shrink: 0; }
.ap-word { font-family: 'Space Grotesk', monospace; font-size: 16px; font-weight: 700; letter-spacing: 0.05em; }
.ap-word em { font-style: normal; color: #22C55E; }
.ap-sub { font-size: 10px; color: #94A3B8; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 1px; }
.ap-nav { display: flex; flex-direction: column; gap: 4px; padding-top: 8px; }
.ap-link { display: block; padding: 10px 14px; border-radius: 9px; color: #94A3B8; font-size: 13px; font-weight: 500; text-decoration: none; border-left: 3px solid transparent; }
.ap-link:hover { color: #F1F5F9; background: rgba(255,255,255,0.04); }
.ap-link.on { background: rgba(34,197,94,0.12); color: #FFFFFF; border-left-color: #22C55E; }
@media (max-width: 800px) { .ap-sidebar { width: 60px; padding: 16px 8px; } .ap-link { padding: 10px 8px; font-size: 10px; text-align: center; } .ap-brand div:nth-child(2) { display: none; } }

.ap-topbar { display: flex; justify-content: space-between; align-items: center; padding: 16px 28px; background: #FFFFFF; border-bottom: 1px solid #E2E8F0; }
.ap-title h1 { font-size: 19px; font-weight: 700; color: #0F172A; margin: 0; font-family: 'Space Grotesk', monospace; }
.ap-tsub { font-size: 12px; color: #64748B; margin-top: 2px; }
.ap-top-right { display: flex; align-items: center; gap: 14px; }
.ap-admin { display: flex; align-items: center; gap: 10px; }
.ap-avatar { width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, #22C55E, #1D4ED8); color: #FFF; display: grid; place-items: center; font-family: 'Space Grotesk', monospace; font-weight: 700; font-size: 12px; }
.ap-admin-n { font-size: 12.5px; font-weight: 600; color: #0F172A; }
.ap-admin-e { font-size: 10.5px; color: #64748B; }
.ap-logout { padding: 7px 12px; border-radius: 7px; background: #F1F5F9; border: 1px solid #CBD5E1; color: #475569; font-size: 12px; font-weight: 600; cursor: pointer; }
.ap-logout:hover { background: #FEE2E2; color: #B91C1C; border-color: #FCA5A5; }
@media (max-width: 600px) { .ap-admin > div:last-child { display: none; } }

.ap-main { padding: 22px 28px 48px; max-width: 1400px; }

.ap-filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 14px; background: #FFFFFF; padding: 14px; border-radius: 11px; border: 1px solid #E2E8F0; }
.ap-input { height: 34px; padding: 0 10px; border-radius: 8px; border: 1px solid #CBD5E1; background: #FFFFFF; color: #0F172A; font-size: 12.5px; outline: none; }
.ap-input:focus { border-color: #22C55E; }
.ap-search { flex: 1; min-width: 220px; }
.ap-clear { background: #F1F5F9; color: #475569; border: 1px solid #CBD5E1; padding: 0 12px; height: 34px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; }
.ap-clear:hover:not(:disabled) { background: #E2E8F0; }
.ap-clear:disabled { opacity: 0.55; cursor: not-allowed; }
.ap-add { background: #22C55E; color: #FFFFFF; border: none; padding: 0 16px; height: 34px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; margin-left: auto; }
.ap-add:hover { background: #16A34A; }

.ap-bulk { display: flex; align-items: center; gap: 10px; padding: 11px 16px; background: #ECFDF5; border: 1px solid #86EFAC; border-radius: 11px; margin-bottom: 14px; font-size: 13px; font-weight: 600; color: #15803D; }
.ap-bulk-btn { background: #FFFFFF; color: #15803D; border: 1px solid #86EFAC; padding: 6px 12px; border-radius: 7px; font-size: 12px; font-weight: 600; cursor: pointer; }
.ap-bulk-btn:hover { background: #DCFCE7; }
.ap-bulk-cancel { background: transparent; color: #475569; border: 1px solid #CBD5E1; padding: 6px 12px; border-radius: 7px; font-size: 12px; font-weight: 600; cursor: pointer; }

.ap-card { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; }
.ap-table-wrap { overflow-x: auto; }
.ap-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.ap-table th { background: #F8FAFC; color: #475569; font-size: 10.5px; letter-spacing: 1px; text-transform: uppercase; font-weight: 600; padding: 11px 16px; text-align: left; border-bottom: 1px solid #E2E8F0; }
.ap-table td { padding: 12px 16px; border-bottom: 1px solid #F1F5F9; color: #0F172A; }
.ap-table tbody tr { transition: background 0.13s; }
.ap-table tbody tr:hover { background: #ECFDF5; }
.ap-table tbody tr:last-child td { border-bottom: none; }
.ap-name { font-weight: 600; }
.ap-muted { color: #64748B; }
.ap-actions { text-align: right; white-space: nowrap; }
.ap-actions > * + * { margin-left: 8px; }
.ap-link-btn { background: none; border: none; color: #22C55E; font-size: 12px; font-weight: 600; cursor: pointer; padding: 0; text-decoration: none; }
.ap-link-btn:hover { text-decoration: underline; }
.ap-empty { text-align: center; padding: 38px 16px; color: #64748B; font-size: 13px; }

.ap-pager { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-top: 1px solid #E2E8F0; font-size: 12px; color: #475569; }
.ap-page-btn { background: #FFFFFF; border: 1px solid #CBD5E1; color: #475569; padding: 6px 12px; border-radius: 7px; font-size: 12px; font-weight: 600; cursor: pointer; }
.ap-page-btn:hover:not(:disabled) { background: #F1F5F9; }
.ap-page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.ap-page-num { padding: 6px 10px; font-size: 12px; font-weight: 600; color: #0F172A; }

.ap-toast { position: fixed; bottom: 24px; right: 24px; background: #0F172A; color: #FFFFFF; padding: 11px 18px; border-radius: 9px; font-size: 13px; font-weight: 600; box-shadow: 0 10px 30px rgba(15,23,42,0.35); z-index: 200; }

.ap-modal-bg { position: fixed; inset: 0; background: rgba(15,23,42,0.55); backdrop-filter: blur(2px); z-index: 100; display: grid; place-items: start center; padding: 40px 16px; overflow-y: auto; }
.ap-modal { width: 100%; background: #FFFFFF; border-radius: 14px; box-shadow: 0 20px 60px rgba(15,23,42,0.35); overflow: hidden; }
.ap-modal-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid #E2E8F0; }
.ap-modal-head h3 { font-size: 16px; font-weight: 700; color: #0F172A; margin: 0; }
.ap-modal-head button { width: 32px; height: 32px; border-radius: 8px; border: 1px solid #E2E8F0; background: #F8FAFC; font-size: 20px; line-height: 1; color: #475569; cursor: pointer; }
.ap-modal-body { padding: 18px 20px 20px; max-height: 70vh; overflow-y: auto; }

/* ─── Mobile patches (Task 5) ─── */
@media (max-width: 640px) {
  .ap-sidebar { position: fixed; bottom: 0; left: 0; right: 0; top: auto; width: 100%; height: 60px; padding: 0; flex-direction: row; border-top: 1px solid rgba(255,255,255,0.08); z-index: 50; }
  .ap-brand { display: none; }
  .ap-nav { flex-direction: row; padding-top: 0; gap: 0; flex: 1; height: 100%; align-items: stretch; }
  .ap-link { flex: 1; padding: 8px 4px; font-size: 9.5px; text-align: center; border-left: none; border-top: 3px solid transparent; line-height: 1.2; display: flex; align-items: center; justify-content: center; }
  .ap-link.on { border-top-color: #22C55E; border-left-color: transparent; }
  .ap-main { padding-bottom: 84px; }
  /* Modals: full-screen on mobile, not centered cards. */
  .ap-modal-bg { padding: 0; align-items: stretch; }
  .ap-modal { max-width: 100% !important; max-height: 100vh; min-height: 100vh; border-radius: 0; display: flex; flex-direction: column; }
  .ap-modal-body { max-height: none; flex: 1; }
}
`;
