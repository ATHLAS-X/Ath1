"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2, XCircle, AlertTriangle, RefreshCw, FileDown, Loader2, ChevronLeft,
} from "lucide-react";

const T = {
  bg: "#050D18",
  card: "#080F1E",
  cardSunken: "#060C17",
  border: "#1E3A5F",
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

type CheckStatus = "PASS" | "FAIL" | "WARN";
interface CheckResult {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  value?: string | number;
}
interface CheckGroup {
  group: "infrastructure" | "data" | "flows";
  title: string;
  items: CheckResult[];
}
interface Payload {
  summary: { pass: number; warn: number; fail: number; total: number; verdict: "LAUNCH_READY" | "READY_WITH_WARNINGS" | "BLOCKED" };
  groups: CheckGroup[];
  checked_at: string;
}

export default function LaunchChecklist() {
  const [data, setData] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/launch-checklist", { cache: "no-store" });
      const j = await res.json().catch(() => null);
      if (j?.success) setData(j.data);
    } finally { setBusy(false); }
  }
  useEffect(() => { run(); }, []);

  function exportPdf() {
    // Print → "Save as PDF" — simplest cross-platform path.
    window.print();
  }

  const verdict = data?.summary.verdict;
  const verdictBg =
    verdict === "LAUNCH_READY" ? T.accent :
    verdict === "BLOCKED" ? T.danger :
    T.warning;
  const verdictLabel =
    verdict === "LAUNCH_READY" ? "🚀 LAUNCH READY" :
    verdict === "BLOCKED" ? "🛑 BLOCKED" :
    verdict === "READY_WITH_WARNINGS" ? "⚠ READY WITH WARNINGS" :
    "—";

  return (
    <main style={{ background: T.bg, color: T.text, minHeight: "100vh" }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body, main { background: white !important; color: #111 !important; }
          .lc-card { background: white !important; color: #111 !important; border: 1px solid #ccc !important; }
          .lc-row { color: #111 !important; }
          .lc-label { color: #111 !important; }
          .lc-detail { color: #444 !important; }
        }
      `}</style>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-5">
        {/* Header */}
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <Link href="/admin" className="no-print inline-flex items-center gap-1 text-xs" style={{ color: T.muted }}>
              <ChevronLeft size={12} /> Back to admin
            </Link>
            <p className="text-[10px] uppercase tracking-widest mt-1" style={{ color: T.accent }}>
              SportX V1
            </p>
            <h1 className="text-2xl font-extrabold">Launch Readiness Checklist</h1>
            {data && (
              <p className="text-[11px] mt-1" style={{ color: T.muted }}>
                Last checked {new Date(data.checked_at).toLocaleString()}
              </p>
            )}
          </div>
          <div className="no-print flex items-center gap-2">
            <button
              type="button"
              onClick={run}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-md"
              style={{
                background: T.accent, color: "#062012",
                border: `1px solid ${T.accentDeep}`,
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Run All Checks
            </button>
            <button
              type="button"
              onClick={exportPdf}
              disabled={!data}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-md"
              style={{
                background: "transparent", color: T.text,
                border: `1px solid ${T.border}`,
                cursor: !data ? "not-allowed" : "pointer",
                opacity: !data ? 0.6 : 1,
              }}
            >
              <FileDown size={12} /> Export Checklist PDF
            </button>
          </div>
        </header>

        {/* Verdict + summary */}
        {data && (
          <section
            className="lc-card p-4 rounded-xl flex items-center justify-between gap-3 flex-wrap"
            style={{ background: T.card, border: `1px solid ${T.border}` }}
          >
            <div className="flex items-center gap-3">
              <span
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded font-bold uppercase tracking-wider"
                style={{ background: verdictBg, color: "#fff", fontSize: 13 }}
              >
                {verdictLabel}
              </span>
              <span className="text-xs" style={{ color: T.muted }}>
                {data.summary.pass}/{data.summary.total} checks passing
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <Pill icon={<CheckCircle2 size={11} />} label={`${data.summary.pass} PASS`} color={T.accent} />
              <Pill icon={<AlertTriangle size={11} />} label={`${data.summary.warn} WARN`} color={T.warning} />
              <Pill icon={<XCircle size={11} />} label={`${data.summary.fail} FAIL`} color={T.danger} />
            </div>
          </section>
        )}

        {/* Groups */}
        {!data ? (
          <div
            className="p-10 text-center text-sm rounded-xl"
            style={{ background: T.card, border: `1px solid ${T.border}`, color: T.muted }}
          >
            <Loader2 className="inline-block animate-spin" size={20} /> Running checks…
          </div>
        ) : (
          data.groups.map((g) => (
            <Section key={g.group} title={g.title}>
              <ul>
                {g.items.map((item) => <Item key={item.id} item={item} />)}
              </ul>
            </Section>
          ))
        )}
      </div>
    </main>
  );
}

/* ============================================================ */
/* Subcomponents                                                 */
/* ============================================================ */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="lc-card rounded-xl overflow-hidden"
      style={{ background: T.card, border: `1px solid ${T.border}` }}
    >
      <header className="px-4 py-3" style={{ background: T.cardSunken, borderBottom: `1px solid ${T.border}` }}>
        <h2 className="text-sm font-bold lc-label">{title}</h2>
      </header>
      {children}
    </section>
  );
}

function Item({ item }: { item: CheckResult }) {
  const palette =
    item.status === "PASS" ? { color: T.accent, Icon: CheckCircle2, label: "PASS" } :
    item.status === "WARN" ? { color: T.warning, Icon: AlertTriangle, label: "WARN" } :
    { color: T.danger, Icon: XCircle, label: "FAIL" };
  return (
    <li
      className="lc-row flex items-center gap-3 px-4 py-3"
      style={{ borderBottom: `1px solid ${T.border}` }}
    >
      <span
        style={{
          background: palette.color, color: "#fff",
          padding: "2px 6px", borderRadius: 4,
          fontSize: 10, fontWeight: 700,
          minWidth: 50, textAlign: "center", letterSpacing: "0.04em",
        }}
      >
        {palette.label}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold lc-label" style={{ color: T.text }}>
          {item.label}
        </p>
        <p className="text-xs lc-detail" style={{ color: T.muted }}>
          {item.detail}
        </p>
      </div>
      {item.value != null && (
        <span
          className="text-xs font-mono lc-detail"
          style={{ color: palette.color, fontWeight: 700, minWidth: 80, textAlign: "right" }}
        >
          {item.value}
        </span>
      )}
      <palette.Icon size={18} style={{ color: palette.color, flexShrink: 0 }} />
    </li>
  );
}

function Pill({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold"
      style={{
        background: T.cardSunken, color, border: `1px solid ${color}55`,
      }}
    >
      {icon} {label}
    </span>
  );
}
