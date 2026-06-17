/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2, XCircle, ZoomIn, ZoomOut, X, ExternalLink, Loader2,
} from "lucide-react";

const T = {
  card: "#080F1E",
  cardSunken: "#060C17",
  border: "#1E3A5F",
  borderHover: "#2D4F7C",
  accent: "#22C55E",
  accentDeep: "#16A34A",
  text: "#E2E8F0",
  muted: "#94A3B8",
  textMuted: "#64748B",
  warning: "#F59E0B",
  warningDeep: "#B45309",
  danger: "#EF4444",
  dangerDeep: "#B91C1C",
};

interface Scorecard {
  id: string;
  opponent: string;
  match_date: string;
  format: string;
  mqi_tag: string;
  mqi_weight: number | null;
  scorecard_url: string;
  ocr_confidence: number | null;
  ocr_status: string;
  runs_scored: number | null;
  wickets_taken: number | null;
  created_at: string;
  player_id: string;
  player_name: string;
  player_city: string | null;
  player_state: string | null;
  avatar_url: string | null;
}

/** Normalise OCR confidence — stored as either 0–1 decimal or 0–100 integer. */
function confidencePct(raw: number | null | undefined): number | null {
  if (raw == null) return null;
  const v = Number(raw);
  if (!Number.isFinite(v)) return null;
  return Math.round(v <= 1 ? v * 100 : v);
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

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join("") || "?";
}

