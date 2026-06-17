"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Loader2, ShieldCheck, Search, Pause, Trash2, ExternalLink,
} from "lucide-react";

const T = {
  card: "#080F1E",
  cardSunken: "#060C17",
  border: "#1E3A5F",
  text: "#E2E8F0",
  muted: "#94A3B8",
  accent: "#22C55E",
  accentDeep: "#16A34A",
  warning: "#F59E0B",
  warningDeep: "#B45309",
  danger: "#EF4444",
  dangerDeep: "#B91C1C",
  orange: "#FB923C",
  orangeDeep: "#C2410C",
  info: "#3B82F6",
  infoDeep: "#1D4ED8",
  gray: "#64748B",
};

type Severity = "critical" | "warning" | "low";
type Status = "OPEN" | "UNDER_INVESTIGATION" | "RESOLVED" | "DISMISSED";

interface Flag {
  id: string;
  flag_type: string;
  affected_user_id: string;
  affected_name: string;
  affected_email: string | null;
  affected_role: string;
  account_status: string | null;
  flagged_reason: string;
  status: Status;
  created_at: string;
  severity: Severity;
}

/* ---------- Flag-type → colour map ---------- */
const FLAG_PALETTE: Record<string, { bg: string; bd: string; severity: Severity }> = {
  DUPLICATE_AADHAAR:   { bg: T.danger,  bd: T.dangerDeep,  severity: "critical" },
  AGE_DISCREPANCY:     { bg: T.danger,  bd: T.dangerDeep,  severity: "critical" },
  STAT_IMPOSSIBILITY:  { bg: T.warning, bd: T.warningDeep, severity: "warning" },
  BULK_VERIFY_ABUSE:   { bg: T.warning, bd: T.warningDeep, severity: "warning" },
  SUSPICIOUS_DEVICE:   { bg: T.warning, bd: T.warningDeep, severity: "warning" },
  SELF_VERIFICATION:   { bg: T.orange,  bd: T.orangeDeep,  severity: "low" },
};
function paletteFor(type: string) {
  return FLAG_PALETTE[type] ?? { bg: T.gray, bd: T.gray, severity: "warning" as Severity };
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

export default function FraudFlags() {
  const [rows, setRows] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | Severity>("all");
  const [expandedReason, setExpandedReason] = useState<string | null>(null);

  const [suspendingId, setSuspendingId] = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [dismissNote, setDismissNote] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/flags");
      const data = await res.json().catch(() => null);
      if (data?.success) setRows(data.data?.flags ?? []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((r) => r.severity === filter);
  }, [rows, filter]);

  const counts = useMemo(() => {
    const c = { critical: 0, warning: 0, low: 0 };
    for (const r of rows) c[r.severity]++;
    return c;
  }, [rows]);

  async function investigate(id: string) {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/flags/investigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flag_id: id }),
      });
      if (res.ok) {
        setRows((r) => r.map((x) => x.id === id ? { ...x, status: "UNDER_INVESTIGATION" } : x));
      }
    } finally { setBusyId(null); }
  }
  async function suspendUser(f: Flag) {
    setBusyId(f.id);
    try {
      const res = await fetch("/api/admin/flags/suspend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flag_id: f.id, user_id: f.affected_user_id }),
      });
      if (res.ok) setRows((r) => r.filter((x) => x.id !== f.id));
    } finally {
      setBusyId(null);
      setSuspendingId(null);
    }
  }
  async function dismiss(id: string, note: string) {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/flags/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flag_id: id, note }),
      });
      if (res.ok) setRows((r) => r.filter((x) => x.id !== id));
    } finally {
      setBusyId(null);
      setDismissingId(null);
      setDismissNote("");
    }
  }

  return (
    <div className="space-y-3">
      {/* Severity filter tabs */}
      <div
        className="flex items-center gap-1 p-1 rounded-xl"
        style={{ background: T.card, border: `1px solid ${T.border}`, width: "fit-content" }}
      >
        {[
          { key: "all" as const,      label: "All",      count: rows.length, tone: T.text },
          { key: "critical" as const, label: "Critical", count: counts.critical, tone: T.danger },
          { key: "warning" as const,  label: "Warning",  count: counts.warning,  tone: T.warning },
          { key: "low" as const,      label: "Low",      count: counts.low,      tone: T.orange },
        ].map((tab) => {
          const active = filter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className="px-3 py-1.5 rounded text-xs font-semibold inline-flex items-center gap-1.5"
              style={{
                background: active ? T.cardSunken : "transparent",
                color: active ? tab.tone : T.muted,
                border: active ? `1px solid ${tab.tone}` : `1px solid transparent`,
                cursor: "pointer",
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: 999, background: tab.tone, display: "inline-block" }} />
              {tab.label}
              {tab.count > 0 && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: tab.tone, color: "#000", minWidth: 18, textAlign: "center" }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div
          className="p-10 text-center text-sm rounded-xl"
          style={{ background: T.card, border: `1px solid ${T.border}`, color: T.muted }}
        >
          <Loader2 className="inline-block animate-spin" size={20} /> Loading flags…
        </div>
      ) : filtered.length === 0 ? (
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
            <ShieldCheck size={32} style={{ color: T.accent }} />
          </div>
          <p className="text-base font-semibold" style={{ color: T.text }}>
            No open fraud flags — platform integrity is clean ✅
          </p>
        </div>
      ) : (
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: T.card, border: `1px solid ${T.border}` }}
        >
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 1080 }}>
              <thead>
                <tr style={{ background: T.cardSunken }}>
                  <Th style={{ width: 60 }}>Severity</Th>
                  <Th>Flag Type</Th>
                  <Th>Affected Account</Th>
                  <Th>Reason</Th>
                  <Th>Flagged</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f) => (
                  <Row
                    key={f.id}
                    f={f}
                    busy={busyId === f.id}
                    suspending={suspendingId === f.id}
                    dismissing={dismissingId === f.id}
                    dismissNote={dismissNote}
                    setDismissNote={setDismissNote}
                    expandedReason={expandedReason === f.id}
                    onToggleReason={() => setExpandedReason((id) => id === f.id ? null : f.id)}
                    onInvestigate={() => investigate(f.id)}
                    onStartSuspend={() => setSuspendingId(f.id)}
                    onConfirmSuspend={() => suspendUser(f)}
                    onCancelSuspend={() => setSuspendingId(null)}
                    onStartDismiss={() => {
                      setDismissingId(f.id);
                      setDismissNote("");
                    }}
                    onConfirmDismiss={() => dismiss(f.id, dismissNote)}
                    onCancelDismiss={() => { setDismissingId(null); setDismissNote(""); }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================ */
/* Row                                                           */
/* ============================================================ */
interface RowProps {
  f: Flag;
  busy: boolean;
  suspending: boolean;
  dismissing: boolean;
  dismissNote: string;
  setDismissNote: (v: string) => void;
  expandedReason: boolean;
  onToggleReason: () => void;
  onInvestigate: () => void;
  onStartSuspend: () => void;
  onConfirmSuspend: () => void;
  onCancelSuspend: () => void;
  onStartDismiss: () => void;
  onConfirmDismiss: () => void;
  onCancelDismiss: () => void;
}

function Row(p: RowProps) {
  const { f } = p;
  const pal = paletteFor(f.flag_type);
  const isInvestigating = f.status === "UNDER_INVESTIGATION";

  return (
    <>
      <tr style={{ borderBottom: `1px solid ${T.border}` }}>
        <Td>
          <span style={{
            width: 12, height: 12, borderRadius: 999,
            background: pal.bg, display: "inline-block",
            boxShadow: `0 0 8px ${pal.bg}aa`,
          }} />
        </Td>
        {/* Flag type */}
        <Td>
          <span
            style={{
              background: pal.bg, color: "#fff",
              border: `1px solid ${pal.bd}`,
              padding: "3px 8px", borderRadius: 4,
              fontSize: 11, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.04em",
              display: "inline-block",
            }}
          >
            {f.flag_type.replaceAll("_", " ")}
          </span>
        </Td>
        {/* Affected */}
        <Td>
          <a
            href={`/profile/${f.affected_user_id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1"
            style={{ color: T.text, fontWeight: 600, fontSize: 12, textDecoration: "none" }}
          >
            {f.affected_name} <ExternalLink size={10} style={{ color: T.muted, opacity: 0.6 }} />
          </a>
          <div className="flex items-center gap-1.5 mt-1">
            <span
              className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{
                background: T.cardSunken, color: T.muted,
                border: `1px solid ${T.border}`,
              }}
            >
              {f.affected_role}
            </span>
            {f.account_status === "SUSPENDED" && (
              <span
                className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{ background: T.danger, color: "#fff" }}
              >
                Suspended
              </span>
            )}
          </div>
          {f.affected_email && (
            <p style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{f.affected_email}</p>
          )}
        </Td>
        {/* Reason */}
        <Td>
          <p
            onClick={p.onToggleReason}
            style={{
              fontSize: 12, color: T.text, cursor: "pointer",
              ...(p.expandedReason ? {} : {
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }),
              maxWidth: 320,
            }}
            title={p.expandedReason ? "Click to collapse" : "Click to expand"}
          >
            {f.flagged_reason}
          </p>
        </Td>
        {/* Flagged */}
        <Td>
          <span style={{ fontSize: 12 }}>{relativeTime(f.created_at)}</span>
        </Td>
        {/* Status */}
        <Td>
          <StatusBadge status={f.status} />
        </Td>
        {/* Actions */}
        <Td>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={p.onInvestigate}
              disabled={p.busy || isInvestigating || p.suspending || p.dismissing}
              className="inline-flex items-center gap-1 font-semibold rounded-md"
              style={{
                background: isInvestigating ? T.cardSunken : T.info,
                color: isInvestigating ? T.info : "#fff",
                border: `1px solid ${T.infoDeep}`,
                padding: "5px 9px", fontSize: 11,
                cursor: p.busy || isInvestigating ? "default" : "pointer",
                opacity: p.busy ? 0.6 : 1,
              }}
            >
              <Search size={12} /> {isInvestigating ? "Investigating…" : "Investigate"}
            </button>
            <button
              type="button"
              onClick={p.onStartSuspend}
              disabled={p.busy || p.suspending || p.dismissing}
              className="inline-flex items-center gap-1 font-semibold rounded-md"
              style={{
                background: T.danger, color: "#fff",
                border: `1px solid ${T.dangerDeep}`,
                padding: "5px 9px", fontSize: 11,
                cursor: p.busy || p.suspending || p.dismissing ? "not-allowed" : "pointer",
                opacity: p.busy ? 0.5 : 1,
              }}
            >
              <Pause size={12} /> Suspend Account
            </button>
            <button
              type="button"
              onClick={p.onStartDismiss}
              disabled={p.busy || p.suspending || p.dismissing}
              className="inline-flex items-center gap-1 font-semibold rounded-md"
              style={{
                background: T.gray, color: "#fff",
                border: `1px solid #475569`,
                padding: "5px 9px", fontSize: 11,
                cursor: p.busy || p.suspending || p.dismissing ? "not-allowed" : "pointer",
                opacity: p.busy ? 0.5 : 1,
              }}
            >
              <Trash2 size={12} /> Dismiss
            </button>
          </div>
        </Td>
      </tr>

      {/* Suspend confirmation */}
      {p.suspending && (
        <tr style={{ background: T.cardSunken }}>
          <td colSpan={7} style={{ padding: "10px 12px", borderBottom: `1px solid ${T.border}` }}>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs flex-1" style={{ color: T.text }}>
                This will immediately remove <strong>{f.affected_name}</strong> from all scout searches
                and lock their account. Confirm?
              </p>
              <button
                type="button"
                onClick={p.onConfirmSuspend}
                disabled={p.busy}
                className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-md"
                style={{
                  background: T.danger, color: "#fff",
                  border: `1px solid ${T.dangerDeep}`,
                  cursor: p.busy ? "not-allowed" : "pointer",
                }}
              >
                {p.busy ? <Loader2 size={11} className="animate-spin" /> : <Pause size={11} />}
                Confirm Suspend
              </button>
              <button
                type="button"
                onClick={p.onCancelSuspend}
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

      {/* Dismiss note */}
      {p.dismissing && (
        <tr style={{ background: T.cardSunken }}>
          <td colSpan={7} style={{ padding: "10px 12px", borderBottom: `1px solid ${T.border}` }}>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                autoFocus
                type="text"
                placeholder="Why are you dismissing? (optional)"
                value={p.dismissNote}
                onChange={(e) => p.setDismissNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") p.onConfirmDismiss();
                  if (e.key === "Escape") p.onCancelDismiss();
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
                onClick={p.onConfirmDismiss}
                disabled={p.busy}
                className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-md"
                style={{
                  background: T.gray, color: "#fff",
                  border: `1px solid #475569`,
                  cursor: p.busy ? "not-allowed" : "pointer",
                }}
              >
                {p.busy ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                Confirm Dismiss
              </button>
              <button
                type="button"
                onClick={p.onCancelDismiss}
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

function StatusBadge({ status }: { status: Status }) {
  const palette: Record<Status, { bg: string; bd: string; label: string }> = {
    OPEN:               { bg: T.danger,  bd: T.dangerDeep,  label: "OPEN" },
    UNDER_INVESTIGATION:{ bg: T.warning, bd: T.warningDeep, label: "INVESTIGATING" },
    RESOLVED:           { bg: T.accent,  bd: T.accentDeep,  label: "RESOLVED" },
    DISMISSED:          { bg: T.gray,    bd: "#475569",     label: "DISMISSED" },
  };
  const p = palette[status];
  return (
    <span
      style={{
        background: p.bg, color: "#fff",
        border: `1px solid ${p.bd}`,
        padding: "3px 8px", borderRadius: 4,
        fontSize: 11, fontWeight: 700,
        textTransform: "uppercase", letterSpacing: "0.04em",
      }}
    >
      {p.label}
    </span>
  );
}

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
        verticalAlign: "top",
      }}
    >
      {children}
    </td>
  );
}
