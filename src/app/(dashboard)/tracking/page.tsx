'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity, TrendingUp, TrendingDown, Minus,
  Flag, ChevronRight, X, Eye, MessageSquare,
  Zap, AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FlagType } from '@/types'

/* ─── Mock weekly data ───────────────────────────────────────────────────────── */
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

const players: TrackedPlayer[] = [
  {
    id: 'p1', name: 'Arjun Sharma', district: 'Kanpur', playing_role: 'Batsman',
    flag: 'on_form', athlasx_score: 82, score_delta: +4, coach_note: undefined,
    trend: [
      { week: 'W1', runs: 34, score: 68 },
      { week: 'W2', runs: 67, score: 74 },
      { week: 'W3', runs: 52, score: 77 },
      { week: 'W4', runs: 89, score: 82 },
    ],
  },
  {
    id: 'p3', name: 'Dev Patel', district: 'Agra', playing_role: 'Bowler',
    flag: 'form_drop', athlasx_score: 65, score_delta: -8, consecutive_declines: 3,
    skill_dimension: 'Bowling economy', coach_note: 'Lost rhythm post-injury. Working on it.',
    trend: [
      { week: 'W1', wickets: 3, score: 73 },
      { week: 'W2', wickets: 2, score: 71 },
      { week: 'W3', wickets: 1, score: 68 },
      { week: 'W4', wickets: 0, score: 65 },
    ],
  },
  {
    id: 'p2', name: 'Rohan Verma', district: 'Lucknow', playing_role: 'All-rounder',
    flag: 'none', athlasx_score: 77, score_delta: +1,
    trend: [
      { week: 'W1', runs: 41, score: 74 },
      { week: 'W2', runs: 38, score: 75 },
      { week: 'W3', runs: 55, score: 76 },
      { week: 'W4', runs: 49, score: 77 },
    ],
  },
  {
    id: 'p7', name: 'Vivek Yadav', district: 'Lucknow', playing_role: 'Bowler',
    flag: 'form_drop', athlasx_score: 54, score_delta: -11, consecutive_declines: 4,
    skill_dimension: 'Wicket rate',
    trend: [
      { week: 'W1', wickets: 4, score: 65 },
      { week: 'W2', wickets: 2, score: 60 },
      { week: 'W3', wickets: 1, score: 57 },
      { week: 'W4', wickets: 0, score: 54 },
    ],
  },
]

const flagConfig: Record<FlagType, { icon: string; label: string; color: string; bg: string; border: string }> = {
  on_form:              { icon: '🟢', label: 'On form',    color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
  form_drop:            { icon: '🔴', label: 'Form drop',  color: 'text-red-400',   bg: 'bg-red-500/10',   border: 'border-red-500/20'   },
  skill_below_threshold:{ icon: '🟡', label: 'Below threshold', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  none:                 { icon: '⚪', label: 'Stable',     color: 'text-zinc-400',  bg: 'bg-white/[0.03]', border: 'border-white/[0.06]'  },
}

/* ─── Sparkline ───────────────────────────────────────────────────────────────── */
function Sparkline({ data }: { data: WeekEntry[] }) {
  const scores = data.map(d => d.score)
  const min = Math.min(...scores) - 5
  const max = Math.max(...scores) + 5
  const range = max - min
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
        return i === scores.length - 1 ? (
          <circle key={i} cx={x} cy={y} r="3" fill={color} />
        ) : null
      })}
    </svg>
  )
}

