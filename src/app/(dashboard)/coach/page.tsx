'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  BookOpen, CheckCircle2, AlertTriangle, Send,
  Loader2, Users, Award,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { dbRoleMap } from '@/lib/mock-performance-seed'
import { RingGauge } from '@/components/ui/ring-gauge'

// Second restyle pass (docs request, 2026-09-10) — a table with flagged
// players pinned to the top + pagination, matching the new mockup set,
// still inside the existing DashboardShell/chrome.ts nav. The evaluation
// UI (EvalForm, rating buttons, note textarea, save) is untouched real
// logic — same POST /api/coach/[playerId]/evaluate route, now shown below
// the table when a row is clicked instead of inline per-card.
//
// The mockup's "PLAN INTERVENTION SESSIONS" button is real functionality
// reused under a new label: it's the same jumpToFirstNeedingEval() that
// scrolls to and opens the first unassessed player's evaluation form —
// there's no separate "intervention session" concept anywhere in the
// schema to build a new feature around.
//
// The "average roster score, last 8 weeks" sparkline + delta is real —
// PlayerWeek.rolling_4week_average aggregated across the roster per
// week_start via GET /api/coach/squad's `trend`/`trendDelta`. This pass
// also uses that same trend data's most recent week as a real "last full
// roster review" date, replacing what would otherwise be an invented
// audit-log timestamp.

interface CoachPlayer {
  id: string
  name: string
  age: number
  district: string
  playing_role: string
  fitness_rating?: number
  behaviour_rating?: number
  coach_note?: string
  flag: 'on_form' | 'form_drop' | 'skill_below_threshold' | 'none'
  athlasx_score: number
}

