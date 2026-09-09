'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Users, LayoutGrid, Inbox, ArrowUpRight } from 'lucide-react'
import { AcademyShell, CARD_CLS, EYEBROW_CLS, H1_CLS } from './_theme'

/**
 * Academy-admin dashboard overview — adapted from design/import/AthlasX
 * Academy Admin Dashboard.html's KPI strip + batch/session column.
 *
 * The mockup's "Today's Sessions" and "Activity Feed" columns are driven by
 * a per-day generated session/attendance dataset (SESSIONS/ACTIVITY arrays
 * in its own inline script) that has no backing model here — AcademyBatch
 * only stores a *recurring* weekly schedule (schedule_days/schedule_time),
 * not individual session instances or attendance records, and no activity
 * log exists for academy-admin actions. Rather than fabricate that data,
 * this page shows the real recurring-schedule summary
 * (loadDashboardBatchSummary) instead of per-day sessions, and drops the
 * Activity Feed panel entirely.
 */

interface DashboardData {
  academy: { id: string; name: string }
  stats: { players: number; batches: number; pending_joins: number }
  batches: { id: string; name: string; age_group: string; player_count: number; schedule_label: string; next_session: string }[]
}

function Kpi({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className={CARD_CLS + ' p-4 flex flex-col gap-1.5'}>
      <span className="text-[12px] font-bold uppercase tracking-wide text-[color:var(--text-dim)]">{label}</span>
      <span className="font-[family-name:var(--font-mono-jb)] text-[26px] font-bold text-[color:var(--accent)] leading-none">{value}</span>
      {sub && <span className="text-[12px] font-semibold text-[color:var(--text-dim)]">{sub}</span>}
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

  return (
    <AcademyShell>
      <div className="max-w-[1200px] mx-auto p-6 sm:p-8 space-y-6">
        <div>
          <p className={EYEBROW_CLS}>
            Athlas<span className="text-[color:var(--accent)]">X</span> · Academy Admin
          </p>
          <h1 className={H1_CLS}>{data.academy.name}</h1>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Kpi label="Active Players" value={data.stats.players} />
          <Kpi label="Batches" value={data.stats.batches} />
          <Kpi label="Pending Join Requests" value={data.stats.pending_joins} sub={data.stats.pending_joins > 0 ? 'Needs review' : undefined} />
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <div className={CARD_CLS + ' lg:col-span-2 p-0 overflow-hidden'}>
            <div className="px-5 py-4 border-b border-[color:var(--line)] flex items-center justify-between">
              <h2 className="text-[15px] font-bold flex items-center gap-2"><LayoutGrid className="w-4 h-4 text-[color:var(--accent)]" /> Batches</h2>
              <span className="font-[family-name:var(--font-mono-jb)] text-[13px] text-[color:var(--text-dim)]">{data.batches.length}</span>
            </div>
            {data.batches.length === 0 ? (
              <p className="p-6 text-sm text-[color:var(--text-faint)]">No batches yet. Create one from the Players page to start assigning players.</p>
            ) : (
              <div>
                {data.batches.map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[color:var(--line)] last:border-b-0">
                    <div>
                      <p className="text-sm font-bold">{b.name}</p>
                      <p className="text-[12px] text-[color:var(--text-dim)] mt-0.5">{b.age_group} · {b.schedule_label}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-[family-name:var(--font-mono-jb)] text-sm text-[color:var(--text-dim)]">{b.player_count} players</p>
                      <p className="text-[12px] text-[color:var(--accent-bright)] font-semibold mt-0.5">{b.next_session}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
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
      </div>
    </AcademyShell>
  )
}
