'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2, Users, MapPin, Award, ShieldOff, ShieldAlert } from 'lucide-react'
import { RingGauge } from '@/components/ui/ring-gauge'

// Scout's real home page (src/lib/chrome.ts's ROLE_HOME['scout']).
// Read-only by design: no contact/message affordance anywhere on this
// page. The pivot doc's explicit non-goal ("no independent-scout
// marketplace, no direct scout-to-player contact") is still an open,
// unconfirmed-reversed decision per docs/AthlasX_Engagement_Context_Summary.md
// — and PlayerProfile has no player-owned contact field to expose even if
// it weren't (guardian_phone belongs to a guardian, not the player).
// Anything beyond "browse verified playing profiles" needs that decision
// made explicitly first, not assumed here.
//
// Second restyle pass (docs request, 2026-09-10) — a richer "Talent Pool"
// table/filters layout replacing the first pass's simple list, still
// inside the existing DashboardShell/chrome.ts nav (not a new shell). The
// per-candidate "score this week" sparkline from the source mockup is
// still NOT reproduced: athlasx_score is a single current value, no
// history table backs a trend for any one candidate — confirmed with the
// user this pass, kept dropped by their choice rather than adding a new
// schema table for it.
const ABOVE_THRESHOLD = 65

interface ScoutCandidate {
  id: string
  name: string
  age: number
  district: string
  state: string
  playing_role: string | null
  batting_style: string | null
  bowling_style: string | null
  academy: string | null
  athlasx_score: number | null
  avatar_url: string | null
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '—'
}

const PAGE_SIZE = 8

