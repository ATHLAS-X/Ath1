"use client";

import { useState } from "react";
import Link from "next/link";
import "@/app/sportx.css";

interface Invite {
  id: string;
  invited_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  sent_at: string | null;
  claimed_at: string | null;
  first_name: string | null;
  last_name: string | null;
}

const TEMPLATE = "name,date_of_birth,gender,playing_role,batting_style,bowling_style,height_cm,weight_kg,city,state,email,phone\nRohit Sharma,30/04/2008,Male,Batsman,Right-hand bat,Off Spin,172,68,Mumbai,Maharashtra,rohit@example.com,+919999999999\n";

interface Props {
  academyName: string;
  academyStatus: string;
  recentInvites: Invite[];
}

const STATUS_COLOR: Record<string, string> = {
  Pending: "ghost",
  Sent:    "amber",
  Claimed: "green",
  Expired: "red",
};

export default function BulkUploadClient({ academyName, academyStatus, recentInvites: initial }: Props) {
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [invites, setInvites] = useState<Invite[]>(initial);

  async function handleFile(f: File) {
    const text = await f.text();
    setCsv(text);
  }

  async function upload() {
    setBusy(true);
    setError(null);
    setSummary(null);
    setResults([]);
    try {
      const res = await fetch("/api/academy/players/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, dry_run: dryRun }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Upload failed");
        return;
      }
      setSummary(data.summary);
      setResults(data.results);
      if (!dryRun) {
        /* Refresh invites list with the new ones */
        const created = (data.results as any[]).filter((r) => r.status === "created");
        if (created.length > 0) {
          const newInvites: Invite[] = created.map((r) => ({
            id: r.invite_token,
            invited_name: r.name ?? null,
            email: r.email ?? null,
            phone: null,
            status: "Sent",
            sent_at: new Date().toISOString(),
            claimed_at: null,
            first_name: null,
            last_name: null,
          }));
          setInvites((x) => [...newInvites, ...x]);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function resend(id: string) {
    await fetch(`/api/academy/invites/${id}/resend`, { method: "POST" });
    setInvites((arr) => arr.map((i) => (i.id === id ? { ...i, sent_at: new Date().toISOString(), status: "Sent" } : i)));
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sportx-player-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="sx-root" style={{ minHeight: "100vh", padding: 24 }}>
      <style>{styles}</style>
      <div className="bu-shell">
        <header className="bu-head">
          <div>
            <div className="sect-title">{academyName}</div>
            <h1 className="bu-title">Bulk upload players</h1>
            <span className={`bdg ${academyStatus === "Approved" ? "green" : "amber"}`}>{academyStatus}</span>
          </div>
          <Link href="/dashboard/academy" className="btn">← Back to dashboard</Link>
        </header>

        <div className="card bu-section">
          <div className="chead2"><span className="sect-title">CSV upload</span></div>
          <div className="cb">
            <p style={{ color: "var(--mut)", fontSize: 12.5, marginBottom: 10 }}>
              Required column: <code>name</code> (or <code>first_name</code> + <code>last_name</code>).
              Optional: DOB, gender, role, batting style, bowling style, height_cm, weight_kg, city, state, email, phone.
            </p>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <button className="btn" onClick={downloadTemplate}>Download template</button>
              <label className="btn">
                Choose file
                <input type="file" accept=".csv,text/csv" style={{ display: "none" }}
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </label>
            </div>
            <textarea className="bu-textarea" value={csv} onChange={(e) => setCsv(e.target.value)}
              placeholder="Paste CSV here or upload a file…" />

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, flexWrap: "wrap", gap: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--mut)" }}>
                <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
                Dry run (preview only — don't insert)
              </label>
              <button className="btn green" disabled={!csv.trim() || busy} onClick={upload}>
                {busy ? "Processing…" : dryRun ? "Preview upload" : "Upload & invite"}
              </button>
            </div>

            {error && <div className="bu-error">{error}</div>}

            {summary && (
              <div className="bu-summary">
                <span className="bdg green">{summary.created} created</span>
                <span className="bdg ghost">{summary.skipped} skipped</span>
                <span className="bdg amber">{summary.errors} errors</span>
                <span style={{ marginLeft: "auto", color: "var(--mut)", fontSize: 11.5 }}>
                  {dryRun ? "Preview only — nothing was saved" : "Invites sent (check server console for stub messages)"}
                </span>
              </div>
            )}

            {results.length > 0 && (
              <table className="bu-table">
                <thead><tr><th>Row</th><th>Status</th><th>Name</th><th>Email</th><th>Notes</th></tr></thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.row_index}>
                      <td>{r.row_index}</td>
                      <td>
                        <span className={`bdg ${r.status === "created" ? "green" : r.status === "skipped" ? "ghost" : "red"}`}>
                          {r.status}
                        </span>
                      </td>
                      <td>{r.name ?? "—"}</td>
                      <td style={{ color: "var(--mut)" }}>{r.email ?? "—"}</td>
                      <td style={{ color: "var(--mut)", fontSize: 11.5 }}>{r.error ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card bu-section">
          <div className="chead2">
            <span className="sect-title">Recent Invites</span>
            <span className="bdg ghost">{invites.length}</span>
          </div>
          <div className="cb">
            {invites.length === 0 ? (
              <div style={{ color: "var(--mut)", fontSize: 12.5 }}>No invites yet</div>
            ) : (
              <table className="bu-table">
                <thead><tr><th>Player</th><th>Contact</th><th>Status</th><th>Sent</th><th>Action</th></tr></thead>
                <tbody>
                  {invites.map((i) => (
                    <tr key={i.id}>
                      <td style={{ fontWeight: 600 }}>{i.invited_name || `${i.first_name ?? ""} ${i.last_name ?? ""}`.trim() || "—"}</td>
                      <td style={{ color: "var(--mut)", fontSize: 11.5 }}>{i.email ?? i.phone ?? "—"}</td>
                      <td><span className={`bdg ${STATUS_COLOR[i.status] ?? "ghost"}`}>{i.status}</span></td>
                      <td style={{ color: "var(--mut)", fontSize: 11.5 }}>
                        {i.sent_at ? new Date(i.sent_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}
                      </td>
                      <td>
                        {i.status !== "Claimed" && (
                          <button className="btn sm" onClick={() => resend(i.id)}>Resend</button>
                        )}
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

const styles = `
.bu-shell { max-width: 1100px; margin: 0 auto; }
.bu-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; gap: 12px; flex-wrap: wrap; }
.bu-title { font-family: var(--num); font-size: 28px; font-weight: 700; margin: 4px 0 6px; }
.bu-section { margin-bottom: 14px; overflow: hidden; }
.bu-textarea { width: 100%; min-height: 140px; padding: 10px 12px; background: var(--card-alt); border: 1px solid var(--line2); border-radius: 9px; color: var(--text); font-family: monospace; font-size: 12.5px; outline: none; resize: vertical; }
.bu-textarea:focus { border-color: var(--green); box-shadow: 0 0 8px var(--green-glow); }
.bu-summary { display: flex; gap: 8px; align-items: center; padding: 10px 12px; margin-top: 14px; background: var(--card-alt); border: 1px solid var(--line); border-radius: 9px; flex-wrap: wrap; }
.bu-table { width: 100%; border-collapse: collapse; margin-top: 14px; }
.bu-table th { background: var(--head); font-family: var(--num); font-size: 9.5px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: var(--lbl); text-align: left; padding: 8px 10px; }
.bu-table th:first-child { border-radius: 7px 0 0 7px; }
.bu-table th:last-child  { border-radius: 0 7px 7px 0; }
.bu-table td { padding: 8px 10px; font-size: 12.5px; border-top: 1px solid var(--line); }
.bu-error { margin: 12px 0 4px; padding: 10px 14px; background: var(--red-bg); border: 1px solid var(--red-bd); border-radius: 9px; color: var(--red); font-size: 12.5px; }
`;
