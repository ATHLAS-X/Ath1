'use client'

import { useState } from 'react'
import { useEffect } from 'react'
import Link from 'next/link'
import { Loader2, Users, LayoutGrid, Inbox, ArrowUpRight, Award } from 'lucide-react'
import { AcademyShell, CARD_CLS, EYEBROW_CLS, H1_CLS } from './_theme'
import { RingGauge } from '@/components/ui/ring-gauge'

// Second restyle pass (docs request, 2026-09-10) — richer table/ring-gauge
// layout matching the new mockup set, still inside the existing
// AcademyShell/chrome.ts nav (not a new shell, per the user's own choice
// when asked). Two mockup elements are still NOT reproduced as literal
// numbers: "92% of season capacity filled" only renders when at least one
// real AcademyBatch.max_players is actually set (most dev/seed batches
// don't set it — no cap means no fabricated denominator), and "monitored
// by N in-house coaches" is dropped outright — there's no concept of an
// academy-level coach headcount anywhere in the schema (coaches belong to
// Squads, a different subsystem).
//
// The "player enrollment, last 8 weeks" sparkline + delta is real —
// AcademyBatchMembership.joined_at bucketed by week via
// loadDashboardBatchSummary (src/lib/academy/batches.ts).

interface BatchRow {
  id: string
  name: string
  age_group: string
  player_count: number
  max_players: number | null
  schedule_label: string
  next_session: string
}

interface DashboardData {
  academy: { id: string; name: string }
  stats: { players: number; batches: number; pending_joins: number }
  batches: BatchRow[]
  enrollmentTrend: { week: string; count: number }[]
  newThisMonth: number
  capacity: { total: number; filled: number } | null
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const w = 100, h = 32
  const min = Math.min(...values), max = Math.max(...values)
  const range = max - min || 1
  const points = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <polyline points={points} fill="none" stroke="rgb(52,211,153)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Kpi({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number | string }) {
  return (
    <div className={CARD_CLS + ' p-4'}>
      <div className="w-[34px] h-[34px] rounded-full bg-[rgba(255,138,30,0.08)] flex items-center justify-center">
        <Icon className="w-4 h-4 text-[color:var(--accent-bright)]" />
      </div>
      <div className="font-[family-name:var(--font-anton)] uppercase text-2xl text-[color:var(--text)] mt-3">{value}</div>
      <p className="text-[10.5px] font-[family-name:var(--font-barlow-semi)] font-bold uppercase tracking-[0.1em] text-[color:var(--text-dim)] mt-0.5">{label}</p>
    </div>
  )
}