export default function ScoutPage() {
  const [candidates, setCandidates] = useState<ScoutCandidate[] | null>(null)
  const [error, setError] = useState('')

  const [districtFilter, setDistrictFilter] = useState('all')
  const [stateFilter, setStateFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [aboveThresholdOnly, setAboveThresholdOnly] = useState(false)
  const [page, setPage] = useState(0)

  useEffect(() => {
    fetch('/api/scout/candidates')
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Failed to load candidates')
        setCandidates(d.candidates ?? [])
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load candidates'))
  }, [])

  // Every number below is derived from the real candidates array — none of
  // it is a placeholder. With few candidates (true today, pre-launch) the
  // numbers are just small and honest, not padded to look fuller.
  const stats = useMemo(() => {
    const list = candidates ?? []
    const districts = new Set(list.map((c) => c.district).filter(Boolean))
    const states = new Set(list.map((c) => c.state).filter(Boolean))
    const academies = new Set(list.map((c) => c.academy).filter(Boolean))
    const scored = list.filter((c) => c.athlasx_score != null) as (ScoutCandidate & { athlasx_score: number })[]
    const avgScore = scored.length ? scored.reduce((sum, c) => sum + c.athlasx_score, 0) / scored.length : null
    const aboveThreshold = scored.filter((c) => c.athlasx_score >= ABOVE_THRESHOLD).length
    const buckets = {
      b0_39: scored.filter((c) => c.athlasx_score < 40).length,
      b40_64: scored.filter((c) => c.athlasx_score >= 40 && c.athlasx_score < 65).length,
      b65_79: scored.filter((c) => c.athlasx_score >= 65 && c.athlasx_score < 80).length,
      b80: scored.filter((c) => c.athlasx_score >= 80).length,
    }
    return { total: list.length, districts: districts.size, states: states.size, academies: academies.size, avgScore, scoredCount: scored.length, aboveThreshold, buckets }
  }, [candidates])

  const districtOptions = useMemo(() => Array.from(new Set((candidates ?? []).map((c) => c.district).filter(Boolean))).sort(), [candidates])
  const stateOptions = useMemo(() => Array.from(new Set((candidates ?? []).map((c) => c.state).filter(Boolean))).sort(), [candidates])
  const roleOptions = useMemo(() => Array.from(new Set((candidates ?? []).map((c) => c.playing_role).filter(Boolean))) as string[], [candidates])

  const filtered = useMemo(() => {
    return (candidates ?? []).filter((c) => {
      if (districtFilter !== 'all' && c.district !== districtFilter) return false
      if (stateFilter !== 'all' && c.state !== stateFilter) return false
      if (roleFilter !== 'all' && c.playing_role !== roleFilter) return false
      if (aboveThresholdOnly && (c.athlasx_score ?? 0) < ABOVE_THRESHOLD) return false
      return true
    })
  }, [candidates, districtFilter, stateFilter, roleFilter, aboveThresholdOnly])

  useEffect(() => { setPage(0) }, [districtFilter, stateFilter, roleFilter, aboveThresholdOnly])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const selectCls = 'h-9 px-3 rounded-ax-sm bg-white/[0.03] border border-ax-cardBorder text-ax-text text-xs focus:outline-none focus:border-ax-accent'

  return (
    <div className="space-y-6 max-w-[1300px] font-barlow">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <p className="font-barlow-semi text-[11px] font-bold uppercase tracking-[0.18em] text-ax-accentBright">Scout dashboard</p>
        <h1 className="font-anton uppercase text-2xl sm:text-[30px] text-ax-text mt-1">Talent Pool</h1>
      </motion.div>

      {/* ScoutProfile.verification_status starts 'pending' on every scout
          account (src/app/api/scout/onboard/route.ts) and nothing in this
          codebase reads it to gate anything yet — no Ops approval surface
          exists for scouts the way ops/associations/pending/page.tsx exists
          for associations, so a scout account has no path to any other
          state today. This banner is the "no indication anywhere" gap
          flagged in docs/AthlasX_Onboarding_to_Dashboard_Routing_Master_Prompt.md
          — informational only, does not block or filter candidate data. */}
      <div className="flex items-start gap-3 p-4 rounded-ax-xl border border-[rgba(255,138,30,0.2)] bg-[rgba(255,138,30,0.08)]">
        <ShieldAlert className="w-4 h-4 text-ax-accentBright mt-0.5 shrink-0" />
        <p className="text-xs text-ax-accentBright">
          Your scout account is pending AthlasX Ops verification. You&apos;ll see full functionality once approved.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-ax-lg border border-ax-bad/30 bg-ax-bad/[0.08] text-ax-bad text-sm">
          <ShieldOff className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {!error && !candidates && (
        <div className="p-8 flex items-center justify-center text-ax-textDim">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      )}

      {candidates && (
        <>
          {/* Hero */}
          <div
            className="rounded-ax-lg border border-ax-cardBorder p-6 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-6"
            style={{ background: 'linear-gradient(120deg, rgba(255,138,30,0.08), var(--ax-bg-soft) 55%)' }}
          >
            <div className="flex items-center gap-5 min-w-0">
              <RingGauge value={stats.avgScore ?? 0} max={100} label={stats.avgScore != null ? stats.avgScore.toFixed(1) : '—'} sublabel="Pool avg" />
              <div className="min-w-0">
                <p className="font-barlow-semi text-[11px] font-bold uppercase tracking-[0.18em] text-ax-accentBright">Candidate pool overview</p>
                <h2 className="font-anton uppercase text-xl sm:text-2xl text-ax-text mt-1.5 leading-tight">
                  {stats.total} assessed candidate{stats.total === 1 ? '' : 's'}
                  {stats.districts > 0 && <> across {stats.districts} district{stats.districts === 1 ? '' : 's'}</>}
                  {stats.academies > 0 && <> &amp; {stats.academies} affiliated academ{stats.academies === 1 ? 'y' : 'ies'}</>}
                </h2>
                <p className="text-[13.5px] text-ax-textDim mt-2.5 leading-relaxed max-w-lg">
                  {stats.aboveThreshold} candidate{stats.aboveThreshold === 1 ? '' : 's'} sit at or above a {ABOVE_THRESHOLD} AthlasX score
                  {stats.avgScore != null && <> · the pool averages <span className="text-ax-accentBright font-semibold">{stats.avgScore.toFixed(1)}</span></>}. Filters cover district, state, role, and score — scouting is read-only by design.
                </p>
              </div>
            </div>
            {stats.scoredCount > 0 && (
              <div className="shrink-0 rounded-ax-md border border-ax-cardBorder bg-ax-bgSoft p-4 w-full lg:w-[260px]">
                <p className="font-barlow-semi text-[10.5px] font-bold uppercase tracking-[0.12em] text-ax-textDim mb-3">Score distribution</p>
                <div className="flex h-3 rounded-ax-sm overflow-hidden bg-white/[0.03]">
                  {stats.buckets.b0_39 > 0 && <div className="bg-white/[0.14]" style={{ width: `${(stats.buckets.b0_39 / stats.scoredCount) * 100}%` }} />}
                  {stats.buckets.b40_64 > 0 && <div className="bg-[rgba(255,138,30,0.22)]" style={{ width: `${(stats.buckets.b40_64 / stats.scoredCount) * 100}%` }} />}
                  {stats.buckets.b65_79 > 0 && <div className="bg-[rgba(255,138,30,0.5)]" style={{ width: `${(stats.buckets.b65_79 / stats.scoredCount) * 100}%` }} />}
                  {stats.buckets.b80 > 0 && <div className="bg-ax-accent" style={{ width: `${(stats.buckets.b80 / stats.scoredCount) * 100}%` }} />}
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-3 text-[10.5px] font-barlow-semi font-bold uppercase tracking-wide">
                  <span className="text-ax-textFaint">0–39 ({stats.buckets.b0_39})</span>
                  <span className="text-ax-accentBright/70">40–64 ({stats.buckets.b40_64})</span>
                  <span className="text-ax-accentBright">65–79 ({stats.buckets.b65_79})</span>
                  <span className="text-ax-accent">80+ ({stats.buckets.b80})</span>
                </div>
              </div>
            )}
          </div>

          {/* Stat tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile icon={Users} value={stats.total} label="Candidates" />
            <StatTile icon={Award} value={stats.avgScore != null ? stats.avgScore.toFixed(1) : '—'} label="Pool average" />
            <StatTile icon={Users} value={stats.aboveThreshold} label={`Above ${ABOVE_THRESHOLD} threshold`} />
            <StatTile icon={MapPin} value={stats.districts} label="Districts" />
          </div>

          {/* Candidates table */}
          <div className="rounded-ax-lg border border-ax-cardBorder bg-ax-bgSoft overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-ax-cardBorder">
              <div>
                <p className="text-sm font-bold text-ax-text">Candidates</p>
                <p className="text-[11px] text-ax-textFaint">Read-only scout view · no contact or messaging</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select className={selectCls} value={districtFilter} onChange={(e) => setDistrictFilter(e.target.value)}>
                  <option value="all">All districts</option>
                  {districtOptions.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <select className={selectCls} value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
                  <option value="all">All states</option>
                  {stateOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select className={selectCls} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                  <option value="all">All roles</option>
                  {roleOptions.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => setAboveThresholdOnly((v) => !v)}
                  className={`h-9 px-3 rounded-ax-sm border text-[11px] font-bold uppercase tracking-wide transition-colors ${aboveThresholdOnly ? 'bg-ax-accent text-[#1a0e02] border-ax-accent' : 'bg-white/[0.03] border-ax-cardBorder text-ax-textDim hover:text-ax-text'}`}
                >
                  Score ≥ {ABOVE_THRESHOLD}
                </button>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="p-8 text-sm text-ax-textFaint">
                {candidates.length === 0
                  ? 'No players are currently visible to scouts. Players opt into franchise-scout visibility themselves from their own profile settings.'
                  : 'No candidates match the current filters.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10.5px] font-barlow-semi font-bold uppercase tracking-[0.1em] text-ax-textDim border-b border-ax-cardBorder">
                      <th className="px-5 sm:px-6 py-3 font-bold">Candidate</th>
                      <th className="px-3 py-3 font-bold">Age</th>
                      <th className="px-3 py-3 font-bold">District</th>
                      <th className="px-3 py-3 font-bold">State</th>
                      <th className="px-3 py-3 font-bold hidden md:table-cell">Playing role</th>
                      <th className="px-3 py-3 font-bold hidden lg:table-cell">Batting style</th>
                      <th className="px-3 py-3 font-bold hidden lg:table-cell">Bowling style</th>
                      <th className="px-3 py-3 font-bold hidden md:table-cell">Academy</th>
                      <th className="px-5 sm:px-6 py-3 font-bold text-right">AthlasX</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((c) => (
                      <tr key={c.id} className="border-b border-ax-cardBorder last:border-b-0 hover:bg-white/[0.02]">
                        <td className="px-5 sm:px-6 py-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-[rgba(255,138,30,0.14)] border border-ax-accent/30 flex items-center justify-center font-barlow-semi font-bold text-ax-accentBright text-[11px] shrink-0">
                              {initialsFor(c.name)}
                            </div>
                            <span className="text-sm font-semibold text-ax-text truncate">{c.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm text-ax-textDim">{c.age}</td>
                        <td className="px-3 py-3 text-sm text-ax-textDim">{c.district}</td>
                        <td className="px-3 py-3 text-sm text-ax-textDim">{c.state}</td>
                        <td className="px-3 py-3 text-sm text-ax-textDim hidden md:table-cell">{c.playing_role?.replace(/_/g, ' ') ?? '—'}</td>
                        <td className="px-3 py-3 text-sm text-ax-textDim hidden lg:table-cell">{c.batting_style?.replace(/_/g, ' ') ?? '—'}</td>
                        <td className="px-3 py-3 text-sm text-ax-textDim hidden lg:table-cell">{c.bowling_style && c.bowling_style !== 'None' ? c.bowling_style.replace(/_/g, ' ') : '—'}</td>
                        <td className="px-3 py-3 text-sm text-ax-textDim hidden md:table-cell truncate max-w-[160px]">{c.academy ?? '—'}</td>
                        <td className="px-5 sm:px-6 py-3 text-right">
                          <span className="font-anton text-base text-ax-text">{c.athlasx_score != null ? c.athlasx_score.toFixed(1) : '—'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {filtered.length > 0 && (
              <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-3.5 border-t border-ax-cardBorder text-[11px] text-ax-textFaint">
                <span>Showing {page * PAGE_SIZE + 1}–{Math.min(filtered.length, (page + 1) * PAGE_SIZE)} of {filtered.length} candidates</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    className="h-7 px-2.5 rounded-ax-sm border border-ax-cardBorder text-ax-textDim disabled:opacity-30 hover:text-ax-text hover:border-white/[0.24] transition-colors"
                  >
                    Prev
                  </button>
                  <span className="px-2 text-ax-textDim">{page + 1} / {pageCount}</span>
                  <button
                    type="button"
                    disabled={page >= pageCount - 1}
                    onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                    className="h-7 px-2.5 rounded-ax-sm border border-ax-cardBorder text-ax-textDim disabled:opacity-30 hover:text-ax-text hover:border-white/[0.24] transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function StatTile({ icon: Icon, value, label }: { icon: typeof Users; value: string | number; label: string }) {
  return (
    <div className="rounded-ax-md border border-ax-cardBorder bg-ax-bgSoft p-4">
      <div className="w-[34px] h-[34px] rounded-full bg-[rgba(255,138,30,0.08)] flex items-center justify-center">
        <Icon className="w-4 h-4 text-ax-accentBright" />
      </div>
      <div className="font-anton text-2xl text-ax-text mt-3">{value}</div>
      <p className="font-barlow-semi text-[10.5px] font-bold uppercase tracking-[0.1em] text-ax-textDim mt-0.5">{label}</p>
    </div>
  )
}
