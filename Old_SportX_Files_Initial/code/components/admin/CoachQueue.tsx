/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2, XCircle, Loader2, FileText, ExternalLink, Users, ZoomIn, ZoomOut, X,
} from "lucide-react";

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

interface CoachRow {
  id: string;
  coach_name: string;
  academy_club: string;
  official_id: string;
  cert_url: string;
  coach_email: string | null;
  player_count_waiting: number;
  created_at: string;
  inviting_player_names: string[];
  inviting_player_ids: string[];
  inviting_player_cities: string[];
}

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "—";
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(t).toLocaleDateString();
}

function isPdf(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\.pdf($|\?)/i.test(url);
}

export default function CoachQueue() {
  const [rows, setRows] = useState<CoachRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [lightbox, setLightbox] = useState<CoachRow | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/coaches");
      const data = await res.json().catch(() => null);
      if (data?.success) setRows(data.data?.coaches ?? []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function approve(c: CoachRow) {
    setBusyId(c.id);
    try {
      const res = await fetch("/api/admin/coaches/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coach_id: c.id }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setRows((r) => r.filter((x) => x.id !== c.id));
      }
    } finally {
      setBusyId(null);
      setConfirmingId(null);
    }
  }

  async function reject(c: CoachRow, reason: string) {
    setBusyId(c.id);
    try {
      const res = await fetch("/api/admin/coaches/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coach_id: c.id, reason }),
      });
      if (res.ok) {
        setRows((r) => r.filter((x) => x.id !== c.id));
      }
    } finally {
      setBusyId(null);
      setRejectingId(null);
      setRejectReason("");
    }
  }

  return (
    <div className="space-y-3">
      <div
        className="flex items-center justify-between p-3 rounded-xl text-xs"
        style={{ background: T.card, border: `1px solid ${T.border}`, color: T.muted }}
      >
        <span>
          Showing <strong style={{ color: T.text }}>{rows.length}</strong> pending coach
          {rows.length === 1 ? "" : "es"}
        </span>
      </div>

      {loading ? (
        <div
          className="p-10 text-center text-sm rounded-xl"
          style={{ background: T.card, border: `1px solid ${T.border}`, color: T.muted }}
        >
          <Loader2 className="inline-block animate-spin" size={20} /> Loading coach applications…
        </div>
      ) : rows.length === 0 ? (
        <div
          className="p-10 text-center rounded-xl space-y-3"
          style={{ background: T.card, border: `1px solid ${T.border}` }}
        >
          <div
            className="mx-auto rounded-full flex items-center justify-center"
            style={{
              width: 64, height: 64,
              background: `${T.accent}22`,
              border: `2px solid ${T.accent}`,
            }}
          >
            <CheckCircle2 size={32} style={{ color: T.accent }} />
          </div>
          <p className="text-base font-semibold" style={{ color: T.text }}>
            No coach applications pending — queue is clear ✅
          </p>
        </div>
      ) : (
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: T.card, border: `1px solid ${T.border}` }}
        >
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 960 }}>
              <thead>
                <tr style={{ background: T.cardSunken }}>
                  <Th>Coach Details</Th>
                  <Th>Academy/Club</Th>
                  <Th>Official ID</Th>
                  <Th>Certificate</Th>
                  <Th>Players Waiting</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <Row
                    key={c.id}
                    c={c}
                    busy={busyId === c.id}
                    confirming={confirmingId === c.id}
                    rejecting={rejectingId === c.id}
                    rejectReason={rejectReason}
                    setRejectReason={setRejectReason}
                    onStartApprove={() => setConfirmingId(c.id)}
                    onConfirmApprove={() => approve(c)}
                    onCancelApprove={() => setConfirmingId(null)}
                    onStartReject={() => {
                      setRejectingId(c.id);
                      setRejectReason("");
                    }}
                    onConfirmReject={() => reject(c, rejectReason.trim() || "Coach credentials could not be verified.")}
                    onCancelReject={() => { setRejectingId(null); setRejectReason(""); }}
                    onOpenCert={() => setLightbox(c)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {lightbox && <Lightbox coach={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}

/* ============================================================ */
/* Row                                                           */
/* ============================================================ */
interface RowProps {
  c: CoachRow;
  busy: boolean;
  confirming: boolean;
  rejecting: boolean;
  rejectReason: string;
  setRejectReason: (v: string) => void;
  onStartApprove: () => void;
  onConfirmApprove: () => void;
  onCancelApprove: () => void;
  onStartReject: () => void;
  onConfirmReject: () => void;
  onCancelReject: () => void;
  onOpenCert: () => void;
}

function Row(p: RowProps) {
  const { c } = p;
  // Impact preview heuristic for tooltip.
  const tierJump = c.player_count_waiting >= 3 ? "T2 → T1" : "T3 → T2";
  const avgIncrease = 5 + Math.min(5, c.player_count_waiting);
  const tooltip = `${c.player_count_waiting} player${c.player_count_waiting === 1 ? "" : "s"} will move ${tierJump}. Avg score increase: +${avgIncrease}`;

  return (
    <>
      <tr style={{ borderBottom: `1px solid ${T.border}` }}>
        {/* Coach details */}
        <Td>
          <p style={{ fontWeight: 700, fontSize: 12 }}>{c.coach_name}</p>
          {c.coach_email && (
            <p style={{ fontSize: 10, color: T.muted }}>{c.coach_email}</p>
          )}
          <p style={{ fontSize: 10, color: T.muted }}>
            Registered {relativeTime(c.created_at)}
          </p>
        </Td>

        {/* Academy/Club */}
        <Td>
          <p style={{ fontSize: 12 }}>{c.academy_club}</p>
          {c.inviting_player_cities && c.inviting_player_cities.filter(Boolean)[0] && (
            <p style={{ fontSize: 10, color: T.muted }}>
              {c.inviting_player_cities.filter(Boolean)[0]}
            </p>
          )}
        </Td>

        {/* Official ID */}
        <Td>
          <code
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 11,
              background: T.cardSunken,
              padding: "2px 6px",
              borderRadius: 4,
              border: `1px solid ${T.border}`,
              color: T.text,
            }}
          >
            {c.official_id || "—"}
          </code>
        </Td>

        {/* Certificate */}
        <Td>
          {c.cert_url ? (
            <div className="flex items-center gap-2">
              {isPdf(c.cert_url) ? (
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: 60, height: 60,
                    borderRadius: 6,
                    background: T.cardSunken,
                    border: `1px solid ${T.border}`,
                    color: T.danger,
                  }}
                >
                  <FileText size={22} />
                </div>
              ) : (
                <img
                  src={c.cert_url}
                  alt=""
                  style={{
                    width: 60, height: 60,
                    objectFit: "cover",
                    borderRadius: 6,
                    border: `1px solid ${T.border}`,
                    display: "block",
                  }}
                />
              )}
              {isPdf(c.cert_url) ? (
                <a
                  href={c.cert_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] font-semibold px-2 py-1 rounded inline-flex items-center gap-1"
                  style={{
                    background: "transparent",
                    color: T.text,
                    border: `1px solid ${T.border}`,
                    textDecoration: "none",
                  }}
                >
                  View <ExternalLink size={9} />
                </a>
              ) : (
                <button
                  type="button"
                  onClick={p.onOpenCert}
                  className="text-[10px] font-semibold px-2 py-1 rounded"
                  style={{
                    background: "transparent",
                    color: T.text,
                    border: `1px solid ${T.border}`,
                    cursor: "pointer",
                  }}
                >
                  View
                </button>
              )}
            </div>
          ) : (
            <span style={{ color: T.muted, fontSize: 12 }}>—</span>
          )}
        </Td>

        {/* Players waiting */}
        <Td>
          <div>
            <span
              className="inline-flex items-center gap-1 px-2 py-1 rounded font-bold"
              style={{
                background: c.player_count_waiting > 0 ? T.warning : T.cardSunken,
                color: c.player_count_waiting > 0 ? "#fff" : T.muted,
                border: `1px solid ${c.player_count_waiting > 0 ? T.warningDeep : T.border}`,
                fontSize: 11,
              }}
            >
              <Users size={11} /> {c.player_count_waiting} player{c.player_count_waiting === 1 ? "" : "s"}
            </span>
            {c.inviting_player_names?.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1" style={{ maxWidth: 220 }}>
                {c.inviting_player_names.slice(0, 6).map((name, i) => (
                  <a
                    key={i}
                    href={`/profile/${c.inviting_player_ids[i]}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{
                      background: T.cardSunken,
                      color: T.text,
                      border: `1px solid ${T.border}`,
                      textDecoration: "none",
                    }}
                    title={`Open ${name}'s profile`}
                  >
                    {name}
                  </a>
                ))}
                {c.inviting_player_names.length > 6 && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{ color: T.muted }}
                  >
                    +{c.inviting_player_names.length - 6} more
                  </span>
                )}
              </div>
            )}
          </div>
        </Td>

        {/* Actions */}
        <Td>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={p.onStartApprove}
              disabled={p.busy || p.confirming || p.rejecting}
              title={tooltip}
              className="inline-flex items-center gap-1 font-semibold rounded-md"
              style={{
                background: T.accent, color: "#062012",
                border: `1px solid ${T.accentDeep}`,
                padding: "5px 9px", fontSize: 11,
                cursor: p.busy || p.confirming || p.rejecting ? "not-allowed" : "pointer",
                opacity: p.busy || p.confirming || p.rejecting ? 0.5 : 1,
              }}
            >
              <CheckCircle2 size={12} /> Approve
            </button>
            <button
              type="button"
              onClick={p.onStartReject}
              disabled={p.busy || p.confirming || p.rejecting}
              className="inline-flex items-center gap-1 font-semibold rounded-md"
              style={{
                background: T.danger, color: "#fff",
                border: `1px solid ${T.dangerDeep}`,
                padding: "5px 9px", fontSize: 11,
                cursor: p.busy || p.confirming || p.rejecting ? "not-allowed" : "pointer",
                opacity: p.busy ? 0.5 : 1,
              }}
            >
              <XCircle size={12} /> Reject
            </button>
          </div>
        </Td>
      </tr>

      {/* Approve confirmation */}
      {p.confirming && (
        <tr style={{ background: T.cardSunken }}>
          <td colSpan={6} style={{ padding: "10px 12px", borderBottom: `1px solid ${T.border}` }}>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs flex-1" style={{ color: T.text }}>
                Approving will award <strong style={{ color: T.accent }}>+5 pts</strong> to{" "}
                <strong>{c.player_count_waiting} player{c.player_count_waiting === 1 ? "" : "s"}</strong>{" "}
                tied to <strong>{c.coach_name}</strong>. Confirm?
              </p>
              <button
                type="button"
                onClick={p.onConfirmApprove}
                disabled={p.busy}
                className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-md"
                style={{
                  background: T.accent, color: "#062012",
                  border: `1px solid ${T.accentDeep}`,
                  cursor: p.busy ? "not-allowed" : "pointer",
                }}
              >
                {p.busy ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                Confirm Approve
              </button>
              <button
                type="button"
                onClick={p.onCancelApprove}
                disabled={p.busy}
                className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-md"
                style={{
                  background: "transparent", color: T.text,
                  border: `1px solid ${T.border}`,
                  cursor: p.busy ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </td>
        </tr>
      )}

      {/* Reject inline reason */}
      {p.rejecting && (
        <tr style={{ background: T.cardSunken }}>
          <td colSpan={6} style={{ padding: "10px 12px", borderBottom: `1px solid ${T.border}` }}>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                autoFocus
                type="text"
                placeholder="Reason for rejection (e.g. cert unreadable, ID mismatch)"
                value={p.rejectReason}
                onChange={(e) => p.setRejectReason(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") p.onConfirmReject();
                  if (e.key === "Escape") p.onCancelReject();
                }}
                className="flex-1 min-w-[280px] px-3 py-2 rounded-md"
                style={{
                  background: T.card, color: T.text,
                  border: `1px solid ${T.border}`,
                  fontSize: 12, outline: "none",
                }}
              />
              <button
                type="button"
                onClick={p.onConfirmReject}
                disabled={p.busy}
                className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-md"
                style={{
                  background: T.danger, color: "#fff",
                  border: `1px solid ${T.dangerDeep}`,
                  cursor: p.busy ? "not-allowed" : "pointer",
                }}
              >
                {p.busy ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={11} />}
                Confirm Reject
              </button>
              <button
                type="button"
                onClick={p.onCancelReject}
                disabled={p.busy}
                className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-md"
                style={{
                  background: "transparent", color: T.text,
                  border: `1px solid ${T.border}`,
                  cursor: p.busy ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ============================================================ */
/* Lightbox                                                      */
/* ============================================================ */
function Lightbox({ coach, onClose }: { coach: CoachRow; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(4, z + 0.25));
      if (e.key === "-") setZoom((z) => Math.max(0.5, z - 0.25));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(4px)",
        display: "flex", flexDirection: "column",
      }}
    >
      <header
        onClick={(e) => e.stopPropagation()}
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: `1px solid ${T.border}` }}
      >
        <div>
          <p style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Coach certificate
          </p>
          <p style={{ color: T.text, fontWeight: 700 }}>
            {coach.coach_name}{" "}
            <span style={{ color: T.muted, fontWeight: 400 }}>
              · {coach.academy_club} · ID {coach.official_id}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            className="inline-flex items-center justify-center"
            style={{
              width: 32, height: 32, borderRadius: 6,
              background: T.cardSunken, color: T.text,
              border: `1px solid ${T.border}`, cursor: "pointer",
            }}
            aria-label="Zoom out"
          >
            <ZoomOut size={14} />
          </button>
          <span
            className="text-xs font-mono"
            style={{ color: T.muted, minWidth: 44, textAlign: "center" }}
          >
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
            className="inline-flex items-center justify-center"
            style={{
              width: 32, height: 32, borderRadius: 6,
              background: T.cardSunken, color: T.text,
              border: `1px solid ${T.border}`, cursor: "pointer",
            }}
            aria-label="Zoom in"
          >
            <ZoomIn size={14} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center"
            style={{
              width: 32, height: 32, borderRadius: 6,
              background: T.danger, color: "#fff",
              border: `1px solid ${T.dangerDeep}`, cursor: "pointer",
            }}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
      </header>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          flex: 1, overflow: "auto", padding: 24,
          display: "flex", alignItems: "flex-start", justifyContent: "center",
        }}
      >
        <img
          src={coach.cert_url}
          alt="Certificate"
          style={{
            maxWidth: "100%",
            transform: `scale(${zoom})`,
            transformOrigin: "top center",
            transition: "transform 200ms ease",
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            background: "#fff",
          }}
        />
      </div>
    </div>
  );
}

/* ============================================================ */
/* Tiny helpers                                                  */
/* ============================================================ */
function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th
      style={{
        padding: "10px 12px",
        textAlign: "left",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: T.muted,
        borderBottom: `1px solid ${T.border}`,
        fontWeight: 600,
      }}
    >
      {children}
    </th>
  );
}
function Td({ children }: { children?: React.ReactNode }) {
  return (
    <td
      style={{
        padding: "10px 12px",
        fontSize: 12,
        color: T.text,
        verticalAlign: "top",
      }}
    >
      {children}
    </td>
  );
}