export default function ScorecardQueue() {
  const [rows, setRows] = useState<Scorecard[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [lightbox, setLightbox] = useState<Scorecard | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/scorecards");
      const data = await res.json().catch(() => null);
      if (data?.success) setRows(data.data?.scorecards ?? []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function approveOne(s: Scorecard) {
    setBusyId(s.id);
    try {
      const res = await fetch("/api/admin/scorecards/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_log_id: s.id, player_id: s.player_id }),
      });
      if (res.ok) {
        setRows((r) => r.filter((x) => x.id !== s.id));
        setSelected((set) => { const n = new Set(set); n.delete(s.id); return n; });
      }
    } finally { setBusyId(null); }
  }

  async function rejectOne(s: Scorecard, reason: string) {
    setBusyId(s.id);
    try {
      const res = await fetch("/api/admin/scorecards/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_log_id: s.id, player_id: s.player_id, reason }),
      });
      if (res.ok) {
        setRows((r) => r.filter((x) => x.id !== s.id));
        setSelected((set) => { const n = new Set(set); n.delete(s.id); return n; });
      }
    } finally {
      setBusyId(null);
      setRejectingId(null);
      setRejectReason("");
    }
  }

  /* ----- Bulk approve (only for >75% confidence rows) ----- */
  const allEligibleConfidence = useMemo(() => {
    if (selected.size === 0) return false;
    for (const s of rows) {
      if (!selected.has(s.id)) continue;
      const pct = confidencePct(s.ocr_confidence);
      if (pct == null || pct < 75) return false;
    }
    return true;
  }, [selected, rows]);

  async function bulkApprove() {
    if (!allEligibleConfidence) return;
    setBulkBusy(true);
    try {
      const ids = Array.from(selected);
      const targets = rows.filter((r) => ids.includes(r.id));
      // Sequential to keep things deterministic.
      for (const s of targets) {
        await fetch("/api/admin/scorecards/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ match_log_id: s.id, player_id: s.player_id }),
        });
      }
      setRows((r) => r.filter((x) => !ids.includes(x.id)));
      setSelected(new Set());
    } finally { setBulkBusy(false); }
  }

  function toggleSelect(id: string) {
    setSelected((set) => {
      const n = new Set(set);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function toggleSelectAll() {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  }

  return (
    <div className="space-y-3">
      {/* Bulk actions row */}
      <div
        className="flex items-center justify-between gap-3 flex-wrap p-3 rounded-xl"
        style={{ background: T.card, border: `1px solid ${T.border}` }}
      >
        <div className="flex items-center gap-3 text-sm">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.size > 0 && selected.size === rows.length}
              ref={(el) => {
                if (el) el.indeterminate = selected.size > 0 && selected.size < rows.length;
              }}
              onChange={toggleSelectAll}
              style={{ accentColor: T.accent }}
            />
            <span style={{ color: T.text }}>Select All</span>
          </label>
          <span style={{ color: T.muted }}>·</span>
          <span style={{ color: T.muted }}>
            <strong style={{ color: T.text }}>{selected.size}</strong> selected
          </span>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs" style={{ color: T.muted }}>
            Showing <strong style={{ color: T.text }}>{rows.length}</strong> pending scorecard
            {rows.length === 1 ? "" : "s"}
          </p>
          <button
            type="button"
            onClick={bulkApprove}
            disabled={!allEligibleConfidence || bulkBusy}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md"
            style={{
              background: allEligibleConfidence ? T.accent : T.border,
              color: allEligibleConfidence ? "#062012" : T.muted,
              border: `1px solid ${allEligibleConfidence ? T.accentDeep : T.border}`,
              cursor: allEligibleConfidence && !bulkBusy ? "pointer" : "not-allowed",
            }}
            title={
              selected.size === 0
                ? "Select rows first"
                : !allEligibleConfidence
                ? "All selected rows must have OCR confidence > 75%"
                : "Approve all selected"
            }
          >
            {bulkBusy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
            Approve Selected
          </button>
        </div>
      </div>

      {/* Table or empty state */}
      {loading ? (
        <div
          className="p-10 text-center text-sm rounded-xl"
          style={{ background: T.card, border: `1px solid ${T.border}`, color: T.muted }}
        >
          <Loader2 className="inline-block animate-spin" size={20} /> Loading scorecards…
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
            All scorecards reviewed
          </p>
          <p className="text-xs" style={{ color: T.muted }}>The queue is clear.</p>
        </div>
      ) : (
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: T.card, border: `1px solid ${T.border}` }}
        >
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 900 }}>
              <thead>
                <tr style={{ background: T.cardSunken }}>
                  <Th style={{ width: 32 }} />
                  <Th>Player</Th>
                  <Th>Match Details</Th>
                  <Th>Uploaded</Th>
                  <Th>OCR Confidence</Th>
                  <Th>Scorecard</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <Row
                    key={s.id}
                    s={s}
                    selected={selected.has(s.id)}
                    onToggle={() => toggleSelect(s.id)}
                    busy={busyId === s.id}
                    onApprove={() => approveOne(s)}
                    onStartReject={() => {
                      setRejectingId(s.id);
                      setRejectReason("");
                    }}
                    rejecting={rejectingId === s.id}
                    rejectReason={rejectReason}
                    setRejectReason={setRejectReason}
                    onConfirmReject={() => rejectOne(s, rejectReason.trim() || "Scorecard could not be verified.")}
                    onCancelReject={() => { setRejectingId(null); setRejectReason(""); }}
                    onOpenLightbox={() => setLightbox(s)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && <Lightbox scorecard={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}

/* ============================================================ */
/* Row                                                           */
/* ============================================================ */
interface RowProps {
  s: Scorecard;
  selected: boolean;
  onToggle: () => void;
  busy: boolean;
  onApprove: () => void;
  onStartReject: () => void;
  rejecting: boolean;
  rejectReason: string;
  setRejectReason: (v: string) => void;
  onConfirmReject: () => void;
  onCancelReject: () => void;
  onOpenLightbox: () => void;
}

function Row({
  s, selected, onToggle, busy, onApprove,
  onStartReject, rejecting, rejectReason, setRejectReason,
  onConfirmReject, onCancelReject, onOpenLightbox,
}: RowProps) {
  const pct = confidencePct(s.ocr_confidence);
  return (
    <>
      <tr style={{ borderBottom: `1px solid ${T.border}` }}>
        <Td>
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            style={{ accentColor: T.accent, cursor: "pointer" }}
          />
        </Td>
        {/* Player */}
        <Td>
          <a
            href={`/profile/${s.player_id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 group"
            style={{ color: T.text, textDecoration: "none" }}
          >
            {s.avatar_url ? (
              <img
                src={s.avatar_url}
                alt=""
                style={{
                  width: 28, height: 28, borderRadius: 999,
                  objectFit: "cover",
                  border: `1px solid ${T.border}`,
                }}
              />
            ) : (
              <span
                className="rounded-full flex items-center justify-center font-bold"
                style={{
                  width: 28, height: 28, fontSize: 11,
                  background: T.cardSunken,
                  border: `1px solid ${T.border}`,
                  color: T.accent,
                }}
              >
                {initialsOf(s.player_name)}
              </span>
            )}
            <div>
              <p style={{ fontSize: 12, fontWeight: 600 }}>{s.player_name}</p>
              {(s.player_city || s.player_state) && (
                <p style={{ fontSize: 10, color: T.muted }}>
                  {[s.player_city, s.player_state].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
            <ExternalLink size={10} style={{ color: T.muted, opacity: 0.6 }} />
          </a>
        </Td>

        {/* Match Details */}
        <Td>
          <p style={{ fontSize: 12, fontWeight: 700 }}>vs {s.opponent}</p>
          <p style={{ fontSize: 10, color: T.muted }}>
            {s.format} · {s.mqi_tag}{s.mqi_weight != null ? ` (${Number(s.mqi_weight).toFixed(1)}×)` : ""}
          </p>
          <p style={{ fontSize: 10, color: T.muted }}>
            {String(s.match_date).slice(0, 10)} · R {s.runs_scored ?? 0} · W {s.wickets_taken ?? 0}
          </p>
        </Td>

        {/* Uploaded */}
        <Td>
          <span style={{ fontSize: 12, color: T.text }}>{relativeTime(s.created_at)}</span>
        </Td>

        {/* OCR confidence */}
        <Td>
          <ConfidenceBadge pct={pct} />
        </Td>

        {/* Scorecard */}
        <Td>
          {s.scorecard_url ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenLightbox}
                style={{
                  background: "transparent", border: "none", cursor: "pointer", padding: 0,
                }}
              >
                <img
                  src={s.scorecard_url}
                  alt=""
                  style={{
                    width: 60, height: 80, objectFit: "cover",
                    borderRadius: 6, border: `1px solid ${T.border}`,
                    display: "block",
                  }}
                />
              </button>
              <button
                type="button"
                onClick={onOpenLightbox}
                className="text-[10px] font-semibold px-2 py-1 rounded"
                style={{
                  background: "transparent",
                  color: T.text,
                  border: `1px solid ${T.border}`,
                  cursor: "pointer",
                }}
              >
                View Full
              </button>
            </div>
          ) : (
            <span style={{ color: T.muted, fontSize: 12 }}>—</span>
          )}
        </Td>

        {/* Actions */}
        <Td>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onApprove}
              disabled={busy || rejecting}
              className="inline-flex items-center gap-1 font-semibold rounded-md"
              style={{
                background: T.accent, color: "#062012",
                border: `1px solid ${T.accentDeep}`,
                padding: "5px 9px", fontSize: 11,
                cursor: busy || rejecting ? "not-allowed" : "pointer",
                opacity: busy || rejecting ? 0.5 : 1,
              }}
            >
              <CheckCircle2 size={12} /> Approve +3pts
            </button>
            <button
              type="button"
              onClick={onStartReject}
              disabled={busy || rejecting}
              className="inline-flex items-center gap-1 font-semibold rounded-md"
              style={{
                background: T.danger, color: "#fff",
                border: `1px solid ${T.dangerDeep}`,
                padding: "5px 9px", fontSize: 11,
                cursor: busy || rejecting ? "not-allowed" : "pointer",
                opacity: busy ? 0.5 : 1,
              }}
            >
              <XCircle size={12} /> Reject
            </button>
          </div>
        </Td>
      </tr>

      {/* Inline reject reason row */}
      {rejecting && (
        <tr style={{ background: T.cardSunken }}>
          <td colSpan={7} style={{ padding: "10px 12px", borderBottom: `1px solid ${T.border}` }}>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                autoFocus
                type="text"
                placeholder="Reason for rejection (e.g. unreadable scoreboard, wrong match, watermark obscured)"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onConfirmReject();
                  if (e.key === "Escape") onCancelReject();
                }}
                className="flex-1 min-w-[280px] px-3 py-2 rounded-md"
                style={{
                  background: T.card,
                  color: T.text,
                  border: `1px solid ${T.border}`,
                  fontSize: 12,
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={onConfirmReject}
                disabled={busy}
                className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-md"
                style={{
                  background: T.danger, color: "#fff",
                  border: `1px solid ${T.dangerDeep}`,
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                {busy ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={11} />}
                Confirm Reject
              </button>
              <button
                type="button"
                onClick={onCancelReject}
                disabled={busy}
                className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-md"
                style={{
                  background: "transparent", color: T.text,
                  border: `1px solid ${T.border}`,
                  cursor: busy ? "not-allowed" : "pointer",
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
/* Confidence badge                                              */
/* ============================================================ */
function ConfidenceBadge({ pct }: { pct: number | null }) {
  if (pct == null) {
    return <span style={{ color: T.muted, fontSize: 12 }}>—</span>;
  }
  const palette =
    pct > 80 ? { bg: T.accent, bd: T.accentDeep, label: "Auto-eligible" } :
    pct >= 60 ? { bg: T.warning, bd: T.warningDeep, label: "Manual check" } :
    { bg: T.danger, bd: T.dangerDeep, label: "Likely unclear" };
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        background: palette.bg, color: "#fff",
        border: `1px solid ${palette.bd}`,
        padding: "3px 8px",
        borderRadius: 4,
        fontSize: 11, fontWeight: 700,
      }}
    >
      <span style={{ fontFamily: "ui-monospace" }}>{pct}%</span>
      <span style={{ fontSize: 9, opacity: 0.85, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {palette.label}
      </span>
    </span>
  );
}

/* ============================================================ */
/* Lightbox                                                      */
/* ============================================================ */
function Lightbox({ scorecard, onClose }: { scorecard: Scorecard; onClose: () => void }) {
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
            Scorecard preview
          </p>
          <p style={{ color: T.text, fontWeight: 700 }}>
            {scorecard.player_name}{" "}
            <span style={{ color: T.muted, fontWeight: 400 }}>
              vs {scorecard.opponent} · {scorecard.format} · {String(scorecard.match_date).slice(0, 10)}
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
          flex: 1, overflow: "auto",
          padding: 24,
          display: "flex", alignItems: "flex-start", justifyContent: "center",
        }}
      >
        <img
          src={scorecard.scorecard_url}
          alt="Scorecard"
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
/* Tiny table helpers                                            */
/* ============================================================ */
function Th({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
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
        ...style,
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
        verticalAlign: "middle",
      }}
    >
      {children}
    </td>
  );
}