function EvalForm({ player, onSave }: {
  player: CoachPlayer
  onSave: (data: { fitness?: number; behaviour?: number; note: string }) => Promise<void>
}) {
  const [fitness, setFitness]     = useState<number | undefined>(player.fitness_rating)
  const [behaviour, setBehaviour] = useState<number | undefined>(player.behaviour_rating)
  const [note, setNote]           = useState(player.coach_note ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handle() {
    setSaving(true)
    await onSave({ fitness, behaviour, note })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function RatingRow({ label, value, onChange, caption }: { label: string; value?: number; onChange: (v: number) => void; caption: string }) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-ax-textDim">{label}</p>
          <span className="text-[10px] text-ax-textFaint">{caption}</span>
        </div>
        <div role="radiogroup" aria-label={label} className="flex items-center gap-2">
          {[1,2,3,4,5].map(n => (
            <button
              key={n}
              role="radio"
              aria-checked={value === n}
              onClick={() => onChange(n)}
              className={cn(
                'flex-1 h-9 rounded-ax-md text-sm font-black border transition-all',
                value === n ? 'bg-[rgba(255,138,30,0.18)] border-ax-accent text-ax-accentBright' : 'bg-white/[0.03] border-ax-cardBorder text-ax-textFaint hover:text-ax-text hover:border-white/[0.14]'
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4 rounded-ax-xl border border-ax-cardBorder bg-white/[0.02]">
      <p className="text-[10px] font-bold text-ax-textFaint uppercase tracking-widest">Supervised Evaluation · {player.name}</p>

      <RatingRow label="Fitness (1–5)" value={fitness} onChange={setFitness} caption="Coach-supervised only. Enters AthlasX score." />
      <RatingRow label="Behaviour (1–5)" value={behaviour} onChange={setBehaviour} caption="Based on direct observation. Coach-only access." />

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-ax-textDim">Coach Note</p>
          <span className="text-[9px] text-ax-textFaint">Advisory · 200 char · Visible to selectors in deep view</span>
        </div>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value.slice(0, 200))}
          placeholder="Brief advisory note for selectors…"
          rows={3}
          className="w-full bg-white/[0.03] border border-ax-cardBorder rounded-ax-md px-3 py-2.5 text-sm text-ax-text placeholder:text-ax-textFaint focus:outline-none focus:border-ax-accent/50 resize-none"
        />
        <div className="flex justify-between text-[9px] text-ax-textFaint">
          <span>Selectors see this note and the advisory flag — not raw evaluations</span>
          <span className={note.length >= 200 ? 'text-ax-bad font-bold' : note.length >= 180 ? 'text-ax-accentBright' : ''}>{note.length}/200</span>
        </div>
      </div>

      <Button onClick={handle} disabled={saving} variant="primary" className="w-full">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Send className="w-4 h-4" />}
        {saving ? 'Saving…' : saved ? 'Saved to server' : 'Save Evaluation'}
      </Button>
    </div>
  )
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const w = 120, h = 36
  const min = Math.min(...values), max = Math.max(...values)
  const range = max - min || 1
  const points = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <polyline points={points} fill="none" stroke="rgb(52,211,153)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function StatTile({ icon: Icon, value, label, tint }: { icon: typeof Users; value: string | number; label: string; tint?: string }) {
  return (
    <div className="rounded-ax-md border border-ax-cardBorder bg-ax-bgSoft p-4">
      <div className={cn('w-[34px] h-[34px] rounded-full flex items-center justify-center', tint ?? 'bg-[rgba(255,138,30,0.08)]')}>
        <Icon className="w-4 h-4 text-ax-accentBright" />
      </div>
      <div className="font-anton text-2xl text-ax-text mt-3">{value}</div>
      <p className="font-barlow-semi text-[10.5px] font-bold uppercase tracking-[0.1em] text-ax-textDim mt-0.5">{label}</p>
    </div>
  )
}

const flagBadge: Record<CoachPlayer['flag'], { label: string; cls: string } | null> = {
  form_drop: { label: 'Form drop', cls: 'bg-[rgba(255,138,30,0.1)] border-[rgba(255,138,30,0.2)] text-ax-accentBright' },
  skill_below_threshold: { label: 'Below threshold', cls: 'bg-[rgba(255,90,77,0.1)] border-[rgba(255,90,77,0.2)] text-ax-bad' },
  on_form: { label: 'On form', cls: 'bg-[rgba(56,211,159,0.1)] border-[rgba(56,211,159,0.2)] text-ax-ok' },
  none: null,
}

const PAGE_SIZE = 12

export default function CoachPage() {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [squad, setSquad] = useState<CoachPlayer[]>([])
  const [trend, setTrend] = useState<{ week: string; avgScore: number }[]>([])
  const [trendDelta, setTrendDelta] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({})
  const evalRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    fetch('/api/coach/squad').then(r => r.json()).then(data => {
      setSquad(data.squad ?? [])
      setTrend(data.trend ?? [])
      setTrendDelta(data.trendDelta ?? null)
      setLoading(false)
    })
  }, [])

  const needsEval  = squad.filter(p => !p.fitness_rating).length
  const flaggedNames = useMemo(() => ({
    formDrop: squad.filter(p => p.flag === 'form_drop').map(p => p.name),
    belowThreshold: squad.filter(p => p.flag === 'skill_below_threshold').map(p => p.name),
  }), [squad])

  // Every number here is derived from the real squad array.
  const stats = useMemo(() => {
    const onForm = squad.filter(p => p.flag === 'on_form').length
    const formDrop = squad.filter(p => p.flag === 'form_drop').length
    const belowThreshold = squad.filter(p => p.flag === 'skill_below_threshold').length
    const noFlag = squad.length - formDrop - belowThreshold
    const avgScore = squad.length ? squad.reduce((sum, p) => sum + p.athlasx_score, 0) / squad.length : null
    return { onForm, formDrop, belowThreshold, noFlag, avgScore }
  }, [squad])

  // Flagged players pinned to the top (matches the mockup's "flagged
  // first" ordering), then the rest by score descending — same real
  // fields, just a display order.
  const sortedSquad = useMemo(() => {
    const rank = (p: CoachPlayer) => (p.flag === 'form_drop' || p.flag === 'skill_below_threshold' ? 0 : 1)
    return [...squad].sort((a, b) => rank(a) - rank(b) || b.athlasx_score - a.athlasx_score)
  }, [squad])

  const pageCount = Math.max(1, Math.ceil(sortedSquad.length / PAGE_SIZE))
  const pageRows = sortedSquad.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const lastReviewWeek = trend.length ? trend[trend.length - 1].week : null

  function jumpToFirstNeedingEval() {
    const first = squad.find(p => !p.fitness_rating)
    if (!first) return
    const idx = sortedSquad.findIndex(p => p.id === first.id)
    setPage(idx >= 0 ? Math.floor(idx / PAGE_SIZE) : 0)
    setActiveId(first.id)
    requestAnimationFrame(() => {
      rowRefs.current[first.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  function selectPlayer(id: string) {
    setActiveId(prev => (prev === id ? null : id))
    requestAnimationFrame(() => evalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  async function handleSave(id: string, data: { fitness?: number; behaviour?: number; note: string }) {
    const res = await fetch(`/api/coach/${id}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      setSquad(prev => prev.map(p => p.id === id ? { ...p, fitness_rating: data.fitness, behaviour_rating: data.behaviour, coach_note: data.note } : p))
    }
  }

  const activePlayer = squad.find(p => p.id === activeId) ?? null

  return (
    <div className="space-y-6 max-w-[1300px] font-barlow">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <p className="font-barlow-semi text-[11px] font-bold uppercase tracking-[0.18em] text-ax-accentBright">Coach dashboard</p>
        <h1 className="font-anton uppercase text-2xl sm:text-[30px] text-ax-text mt-1">My Roster</h1>
      </motion.div>

      {/* Hero */}
      <div
        className="rounded-ax-lg border border-ax-cardBorder p-6 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-6"
        style={{ background: 'linear-gradient(120deg, rgba(255,138,30,0.08), var(--ax-bg-soft) 55%)' }}
      >
        <div className="flex items-center gap-5 min-w-0">
          <RingGauge value={squad.length} max={Math.max(squad.length, 1)} label={squad.length} sublabel="Roster" />
          <div className="min-w-0">
            <p className="font-barlow-semi text-[11px] font-bold uppercase tracking-[0.18em] text-ax-accentBright">Roster health · AthlasX roster average {stats.avgScore != null ? stats.avgScore.toFixed(1) : '—'}</p>
            <h2 className="font-anton uppercase text-xl sm:text-2xl text-ax-text mt-1.5 leading-tight">
              {needsEval > 0
                ? `${needsEval} player${needsEval === 1 ? '' : 's'} need${needsEval === 1 ? 's' : ''} attention this week`
                : 'No players need attention this week'}
            </h2>
            <p className="text-[13.5px] text-ax-textDim mt-2.5 leading-relaxed max-w-lg">
              {stats.formDrop > 0 && <>{stats.formDrop} form drop{stats.formDrop === 1 ? '' : 's'} ({flaggedNames.formDrop.join(', ')})</>}
              {stats.formDrop > 0 && stats.belowThreshold > 0 && ' · '}
              {stats.belowThreshold > 0 && <>{stats.belowThreshold} below skill threshold ({flaggedNames.belowThreshold.join(', ')})</>}
              {stats.formDrop === 0 && stats.belowThreshold === 0 && 'No flagged players right now.'}
              {' · '}{stats.onForm} player{stats.onForm === 1 ? '' : 's'} on form
              {lastReviewWeek && <> · last roster review {new Date(lastReviewWeek).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</>}.
            </p>
          </div>
        </div>
        {needsEval > 0 && (
          <button
            type="button"
            onClick={jumpToFirstNeedingEval}
            className="shrink-0 font-barlow-semi text-[12.5px] font-bold uppercase tracking-[0.06em] bg-ax-accent text-[#1a0e02] px-[18px] py-[11px] rounded-ax-md hover:bg-ax-accentBright transition-colors"
          >
            Plan Intervention Sessions
          </button>
        )}
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile icon={Users} value={squad.length} label="Roster size" />
        <StatTile icon={AlertTriangle} value={needsEval} label="Needs attention" tint="bg-[rgba(255,90,77,0.1)]" />
        <StatTile icon={CheckCircle2} value={stats.onForm} label="On form" tint="bg-[rgba(56,211,159,0.1)]" />
        <StatTile icon={Award} value={stats.avgScore != null ? stats.avgScore.toFixed(1) : '—'} label="Average score" />
      </div>

      {/* KPI row */}
      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4">
        <div className="rounded-ax-lg border border-ax-cardBorder bg-ax-bgSoft p-5 sm:p-6 flex items-center justify-between gap-4">
          <div>
            <p className="font-barlow-semi text-[10.5px] font-bold uppercase tracking-[0.12em] text-ax-textDim">Average roster score, last 8 weeks</p>
            <div className="font-anton text-4xl sm:text-[52px] text-ax-text leading-none mt-2">
              {stats.avgScore != null ? stats.avgScore.toFixed(1) : '—'}
            </div>
            {trendDelta !== null && (
              <p className={cn('text-[11px] font-bold mt-1.5', trendDelta > 0 ? 'text-ax-ok' : trendDelta < 0 ? 'text-ax-bad' : 'text-ax-textFaint')}>
                {trendDelta > 0 ? '↑' : trendDelta < 0 ? '↓' : '—'} {Math.abs(trendDelta)} vs 8 weeks ago
              </p>
            )}
          </div>
          <Sparkline values={trend.map(t => t.avgScore)} />
        </div>
        <div className="rounded-ax-lg border border-ax-cardBorder bg-ax-bgSoft p-5 sm:p-6">
          <p className="font-barlow-semi text-[10.5px] font-bold uppercase tracking-[0.12em] text-ax-textDim">Roster flag breakdown</p>
          {squad.length > 0 ? (
            <>
              <div className="flex h-3.5 rounded-ax-sm overflow-hidden mt-4 bg-white/[0.03]">
                {stats.noFlag > 0 && <div className="bg-white/[0.14]" style={{ width: `${(stats.noFlag / squad.length) * 100}%` }} />}
                {stats.formDrop > 0 && <div className="bg-[rgba(255,138,30,0.22)]" style={{ width: `${(stats.formDrop / squad.length) * 100}%` }} />}
                {stats.belowThreshold > 0 && <div className="bg-ax-bad" style={{ width: `${(stats.belowThreshold / squad.length) * 100}%` }} />}
              </div>
              <div className="flex justify-between mt-2.5 text-[10.5px] font-barlow-semi font-bold uppercase tracking-wide">
                <span className="text-ax-textFaint">None ({stats.noFlag})</span>
                <span className="text-ax-accentBright">Form drop ({stats.formDrop})</span>
                <span className="text-ax-bad">Below threshold ({stats.belowThreshold})</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-ax-textFaint mt-3">No squad found.</p>
          )}
        </div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}
        className="flex items-start gap-3 p-4 rounded-ax-xl border border-[rgba(255,138,30,0.2)] bg-[rgba(255,138,30,0.08)]">
        <BookOpen className="w-4 h-4 text-ax-accentBright mt-0.5 shrink-0" />
        <div className="space-y-0.5">
          <p className="text-xs font-bold text-ax-accentBright">Evaluation policy</p>
          <p className="text-xs text-ax-textFaint">Fitness and behaviour ratings are coach-supervised only — never from player self-report. A rating of zero means not yet assessed, not a penalty. Raw evaluations are coach-only; selectors see only the advisory note.</p>
        </div>
      </motion.div>

      {/* Player roster table */}
      <div className="rounded-ax-lg border border-ax-cardBorder bg-ax-bgSoft overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-ax-cardBorder">
          <div>
            <p className="text-sm font-bold text-ax-text">Player Roster</p>
            <p className="text-[11px] text-ax-textFaint">Flagged players pinned to top · sorted by status then score</p>
          </div>
        </div>

        {loading ? (
          <div className="p-10 flex items-center justify-center text-ax-textFaint"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : squad.length === 0 ? (
          <div className="p-8 flex flex-col items-center justify-center text-center">
            <Users className="w-8 h-8 text-ax-textFaint mb-3" />
            <p className="text-sm font-bold text-ax-textDim">No squad found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10.5px] font-barlow-semi font-bold uppercase tracking-[0.1em] text-ax-textDim border-b border-ax-cardBorder">
                    <th className="px-5 sm:px-6 py-3 font-bold">Player name</th>
                    <th className="px-3 py-3 font-bold">Age</th>
                    <th className="px-3 py-3 font-bold hidden md:table-cell">District</th>
                    <th className="px-3 py-3 font-bold hidden md:table-cell">Playing role</th>
                    <th className="px-3 py-3 font-bold">Flag</th>
                    <th className="px-5 sm:px-6 py-3 font-bold text-right">AthlasX score</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((p) => {
                    const badge = flagBadge[p.flag]
                    const isActive = activeId === p.id
                    return (
                      <tr
                        key={p.id}
                        ref={(el) => { rowRefs.current[p.id] = el }}
                        onClick={() => selectPlayer(p.id)}
                        className={cn('border-b border-ax-cardBorder last:border-b-0 cursor-pointer hover:bg-white/[0.02] transition-colors', isActive && 'bg-white/[0.03]', p.flag !== 'none' && p.flag !== 'on_form' && 'bg-[rgba(255,90,77,0.03)]')}
                      >
                        <td className="px-5 sm:px-6 py-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {badge && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', p.flag === 'on_form' ? 'bg-ax-ok' : p.flag === 'form_drop' ? 'bg-ax-accentBright' : 'bg-ax-bad')} />}
                            <div className="w-8 h-8 rounded-ax-md bg-[rgba(255,138,30,0.14)] border border-ax-cardBorder flex items-center justify-center text-[11px] font-black text-ax-accentBright shrink-0">
                              {p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                            <span className="text-sm font-bold text-ax-text truncate">{p.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm text-ax-textDim">{p.age}</td>
                        <td className="px-3 py-3 text-sm text-ax-textDim hidden md:table-cell">{p.district}</td>
                        <td className="px-3 py-3 text-sm text-ax-textDim hidden md:table-cell">{dbRoleMap[p.playing_role] ?? p.playing_role.replace(/_/g, ' ')}</td>
                        <td className="px-3 py-3">
                          {badge ? (
                            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-ax-sm border uppercase tracking-wide', badge.cls)}>{badge.label}</span>
                          ) : (
                            <span className="text-[10px] text-ax-textFaint">None</span>
                          )}
                        </td>
                        <td className="px-5 sm:px-6 py-3 text-right">
                          <span className="font-anton text-base text-ax-text">{p.athlasx_score}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-3.5 border-t border-ax-cardBorder text-[11px] text-ax-textFaint">
              <span>Showing {page * PAGE_SIZE + 1}–{Math.min(sortedSquad.length, (page + 1) * PAGE_SIZE)} of {sortedSquad.length} roster players</span>
              <div className="flex items-center gap-1.5">
                <button type="button" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))} className="h-7 px-2.5 rounded-ax-sm border border-ax-cardBorder text-ax-textDim disabled:opacity-30 hover:text-ax-text hover:border-white/[0.24] transition-colors">Prev</button>
                <span className="px-2 text-ax-textDim">{page + 1} / {pageCount}</span>
                <button type="button" disabled={page >= pageCount - 1} onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} className="h-7 px-2.5 rounded-ax-sm border border-ax-cardBorder text-ax-textDim disabled:opacity-30 hover:text-ax-text hover:border-white/[0.24] transition-colors">Next</button>
              </div>
            </div>
          </>
        )}
      </div>

      {activePlayer && (
        <motion.div ref={evalRef} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
          <EvalForm player={activePlayer} onSave={data => handleSave(activePlayer.id, data)} />
        </motion.div>
      )}
    </div>
  )
}
