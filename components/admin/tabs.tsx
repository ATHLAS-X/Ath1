/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Eye, Trash2, Pause } from "lucide-react";

const T = {
  card: "#080F1E",
  cardSunken: "#060C17",
  border: "#1E3A5F",
  accent: "#22C55E",
  accentDeep: "#16A34A",
  text: "#E2E8F0",
  muted: "#94A3B8",
  warning: "#F59E0B",
  warningDeep: "#B45309",
  danger: "#EF4444",
  dangerDeep: "#B91C1C",
  info: "#3B82F6",
};

const cellStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: `1px solid ${T.border}`,
  fontSize: 12,
  color: T.text,
  verticalAlign: "middle",
};

/* ============================================================ */
/* Section table                                                 */
/* ============================================================ */
function SectionTable({
  headers, children,
}: { headers: string[]; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: T.card, border: `1px solid ${T.border}` }}
    >
      <div className="overflow-x-auto">
        <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 720 }}>
          <thead>
            <tr style={{ background: T.cardSunken }}>
              {headers.map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "10px 12px", textAlign: "left",
                    fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em",
                    color: T.muted, borderBottom: `1px solid ${T.border}`,
                    fontWeight: 600,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

function ActionBtn({
  tone, onClick, disabled, children,
}: { tone: "success" | "danger" | "info"; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  const palette =
    tone === "success" ? { bg: T.accent, bd: T.accentDeep } :
    tone === "danger"  ? { bg: T.danger, bd: T.dangerDeep } :
                         { bg: T.info, bd: "#0369A1" };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1 font-semibold rounded-md"
      style={{
        background: palette.bg,
        color: "#fff",
        border: `1px solid ${palette.bd}`,
        padding: "4px 8px",
        fontSize: 11,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

function ConfChip({ pct }: { pct: number | null }) {
  if (pct == null) return <span style={{ color: T.muted }}>—</span>;
  const tone = pct >= 80 ? T.accent : pct >= 50 ? T.warning : T.danger;
  return (
    <span
      style={{
        background: tone, color: "#fff", border: `1px solid ${tone}`,
        padding: "2px 6px", borderRadius: 4,
        fontSize: 11, fontWeight: 700, fontFamily: "ui-monospace",
      }}
    >
      {pct}%
    </span>
  );
}

/* ============================================================ */
/* Scorecards tab                                                */
/* ============================================================ */
interface Scorecard {
  id: string; opponent: string; match_date: string; format: string;
  scorecard_url: string; ocr_confidence: number | null;
  user_id: string; player_name: string; created_at: string;
}

export function ScorecardsTab() {
  const [rows, setRows] = useState<Scorecard[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/scorecards");
      const data = await res.json().catch(() => null);
      if (data?.success) setRows(data.data?.scorecards ?? []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function approve(id: string) {
    setBusy(id);
    try {
      await fetch(`/api/admin/scorecards/${id}/approve`, { method: "POST" });
      setRows((r) => r.filter((x) => x.id !== id));
    } finally { setBusy(null); }
  }
  async function reject(id: string) {
    const reason = window.prompt("Reason for rejection?") ?? "Scorecard could not be verified.";
    setBusy(id);
    try {
      await fetch(`/api/admin/scorecards/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      setRows((r) => r.filter((x) => x.id !== id));
    } finally { setBusy(null); }
  }

  return (
    <SectionTable headers={["Player", "Match", "Date", "Scorecard", "OCR Conf.", "Actions"]}>
      {loading ? (
        <tr><td colSpan={6} style={{ ...cellStyle, textAlign: "center", color: T.muted }}>Loading…</td></tr>
      ) : rows.length === 0 ? (
        <tr><td colSpan={6} style={{ ...cellStyle, textAlign: "center", color: T.muted }}>Queue is clear.</td></tr>
      ) : rows.map((s) => (
        <tr key={s.id}>
          <td style={cellStyle}>{s.player_name}</td>
          <td style={cellStyle}>vs {s.opponent} <span style={{ color: T.muted }}>({s.format})</span></td>
          <td style={cellStyle}>{String(s.match_date).slice(0, 10)}</td>
          <td style={cellStyle}>
            {s.scorecard_url ? (
              <a href={s.scorecard_url} target="_blank" rel="noreferrer">
                <img src={s.scorecard_url} alt="" style={{ width: 60, height: 40, objectFit: "cover", borderRadius: 4, border: `1px solid ${T.border}` }} />
              </a>
            ) : <span style={{ color: T.muted }}>—</span>}
          </td>
          <td style={cellStyle}>
            <ConfChip pct={s.ocr_confidence != null ? Math.round(Number(s.ocr_confidence) * (Number(s.ocr_confidence) <= 1 ? 100 : 1)) : null} />
          </td>
          <td style={cellStyle}>
            <div className="flex gap-2">
              <ActionBtn tone="success" disabled={busy === s.id} onClick={() => approve(s.id)}>
                <CheckCircle2 size={12} /> Approve (+3)
              </ActionBtn>
              <ActionBtn tone="danger" disabled={busy === s.id} onClick={() => reject(s.id)}>
                <XCircle size={12} /> Reject
              </ActionBtn>
            </div>
          </td>
        </tr>
      ))}
    </SectionTable>
  );
}

/* ============================================================ */
/* Coaches tab                                                   */
/* ============================================================ */
interface CoachRow {
  id: string; coach_name: string; academy_club: string;
  official_id: string; cert_url: string;
  user_id: string; player_name: string; players_waiting: number;
}

export function CoachesTab() {
  const [rows, setRows] = useState<CoachRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/coaches");
      const data = await res.json().catch(() => null);
      if (data?.success) setRows(data.data?.coaches ?? []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function approve(id: string) {
    setBusy(id);
    try {
      await fetch(`/api/admin/coaches/${id}/approve`, { method: "POST" });
      setRows((r) => r.filter((x) => x.id !== id));
    } finally { setBusy(null); }
  }
  async function reject(id: string) {
    const reason = window.prompt("Reason for rejection?") ?? "Coach credentials could not be verified.";
    setBusy(id);
    try {
      await fetch(`/api/admin/coaches/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      setRows((r) => r.filter((x) => x.id !== id));
    } finally { setBusy(null); }
  }

  return (
    <SectionTable headers={["Coach", "Academy", "Cert", "Players Waiting", "Actions"]}>
      {loading ? (
        <tr><td colSpan={5} style={{ ...cellStyle, textAlign: "center", color: T.muted }}>Loading…</td></tr>
      ) : rows.length === 0 ? (
        <tr><td colSpan={5} style={{ ...cellStyle, textAlign: "center", color: T.muted }}>No pending coaches.</td></tr>
      ) : rows.map((c) => (
        <tr key={c.id}>
          <td style={cellStyle}>
            {c.coach_name}
            <p style={{ fontSize: 10, color: T.muted }}>ID: {c.official_id}</p>
          </td>
          <td style={cellStyle}>{c.academy_club}</td>
          <td style={cellStyle}>
            {c.cert_url ? (
              <a href={c.cert_url} target="_blank" rel="noreferrer">
                <img src={c.cert_url} alt="" style={{ width: 60, height: 40, objectFit: "cover", borderRadius: 4, border: `1px solid ${T.border}` }} />
              </a>
            ) : <span style={{ color: T.muted }}>—</span>}
          </td>
          <td style={cellStyle}>
            <span className="font-mono font-bold" style={{ color: c.players_waiting > 1 ? T.accent : T.text }}>
              {c.players_waiting}
            </span>
          </td>
          <td style={cellStyle}>
            <div className="flex gap-2">
              <ActionBtn tone="success" disabled={busy === c.id} onClick={() => approve(c.id)}>
                <CheckCircle2 size={12} /> Approve (+5/player)
              </ActionBtn>
              <ActionBtn tone="danger" disabled={busy === c.id} onClick={() => reject(c.id)}>
                <XCircle size={12} /> Reject
              </ActionBtn>
            </div>
          </td>
        </tr>
      ))}
    </SectionTable>
  );
}

/* ============================================================ */
/* Fraud Flags tab                                               */
/* ============================================================ */
interface Flag {
  id: string; user_id: string; player_name: string; player_email: string;
  account_status: string; flag_type: string; reason: string; status: string; created_at: string;
}

export function FlagsTab() {
  const [rows, setRows] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/flags");
      const data = await res.json().catch(() => null);
      if (data?.success) setRows(data.data?.flags ?? []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function dismiss(id: string) {
    setBusy(id);
    try {
      await fetch(`/api/admin/flags/${id}/dismiss`, { method: "POST" });
      setRows((r) => r.filter((x) => x.id !== id));
    } finally { setBusy(null); }
  }
  async function suspend(id: string) {
    if (!window.confirm("Suspend this account?")) return;
    setBusy(id);
    try {
      await fetch(`/api/admin/flags/${id}/suspend`, { method: "POST" });
      setRows((r) => r.filter((x) => x.id !== id));
    } finally { setBusy(null); }
  }

  return (
    <SectionTable headers={["Type", "Player", "Reason", "Flagged", "Actions"]}>
      {loading ? (
        <tr><td colSpan={5} style={{ ...cellStyle, textAlign: "center", color: T.muted }}>Loading…</td></tr>
      ) : rows.length === 0 ? (
        <tr><td colSpan={5} style={{ ...cellStyle, textAlign: "center", color: T.muted }}>No open flags.</td></tr>
      ) : rows.map((f) => (
        <tr key={f.id}>
          <td style={cellStyle}>
            <span
              style={{
                background: T.warning, color: "#fff", border: `1px solid ${T.warningDeep}`,
                padding: "2px 6px", borderRadius: 4,
                fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em",
              }}
            >
              {f.flag_type}
            </span>
          </td>
          <td style={cellStyle}>
            {f.player_name}
            <p style={{ fontSize: 10, color: T.muted }}>{f.player_email}</p>
            <p style={{ fontSize: 10 }}>
              <span style={{ color: f.account_status === "SUSPENDED" ? T.danger : T.muted }}>
                {f.account_status ?? "ACTIVE"}
              </span>
            </p>
          </td>
          <td style={{ ...cellStyle, maxWidth: 380 }}>{f.reason}</td>
          <td style={cellStyle}>{String(f.created_at).slice(0, 10)}</td>
          <td style={cellStyle}>
            <div className="flex gap-2">
              <ActionBtn tone="info" onClick={() => window.open(`/profile/${f.user_id}`, "_blank")}>
                <Eye size={12} /> Review
              </ActionBtn>
              <ActionBtn tone="success" disabled={busy === f.id} onClick={() => dismiss(f.id)}>
                <Trash2 size={12} /> Dismiss
              </ActionBtn>
              <ActionBtn tone="danger" disabled={busy === f.id} onClick={() => suspend(f.id)}>
                <Pause size={12} /> Suspend
              </ActionBtn>
            </div>
          </td>
        </tr>
      ))}
    </SectionTable>
  );
}