/* ─── Selector Deep View (W5) ────────────────────────────────────────────────── */
function DeepView({ player, onClose }: { player: TrackedPlayer; onClose: () => void }) {
  const [note, setNote] = useState(player.coach_note ?? '')
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
        {/* Header */}
        <div className="sticky top-0 bg-[#0d0d0d] flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div>
            <h2 className="text-sm font-black text-white">{player.name}</h2>
            <p className="text-[10px] text-zinc-600">{player.district} · {player.playing_role}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-zinc-500 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Flag panel */}
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
                  <p className="text-xs text-green-300/70 mt-0.5">Performance trending upward over last 4 weeks</p>
                )}
              </div>
            </div>
          </div>

          {/* Score trend by dimension */}
          <div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">AthlasX Score Trend</p>
            <div className="p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
              <div className="flex items-end justify-between mb-3">
                <div>
                  <p className="text-3xl font-black text-white tabular-nums">{player.athlasx_score}</p>
                  <div className={cn('flex items-center gap-1 text-xs font-bold mt-0.5', player.score_delta >= 0 ? 'text-green-400' : 'text-red-400')}>
                    {player.score_delta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {player.score_delta >= 0 ? '+' : ''}{player.score_delta} this month
                  </div>
                </div>
                <Sparkline data={player.trend} />
              </div>
              <div className="grid grid-cols-4 gap-2 border-t border-white/[0.05] pt-3">
                {player.trend.map((w, i) => (
                  <div key={i} className="text-center">
                    <p className="text-xs font-black text-white tabular-nums">{w.score}</p>
                    <p className="text-[9px] text-zinc-700">{w.week}</p>
                    {w.runs !== undefined && <p className="text-[9px] text-zinc-600">{w.runs}r</p>}
                    {w.wickets !== undefined && <p className="text-[9px] text-zinc-600">{w.wickets}w</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Coach note */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Coach Note</p>
              <span className="text-[9px] text-zinc-700">Advisory only · 200 char max</span>
            </div>
            <div className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] min-h-[72px]">
              {note ? (
                <p className="text-xs text-zinc-400 leading-relaxed">{note}</p>
              ) : (
                <p className="text-xs text-zinc-700 italic">No coach note yet</p>
              )}
            </div>
            <p className="text-[9px] text-zinc-700 mt-1.5">Note is advisory and does not affect the AthlasX score. Raw coach evaluations are coach-only.</p>
          </div>

          {/* AthlasX notice */}
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
  const [activePlayer, setActivePlayer] = useState<TrackedPlayer | null>(null)
  const [filterFlag, setFilterFlag] = useState<FlagType | 'all'>('all')

  const flagCounts = {
    form_drop: players.filter(p => p.flag === 'form_drop').length,
    on_form:   players.filter(p => p.flag === 'on_form').length,
    none:      players.filter(p => p.flag === 'none').length,
  }

  const filtered = filterFlag === 'all' ? players : players.filter(p => p.flag === filterFlag)

  return (
    <div className="space-y-6 max-w-[1100px]">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white">Weekly Tracking</h1>
          <p className="text-xs text-zinc-600 mt-0.5">W5 · In-season performance monitoring · Current squad</p>
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

      {/* Flag alerts */}
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

      {/* Filter */}
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
              filterFlag === f.key
                ? 'bg-white/[0.06] border-white/[0.12] text-white'
                : 'bg-white/[0.02] border-white/[0.06] text-zinc-500 hover:text-zinc-300'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Player cards */}
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
                {/* Flag */}
                <span className="text-xl shrink-0">{flagCfg.icon}</span>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">{p.name}</p>
                  <p className="text-[11px] text-zinc-600">{p.district} · {p.playing_role}</p>
                </div>

                {/* Sparkline */}
                <div className="hidden sm:block shrink-0">
                  <Sparkline data={p.trend} />
                </div>

                {/* Score + delta */}
                <div className="text-right shrink-0 w-20">
                  <p className="text-xl font-black text-white tabular-nums">{p.athlasx_score}</p>
                  <div className={cn('flex items-center justify-end gap-0.5 text-xs font-bold', p.score_delta >= 0 ? 'text-green-400' : 'text-red-400')}>
                    {p.score_delta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {p.score_delta >= 0 ? '+' : ''}{p.score_delta}
                  </div>
                </div>

                {/* Coach note indicator */}
                {p.coach_note && (
                  <div className="shrink-0">
                    <MessageSquare className="w-3.5 h-3.5 text-zinc-600" />
                  </div>
                )}

                {/* Deep view */}
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

      {/* Deep View panel */}
      <AnimatePresence>
        {activePlayer && <DeepView player={activePlayer} onClose={() => setActivePlayer(null)} />}
      </AnimatePresence>
    </div>
  )
}
