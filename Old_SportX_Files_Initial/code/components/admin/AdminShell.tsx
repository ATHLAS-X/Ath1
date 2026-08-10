"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import {
  Users, ShieldCheck, Eye, FileCheck2, UserCheck, AlertOctagon, LogOut, Rocket,
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
  amber: "#F59E0B",
  danger: "#EF4444",
  info: "#3B82F6",
};

interface AdminStats {
  total_players: number;
  verified_players: number;
  active_scouts: number;
  pending_scorecards: number;
  pending_coaches: number;
  open_flags: number;
  total_pending: number;
}

type TabKey = "scorecards" | "coaches" | "flags";

interface Props {
  /** Slot for the actively-selected tab's content (provided by /app/admin/page.tsx) */
  scorecardsTab: React.ReactNode;
  coachesTab: React.ReactNode;
  flagsTab: React.ReactNode;
}

export default function AdminShell({ scorecardsTab, coachesTab, flagsTab }: Props) {
  const { data: session } = useSession();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [tab, setTab] = useState<TabKey>("scorecards");

  async function loadStats() {
    try {
      const res = await fetch("/api/admin/stats");
      const data = await res.json().catch(() => null);
      if (data?.success) setStats(data.data);
    } catch { /* swallow */ }
  }

  // Initial load + auto-refresh every 60s.
  useEffect(() => {
    loadStats();
    const id = setInterval(loadStats, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <main style={{ background: T.bg, color: T.text, minHeight: "100vh" }}>
      <style>{`
        @keyframes adminPulse {
          0%, 100% { box-shadow: 0 0 0 0 ${T.amber}55; border-color: ${T.amber}80; }
          50%     { box-shadow: 0 0 0 6px ${T.amber}00; border-color: ${T.amber}cc; }
        }
        .stat-pulse { animation: adminPulse 1.8s ease-in-out infinite; }
        .tab-btn { transition: color 150ms ease, border-color 150ms ease; }
        .tab-btn:hover { color: ${T.text}; }
      `}</style>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-widest" style={{ color: T.accent }}>
              AthlasX
            </p>
            <h1 className="text-2xl font-extrabold">Admin Console</h1>
          </div>
          <div className="flex items-center gap-3">
            {session?.user?.name && (
              <span
                className="text-xs px-3 py-1.5 rounded-md"
                style={{ background: T.card, border: `1px solid ${T.border}`, color: T.muted }}
              >
                Signed in as <strong style={{ color: T.text }}>{session.user.name}</strong>
              </span>
            )}
            <Link
              href="/admin/launch-checklist"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md"
              style={{
                background: T.accent,
                color: "#062012",
                border: `1px solid ${T.accentDeep}`,
                textDecoration: "none",
              }}
            >
              <Rocket size={12} /> Launch Readiness
            </Link>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md"
              style={{
                background: "transparent",
                color: T.text,
                border: `1px solid ${T.border}`,
                cursor: "pointer",
              }}
            >
              <LogOut size={12} /> Logout
            </button>
          </div>
        </header>

        {/* Stats row (6 cards) */}
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            label="Total Players"
            value={stats?.total_players}
            icon={<Users size={14} />}
          />
          <StatCard
            label="Verified Players"
            value={stats?.verified_players}
            icon={<ShieldCheck size={14} />}
            tone={T.accent}
          />
          <StatCard
            label="Active Scouts"
            value={stats?.active_scouts}
            icon={<Eye size={14} />}
            tone={T.info}
          />
          <StatCard
            label="Pending Scorecards"
            value={stats?.pending_scorecards}
            icon={<FileCheck2 size={14} />}
            pulse={!!stats && stats.pending_scorecards > 0}
          />
          <StatCard
            label="Pending Coaches"
            value={stats?.pending_coaches}
            icon={<UserCheck size={14} />}
            pulse={!!stats && stats.pending_coaches > 0}
          />
          <StatCard
            label="Open Flags"
            value={stats?.open_flags}
            icon={<AlertOctagon size={14} />}
            pulse={!!stats && stats.open_flags > 0}
          />
        </section>

        {/* Tabs */}
        <nav
          className="flex items-end gap-1 border-b"
          style={{ borderColor: T.border }}
        >
          <Tab
            label="Scorecards"
            count={stats?.pending_scorecards}
            active={tab === "scorecards"}
            onClick={() => setTab("scorecards")}
          />
          <Tab
            label="Coaches"
            count={stats?.pending_coaches}
            active={tab === "coaches"}
            onClick={() => setTab("coaches")}
          />
          <Tab
            label="Fraud Flags"
            count={stats?.open_flags}
            active={tab === "flags"}
            onClick={() => setTab("flags")}
          />
        </nav>

        {/* Active tab content */}
        <section>
          {tab === "scorecards" && scorecardsTab}
          {tab === "coaches"    && coachesTab}
          {tab === "flags"      && flagsTab}
        </section>
      </div>
    </main>
  );
}

/* ============================================================ */
/* Stat card                                                     */
/* ============================================================ */
function StatCard({
  label, value, icon, tone, pulse,
}: { label: string; value: number | undefined; icon: React.ReactNode; tone?: string; pulse?: boolean }) {
  const display = value == null ? "—" : value;
  return (
    <div
      className={`p-3 rounded-xl ${pulse ? "stat-pulse" : ""}`}
      style={{
        background: T.card,
        border: `1px solid ${pulse ? T.amber : T.border}`,
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <p
          className="text-[10px] uppercase tracking-widest"
          style={{ color: T.muted }}
        >
          {label}
        </p>
        <span style={{ color: tone ?? T.muted }}>{icon}</span>
      </div>
      <p
        className="text-2xl font-extrabold font-mono"
        style={{ color: tone ?? T.text }}
      >
        {display}
      </p>
    </div>
  );
}

/* ============================================================ */
/* Tab button                                                    */
/* ============================================================ */
function Tab({
  label, count, active, onClick,
}: { label: string; count: number | undefined; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tab-btn relative inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
      style={{
        background: "transparent",
        border: "none",
        color: active ? T.text : T.muted,
        borderBottom: `2px solid ${active ? T.accent : "transparent"}`,
        marginBottom: -1,
        cursor: "pointer",
      }}
    >
      {label}
      {count != null && count > 0 && (
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded"
          style={{
            background: active ? T.accent : T.border,
            color: active ? "#062012" : T.text,
            minWidth: 18, textAlign: "center",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}
