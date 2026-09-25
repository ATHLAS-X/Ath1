'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingUp, TrendingDown,
  ChevronRight, X, Eye, MessageSquare,
  Zap, AlertTriangle, Loader2, Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FlagType } from '@/types'

interface WeekEntry {
  week: string
  runs?: number
  wickets?: number
  score: number
}

interface TrackedPlayer {
  id: string
  name: string
  district: string
  playing_role: string
  flag: FlagType
  athlasx_score: number
  score_delta: number
  consecutive_declines?: number
  coach_note?: string
  skill_dimension?: string
  trend: WeekEntry[]
}

const flagConfig: Record<FlagType, { icon: string; label: string; color: string; bg: string; border: string }> = {
  on_form:              { icon: '🟢', label: 'On form',    color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
  form_drop:            { icon: '🔴', label: 'Form drop',  color: 'text-red-400',   bg: 'bg-red-500/10',   border: 'border-red-500/20'   },
  skill_below_threshold:{ icon: '🟡', label: 'Below threshold', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  none:                 { icon: '⚪', label: 'Stable',     color: 'text-zinc-400',  bg: 'bg-white/[0.03]', border: 'border-white/[0.06]'  },
}

function Sparkline({ data }: { data: WeekEntry[] }) {
  if (data.length < 2) return <svg width={120} height={36} />
  const scores = data.map(d => d.score)
  const min = Math.min(...scores) - 5
  const max = Math.max(...scores) + 5
  const range = max - min || 1
  const w = 120, h = 36, pad = 4

  const points = scores.map((s, i) => {
    const x = pad + (i / (scores.length - 1)) * (w - pad * 2)
    const y = h - pad - ((s - min) / range) * (h - pad * 2)
    return `${x},${y}`
  }).join(' ')

  const going = scores[scores.length - 1] > scores[0]
  const color = going ? '#22c55e' : '#f87171'

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {scores.map((s, i) => {
        const x = pad + (i / (scores.length - 1)) * (w - pad * 2)
        const y = h - pad - ((s - min) / range) * (h - pad * 2)
        return i === scores.length - 1 ? <circle key={i} cx={x} cy={y} r="3" fill={color} /> : null
      })}
    </svg>
  )
}

/* ─── Selector Deep View (W5) ────────────────────────────────────────────────── */
function DeepView({ player, onClose }: { player: TrackedPlayer; onClose: () => void }) {
  const flagCfg = flagConfig[player.flag]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-end p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md h-full max-h-[90vh] bg-[#0d0d0d] border border-white/[0.08] rounded-2xl shadow-2xl overflow-y-auto"
      >
        <div className="sticky top-0 bg-[#0d0d0d] flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div>
            <h2 className="text-sm font-black text-white">{player.name}</h2>
            <p className="text-[10px] text-zinc-600">{player.district} · {player.playing_role}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-zinc-500 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          <div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Flag Panel</p>
            <div className={cn('flex items-center gap-3 p-4 rounded-2xl border', flagCfg.bg, flagCfg.border)}>
              <span className="text-2xl">{flagCfg.icon}</span>
              <div>
                <p className={cn('text-sm font-black', flagCfg.color)}>{flagCfg.label}</p>
                {player.flag === 'form_drop' && player.consecutive_declines && (
                  <p className="text-xs text-red-300/70 mt-0.5">{player.consecutive_declines} consecutive declining weeks · {player.skill_dimension}</p>
                )}
                {player.flag === 'on_form' && (
                  <p className="text-xs text-green-300/70 mt-0.5">Performance trending upward over last {player.trend.length} weeks</p>
                )}
              </div>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">AthlasX Score Trend</p>
            <div className="p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
              <div className="flex items-end justify-between mb-3">
                <div>
                  <p className="text-3xl font-black text-white tabular-nums">{Math.round(player.athlasx_score)}</p>
                  <div className={cn('flex items-center gap-1 text-xs font-bold mt-0.5', player.score_delta >= 0 ? 'text-green-400' : 'text-red-400')}>
                    {player.score_delta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {player.score_delta >= 0 ? '+' : ''}{player.score_delta} this period
                  </div>
                </div>
                <Sparkline data={player.trend} />
              </div>
              <div className="grid grid-cols-4 gap-2 border-t border-white/[0.05] pt-3">
                {player.trend.map((w, i) => (
                  <div key={i} className="text-center">
                    <p className="text-xs font-black text-white tabular-nums">{Math.round(w.score)}</p>
                    <p className="text-[9px] text-zinc-700">{w.week}</p>
                    {w.runs !== undefined && <p className="text-[9px] text-zinc-600">{w.runs}r</p>}
                    {w.wickets !== undefined && <p className="text-[9px] text-zinc-600">{w.wickets}w</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Coach Note</p>
              <span className="text-[9px] text-zinc-700">Advisory only · 200 char max</span>
            </div>
            <div className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] min-h-[72px]">
              {player.coach_note ? (
                <p className="text-xs text-zinc-400 leading-relaxed">{player.coach_note}</p>
              ) : (
                <p className="text-xs text-zinc-700 italic">No coach note yet</p>
              )}
            </div>
            <p className="text-[9px] text-zinc-700 mt-1.5">Note is advisory and does not affect the AthlasX score. Raw coach evaluations are coach-only.</p>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <Zap className="w-3 h-3 text-zinc-600 mt-0.5 shrink-0" />
            <p className="text-[9px] text-zinc-600 leading-relaxed">
              Selector deep view shows flag, score trend, and coach note. Raw MCQ psych assessments and detailed coach evaluations are coach-only access.
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */
export default function TrackingPage() {
  const [players, setPlayers] = useState<TrackedPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [activePlayer, setActivePlayer] = useState<TrackedPlayer | null>(null)
  const [filterFlag, setFilterFlag] = useState<FlagType | 'all'>('all')

  useEffect(() => {
    fetch('/api/tracking').then(r => r.json()).then(data => {
      setPlayers(data.players ?? [])
      setLoading(false)
    })
  }, [])

  const flagCounts = {
    form_drop: players.filter(p => p.flag === 'form_drop').length,
    on_form:   players.filter(p => p.flag === 'on_form').length,
    none:      players.filter(p => p.flag === 'none').length,
  }

  const filtered = filterFlag === 'all' ? players : players.filter(p => p.flag === filterFlag)

  return (
    <div className="space-y-6 max-w-[1100px]">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-anton uppercase text-xl text-ax-text">Weekly Tracking</h1>
          <p className="text-xs text-zinc-600 mt-0.5">W5 · In-season performance monitoring</p>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-bold">
            🔴 {flagCounts.form_drop} form drop{flagCounts.form_drop !== 1 ? 's' : ''}
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 font-bold">
            🟢 {flagCounts.on_form} on form
          </div>
        </div>
      </motion.div>

      {loading ? (
        <div className="glass-card p-10 flex items-center justify-center text-zinc-600"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : players.length === 0 ? (
        <div className="glass-card p-8 flex flex-col items-center justify-center text-center">
          <Activity className="w-8 h-8 text-zinc-700 mb-3" />
          <p className="text-sm font-bold text-zinc-500">No tracked players yet</p>
        </div>
      ) : (
        <>
          {players.filter(p => p.flag === 'form_drop').map(p => (
            <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-3 p-4 rounded-2xl border border-red-500/15 bg-red-500/6">
              <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold text-red-300">{p.name} — {p.consecutive_declines} consecutive declining weeks</p>
                <p className="text-xs text-red-300/70 mt-0.5">{p.skill_dimension} below threshold · {p.district}</p>
              </div>
              <button
                onClick={() => setActivePlayer(p)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/15 border border-red-500/25 text-red-300 text-xs font-bold hover:bg-red-500/25 transition-colors"
              >
                <Eye className="w-3 h-3" />
                Deep view
              </button>
            </motion.div>
          ))}

          <div className="flex items-center gap-1.5">
            {([
              { key: 'all',      label: 'All players' },
              { key: 'form_drop',label: '🔴 Form drop' },
              { key: 'on_form',  label: '🟢 On form' },
              { key: 'none',     label: '⚪ Stable' },
            ] as const).map(f => (
              <button
                key={f.key}
                onClick={() => setFilterFlag(f.key)}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors',
                  filterFlag === f.key ? 'bg-white/[0.06] border-white/[0.12] text-white' : 'bg-white/[0.02] border-white/[0.06] text-zinc-500 hover:text-zinc-300'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {filtered.map((p, i) => {
              const flagCfg = flagConfig[p.flag]
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 + i * 0.05 }}
                  className="glass-card p-4"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-xl shrink-0">{flagCfg.icon}</span>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white">{p.name}</p>
                      <p className="text-[11px] text-zinc-600">{p.district} · {p.playing_role}</p>
                    </div>

                    <div className="hidden sm:block shrink-0">
                      <Sparkline data={p.trend} />
                    </div>

                    <div className="text-right shrink-0 w-20">
                      <p className="text-xl font-black text-white tabular-nums">{Math.round(p.athlasx_score)}</p>
                      <div className={cn('flex items-center justify-end gap-0.5 text-xs font-bold', p.score_delta >= 0 ? 'text-green-400' : 'text-red-400')}>
                        {p.score_delta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {p.score_delta >= 0 ? '+' : ''}{p.score_delta}
                      </div>
                    </div>

                    {p.coach_note && (
                      <div className="shrink-0">
                        <MessageSquare className="w-3.5 h-3.5 text-zinc-600" />
                      </div>
                    )}

                    <button
                      onClick={() => setActivePlayer(p)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs font-semibold text-zinc-400 hover:text-white transition-colors shrink-0"
                    >
                      <Eye className="w-3 h-3" />
                      View
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </>
      )}

      <AnimatePresence>
        {activePlayer && <DeepView player={activePlayer} onClose={() => setActivePlayer(null)} />}
      </AnimatePresence>
    </div>
  )
}
