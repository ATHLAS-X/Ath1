"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { initials } from "@/components/sx/widgets";
import "@/app/sportx.css";

const ROLE_BADGE: Record<string, string> = {
  player: "green", parent: "ghost", academy_admin: "purple", coach: "blue",
  scout: "amber", tournament_organizer: "blue", sportx_admin: "red",
};

const STATUS_BADGE: Record<string, string> = {
  active: "green", pending: "amber", suspended: "red",
};

export default function UsersClient({ initialUsers }: { initialUsers: any[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  /* Debounced server search */
  useEffect(() => {
    const id = setTimeout(async () => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (role) params.set("role", role);
      const rows = await fetch(`/api/admin/users?${params}`).then((r) => r.json()).catch(() => null);
      if (Array.isArray(rows)) setUsers(rows);
    }, 300);
    return () => clearTimeout(id);
  }, [q, role]);

  async function setStatus(id: string, status: string) {
    setBusy(id);
    const res = await fetch(`/api/admin/users/${id}/status`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (data.success) {
      setUsers((arr) => arr.map((u) => (u.id === id ? { ...u, account_status: status } : u)));
      setToast(`✓ ${status === "active" ? "Activated" : status === "suspended" ? "Suspended" : "Set to pending"}`);
      setTimeout(() => setToast(""), 2200);
    }
  }

  return (
    <div className="sx-root" style={{ minHeight: "100vh", padding: 24 }}>
      <style>{styles}</style>
      {toast && <div className="um-toast">{toast}</div>}

      <div className="um-shell">
        <header className="um-head">
          <div>
            <div className="sect-title">Admin · User Management</div>
            <h1 className="um-title">Users</h1>
          </div>
          <Link href="/admin" className="btn">← Overview</Link>
        </header>

        <div className="card" style={{ overflow: "hidden" }}>
          <div className="cb" style={{ display: "flex", gap: 8, paddingBottom: 0, flexWrap: "wrap" }}>
            <input className="sinput" style={{ maxWidth: 320 }} placeholder="Search name or email…"
              value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="sinput" style={{ maxWidth: 200 }} value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">All roles</option>
              <option value="player">Player</option>
              <option value="parent">Parent</option>
              <option value="academy_admin">Academy Admin</option>
              <option value="coach">Coach</option>
              <option value="scout">Scout</option>
              <option value="tournament_organizer">Tournament Organizer</option>
              <option value="sportx_admin">SportX Admin</option>
            </select>
            <span style={{ marginLeft: "auto", alignSelf: "center", color: "var(--mut)", fontSize: 12 }}>
              {users.length} users
            </span>
          </div>
          <div className="cb">
            <table className="um-table">
              <thead>
                <tr><th>User</th><th>Role</th><th>Phone</th><th>Status</th><th>Joined</th><th style={{ textAlign: "right" }}>Actions</th></tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <span className="ava" style={{ background: "radial-gradient(circle at 32% 28%, #46ff97, #0e6e33 75%)", color: "#04140a" }}>
                          {initials(u.name ?? "U")}
                        </span>
                        <span>
                          <span style={{ fontWeight: 600 }}>{u.name}</span><br />
                          <span style={{ fontSize: 10.5, color: "var(--mut)" }}>{u.email}</span>
                        </span>
                      </div>
                    </td>
                    <td><span className={`bdg ${ROLE_BADGE[u.role] ?? "ghost"}`}>{u.role}</span></td>
                    <td style={{ fontSize: 11.5, color: "var(--mut)" }}>
                      {u.phone ?? "—"}{u.phone_verified_at && <span style={{ color: "var(--green)" }}> ✓</span>}
                    </td>
                    <td><span className={`bdg ${STATUS_BADGE[u.account_status] ?? "ghost"}`}>{u.account_status}</span></td>
                    <td style={{ fontSize: 11.5, color: "var(--mut)" }}>
                      {new Date(u.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      {u.role !== "sportx_admin" && (
                        <>
                          {u.account_status !== "active" && (
                            <button className="btn sm green" disabled={busy === u.id}
                              onClick={() => setStatus(u.id, "active")}>Activate</button>
                          )}{" "}
                          {u.account_status !== "suspended" && (
                            <button className="btn sm danger" disabled={busy === u.id}
                              onClick={() => setStatus(u.id, "suspended")}>Suspend</button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--mut)", padding: 24 }}>No users match</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = `
.um-shell { max-width: 1200px; margin: 0 auto; }
.um-head { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 16px; }
.um-title { font-family: var(--num); font-size: 28px; font-weight: 700; margin-top: 4px; }
.um-table { width: 100%; border-collapse: collapse; }
.um-table th { background: var(--head); font-family: var(--num); font-size: 9.5px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: var(--lbl); text-align: left; padding: 9px 12px; }
.um-table th:first-child { border-radius: 8px 0 0 8px; }
.um-table th:last-child  { border-radius: 0 8px 8px 0; }
.um-table td { padding: 9px 12px; font-size: 12.5px; border-top: 1px solid var(--line); vertical-align: middle; }
.um-toast { position: fixed; bottom: 24px; right: 24px; z-index: 999; background: #121712; border: 1px solid var(--line2); border-radius: 10px; padding: 10px 18px; font-size: 12.5px; font-weight: 600; color: var(--green); box-shadow: 0 4px 24px rgba(0,0,0,0.6); }
`;