export default function AcademyDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/academy/dashboard')
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Failed to load dashboard')
        setData(d)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load dashboard'))
  }, [])

  if (error) {
    return (
      <AcademyShell>
        <div className="p-8 text-sm text-[color:var(--bad)]">{error}</div>
      </AcademyShell>
    )
  }
  if (!data) {
    return (
      <AcademyShell>
        <div className="p-8 flex items-center justify-center text-[color:var(--text-dim)]"><Loader2 className="w-5 h-5 animate-spin" /></div>
      </AcademyShell>
    )
  }

  const avgPerBatch = data.stats.batches > 0 ? Math.round((data.stats.players / data.stats.batches) * 10) / 10 : 0
  const fillPercent = data.capacity && data.capacity.total > 0 ? Math.round((data.capacity.filled / data.capacity.total) * 100) : null

  return (
    <AcademyShell>
      <div className="max-w-[1300px] mx-auto p-6 sm:p-8 space-y-6">
        <div>
          <p className={EYEBROW_CLS}>
            Athlas<span className="text-[color:var(--accent)]">X</span> · Academy Admin
          </p>
          <h1 className={H1_CLS}>{data.academy.name}</h1>
        </div>

        {/* Hero */}
        <div
          className="rounded-[11px] border border-[color:var(--line)] p-6 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-6"
          style={{ background: 'linear-gradient(120deg, rgba(255,138,30,0.08), var(--panel) 55%)' }}
        >
          <div className="flex items-center gap-5 min-w-0">
            <RingGauge value={data.stats.players} max={data.capacity?.total ?? (data.stats.players || 1)} label={data.stats.players} sublabel="Enrolled" />
            <div className="min-w-0">
              <p className={EYEBROW_CLS + ' !text-[color:var(--accent-bright)]'}>Academy overview</p>
              <h2 className="font-[family-name:var(--font-anton)] uppercase font-normal text-xl sm:text-2xl text-[color:var(--text)] mt-1.5 leading-tight">
                {data.stats.batches} active training batch{data.stats.batches === 1 ? '' : 'es'}
                {fillPercent !== null && <>, {fillPercent}% of season capacity filled</>}
              </h2>
              <p className="text-[13.5px] text-[color:var(--text-dim)] mt-2.5 leading-relaxed max-w-md">
                {data.stats.pending_joins > 0
                  ? `${data.stats.pending_joins} pending join request${data.stats.pending_joins === 1 ? '' : 's'} awaiting review.`
                  : 'No pending join requests right now.'}
              </p>
            </div>
          </div>
          {data.stats.pending_joins > 0 && (
            <Link href="/academy/join-requests" className="shrink-0 font-[family-name:var(--font-barlow-semi)] text-[12.5px] font-bold uppercase tracking-[0.06em] bg-[color:var(--accent)] text-[#1a0e02] px-[18px] py-[11px] rounded-[9px] hover:bg-[color:var(--accent-bright)] transition-colors">
              Review {data.stats.pending_joins} join request{data.stats.pending_joins === 1 ? '' : 's'}
            </Link>
          )}
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Kpi icon={Users} label="Total Players" value={data.stats.players} />
          <Kpi icon={LayoutGrid} label="Active Batches" value={data.stats.batches} />
          <Kpi icon={Inbox} label="Pending Joins" value={data.stats.pending_joins} />
          <Kpi icon={Award} label="Avg Players / Batch" value={avgPerBatch} />
        </div>

        {/* Enrollment trend */}
        <div className={CARD_CLS + ' p-5 sm:p-6 flex items-center justify-between gap-4'}>
          <div>
            <p className="text-[10.5px] font-[family-name:var(--font-barlow-semi)] font-bold uppercase tracking-[0.12em] text-[color:var(--text-dim)]">Player enrollment, last 8 weeks</p>
            <div className="font-[family-name:var(--font-anton)] uppercase text-4xl sm:text-[52px] text-[color:var(--text)] leading-none mt-2">{data.stats.players}</div>
            {data.newThisMonth > 0 && (
              <p className="text-[11px] font-bold mt-1.5" style={{ color: 'rgb(52,211,153)' }}>↑ {data.newThisMonth} new this month</p>
            )}
          </div>
          <Sparkline values={data.enrollmentTrend.map((t) => t.count)} />
        </div>

        {/* Training batches table */}
        <div className={CARD_CLS + ' p-0 overflow-hidden'}>
          <div className="px-5 sm:px-6 py-4 border-b border-[color:var(--line)] flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-bold flex items-center gap-2"><LayoutGrid className="w-4 h-4 text-[color:var(--accent)]" /> Training Batches</h2>
              <p className="text-[11px] text-[color:var(--text-dim)] mt-0.5">{data.batches.length} batches · {data.stats.players} players enrolled</p>
            </div>
            <Link href="/academy/batches" className="font-[family-name:var(--font-barlow-semi)] text-[11px] font-bold uppercase tracking-wide text-[color:var(--accent-bright)] border border-[rgba(255,138,30,0.25)] bg-[rgba(255,138,30,0.08)] px-3 py-2 rounded-[7px] hover:bg-[rgba(255,138,30,0.14)] transition-colors">
              Manage Batches
            </Link>
          </div>
          {data.batches.length === 0 ? (
            <p className="p-6 text-sm text-[color:var(--text-faint)]">No batches yet. Create one from the Players page to start assigning players.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10.5px] font-[family-name:var(--font-barlow-semi)] font-bold uppercase tracking-[0.1em] text-[color:var(--text-dim)] border-b border-[color:var(--line)]">
                    <th className="px-5 sm:px-6 py-3 font-bold">Batch Name</th>
                    <th className="px-3 py-3 font-bold">Age Group</th>
                    <th className="px-3 py-3 font-bold">Player Count</th>
                    <th className="px-3 py-3 font-bold hidden md:table-cell">Schedule</th>
                    <th className="px-5 sm:px-6 py-3 font-bold text-right">Next Session</th>
                  </tr>
                </thead>
                <tbody>
                  {data.batches.map((b) => (
                    <tr key={b.id} className="border-b border-[color:var(--line)] last:border-b-0 hover:bg-white/[0.02]">
                      <td className="px-5 sm:px-6 py-3 text-sm font-bold text-[color:var(--text)]">{b.name}</td>
                      <td className="px-3 py-3 text-sm text-[color:var(--text-dim)]">{b.age_group}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-[color:var(--text-dim)] tabular-nums shrink-0">
                            {b.player_count}{b.max_players != null ? `/${b.max_players}` : ''}
                          </span>
                          {b.max_players != null && b.max_players > 0 && (
                            <div className="w-20 h-1.5 rounded-full bg-white/[0.06] overflow-hidden shrink-0">
                              <div className="h-full bg-[color:var(--accent)]" style={{ width: `${Math.min(100, (b.player_count / b.max_players) * 100)}%` }} />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-sm text-[color:var(--text-dim)] hidden md:table-cell">{b.schedule_label}</td>
                      <td className="px-5 sm:px-6 py-3 text-sm text-[color:var(--accent-bright)] font-semibold text-right">{b.next_session}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Link href="/academy/join-requests" className={CARD_CLS + ' p-5 flex items-center justify-between hover:border-[#3a4f63] transition-colors group'}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[rgba(255,138,30,0.14)] flex items-center justify-center shrink-0">
                <Inbox className="w-4 h-4 text-[color:var(--accent)]" />
              </div>
              <div>
                <p className="text-sm font-bold">Join Requests</p>
                <p className="text-[12px] text-[color:var(--text-dim)]">{data.stats.pending_joins} pending</p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-[color:var(--text-faint)] group-hover:text-[color:var(--accent-bright)] transition-colors" />
          </Link>
          <Link href="/academy/add-players" className={CARD_CLS + ' p-5 flex items-center justify-between hover:border-[#3a4f63] transition-colors group'}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[rgba(255,138,30,0.14)] flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-[color:var(--accent)]" />
              </div>
              <div>
                <p className="text-sm font-bold">Add Players</p>
                <p className="text-[12px] text-[color:var(--text-dim)]">CSV, manual, or invite link</p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-[color:var(--text-faint)] group-hover:text-[color:var(--accent-bright)] transition-colors" />
          </Link>
        </div>
      </div>
    </AcademyShell>
  )
}
