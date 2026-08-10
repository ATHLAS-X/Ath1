'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart3, TrendingUp, TrendingDown, Award,
  ChevronRight, Shield, Zap,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, ResponsiveContainer,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import { cn } from '@/lib/utils'
import type { Format, TournamentLevel } from '@/types'

/* ─── Mock player record ─────────────────────────────────────────────────────── */
const batTrend = [
  { label: 'Aug',  runs: 34,  avg: 17.0, sr: 110 },
  { label: 'Sep',  runs: 67,  avg: 33.5, sr: 124 },
  { label: 'Oct',  runs: 89,  avg: 44.5, sr: 138 },
  { label: 'Nov',  runs: 52,  avg: 26.0, sr: 119 },
  { label: 'Dec',  runs: 112, avg: 56.0, sr: 145 },
  { label: 'Jan',  runs: 78,  avg: 39.0, sr: 132 },
  { label: 'Feb',  runs: 95,  avg: 47.5, sr: 141 },
]

const matchHistory = [
  { id: 'm1', tournament: 'UPCA U-19 District League', opponent: 'Agra XI', date: '2026-07-28', format: 'T20' as Format, level: 'district' as TournamentLevel, runs: 67, balls: 48, sr: 139.6, wickets: undefined, source: 'CricHeroes', confidence: 0.97 },
  { id: 'm2', tournament: 'UPCA U-19 District League', opponent: 'Varanasi Tigers', date: '2026-07-22', format: 'T20' as Format, level: 'district' as TournamentLevel, runs: 34, balls: 29, sr: 117.2, wickets: undefined, source: 'CricHeroes', confidence: 0.97 },
  { id: 'm3', tournament: 'Kanpur District T20 Cup',   opponent: 'Lucknow XI', date: '2026-07-15', format: 'T20' as Format, level: 'district' as TournamentLevel, runs: 89, balls: 61, sr: 145.9, wickets: undefined, source: 'Scorecard PDF', confidence: 0.84 },
  { id: 'm4', tournament: 'UPCA U-19 District League', opponent: 'Meerut Strikers', date: '2026-07-08', format: 'T20' as Format, level: 'district' as TournamentLevel, runs: 12, balls: 14, sr: 85.7, wickets: undefined, source: 'CricHeroes', confidence: 0.97 },
  { id: 'm5', tournament: 'UPCA U-19 District League', opponent: 'Allahabad Kings', date: '2026-06-30', format: 'T20' as Format, level: 'district' as TournamentLevel, runs: 55, balls: 40, sr: 137.5, wickets: undefined, source: 'CricHeroes', confidence: 0.97 },
]

const levelColors: Record<TournamentLevel, string> = {
  local:    'text-zinc-400  bg-zinc-500/10  border-zinc-500/15',
  district: 'text-blue-400  bg-blue-500/10  border-blue-500/20',
  state:    'text-purple-400 bg-purple-500/10 border-purple-500/20',
  national: 'text-amber-400  bg-amber-500/10  border-amber-500/20',
}

const summaryStats = [
  { label: 'Matches',     value: '22',   sub: 'Verified',     color: '#22c55e' },
  { label: 'Runs',        value: '847',  sub: 'Total',        color: '#22c55e' },
  { label: 'Average',     value: '38.5', sub: 'Batting avg',  color: '#3b82f6' },
  { label: 'Strike Rate', value: '134.2',sub: 'T20',          color: '#8b5cf6' },
  { label: 'Fifties',     value: '6',    sub: 'Half-centuries',color: '#f59e0b' },
  { label: 'Best',        value: '89',   sub: 'Highest score',color: '#06b6d4' },
]

function ChartTip({ active, payload, label }: { active?: boolean; payload?: Array<{value:number;name:string;color:string}>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-dark px-3 py-2.5 rounded-xl text-xs">
      <p className="text-zinc-400 mb-1.5 font-medium">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="font-bold mb-0.5" style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  )
}

export default function RecordPage() {
  const [format, setFormat] = useState<Format | 'All'>('All')

  return (
    <div className="space-y-6 max-w-[1100px]">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white">My Record</h1>
          <p className="text-xs text-zinc-600 mt-0.5">Association-verified match data only · TQI-weighted</p>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 font-bold">
            <Shield className="w-3 h-3" />
            22 verified matches
          </div>
        </div>
      </motion.div>

      {/* AthlasX score card */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card p-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">AthlasX Score</p>
            <div className="flex items-end gap-3">
              <span className="text-5xl font-black text-white tabular-nums">82</span>
              <div className="flex items-center gap-1.5 pb-1">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-500/15 border border-green-500/25 text-green-400">Developing</span>
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-xs text-green-400 font-bold">+4 this month</span>
              </div>
            </div>
            <p className="text-[10px] text-zinc-600 mt-1">District level · TQI 15.5x · 91st percentile in cohort</p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-right">
            <div>
              <p className="text-sm font-black text-white">7.8</p>
              <p className="text-[10px] text-zinc-600">Batting /10</p>
            </div>
            <div>
              <p className="text-sm font-black text-white">—</p>
              <p className="text-[10px] text-zinc-600">Bowling</p>
            </div>
            <div>
              <p className="text-sm font-black text-white">0</p>
              <p className="text-[10px] text-zinc-600">Fitness</p>
              <p className="text-[9px] text-zinc-700">Not assessed</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Summary stats strip */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-4">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
          {summaryStats.map(s => (
            <div key={s.label} className="text-center">
              <div className="text-xl font-black tabular-nums" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[9px] font-bold text-zinc-500 mt-0.5 uppercase tracking-wide">{s.label}</div>
              <div className="text-[8px] text-zinc-700 mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card p-5">
          <p className="text-sm font-bold text-white mb-0.5">Runs trend</p>
          <p className="text-xs text-zinc-600 mb-4">Monthly · Aug 2025 – Feb 2026</p>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={batTrend} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="gRuns" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fill: '#3f3f46', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#3f3f46', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} />
              <Area type="monotone" dataKey="runs" name="Runs" stroke="#22c55e" strokeWidth={2} fill="url(#gRuns)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-5">
          <p className="text-sm font-bold text-white mb-0.5">Strike rate trend</p>
          <p className="text-xs text-zinc-600 mb-4">T20 · Monthly average</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={batTrend} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#3f3f46', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis domain={[80, 160]} tick={{ fill: '#3f3f46', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="sr" name="Strike Rate" radius={[4, 4, 0, 0]} fill="#3b82f6" fillOpacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Format filter */}
      <div className="flex items-center gap-1.5">
        {(['All', 'T20', 'ODI', 'Test'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFormat(f)}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors',
              format === f
                ? 'bg-green-500/15 border-green-500/25 text-green-400'
                : 'bg-white/[0.02] border-white/[0.06] text-zinc-500 hover:text-zinc-300'
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Match history */}
      <div className="space-y-2">
        {matchHistory.map((m, i) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 + i * 0.05 }}
            className="glass-card p-4"
          >
            <div className="flex items-center gap-4">
              {/* Level badge */}
              <div className={cn('text-[10px] font-bold px-2 py-1 rounded-lg border shrink-0', levelColors[m.level])}>
                {m.level.charAt(0).toUpperCase() + m.level.slice(1)}
              </div>

              {/* Match info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">vs {m.opponent}</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">{m.tournament}</p>
              </div>

              {/* Stats */}
              <div className="text-right shrink-0">
                {m.runs !== undefined && (
                  <p className="text-sm font-black text-white tabular-nums">
                    {m.runs} <span className="text-xs text-zinc-600 font-medium">({m.balls}b)</span>
                  </p>
                )}
                <p className="text-[10px] text-zinc-600">SR {m.sr.toFixed(1)}</p>
              </div>

              {/* Date */}
              <div className="text-right shrink-0 w-20">
                <p className="text-[10px] text-zinc-500">{new Date(m.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
              </div>

              {/* Provenance */}
              <div className="hidden sm:flex items-center gap-1 shrink-0">
                <div className={cn(
                  'text-[9px] font-bold px-1.5 py-0.5 rounded border',
                  m.confidence >= 0.9 ? 'text-green-400 bg-green-500/8 border-green-500/15'
                                       : 'text-amber-400 bg-amber-500/8 border-amber-500/15'
                )}>
                  {m.source}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Provenance note */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="flex items-start gap-2.5 p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
        <Zap className="w-3.5 h-3.5 text-zinc-600 mt-0.5 shrink-0" />
        <p className="text-[10px] text-zinc-600 leading-relaxed">
          Only association-approved match data enters your record and AthlasX score. Each row shows its source and confidence. Self-reported data is never included.
        </p>
      </motion.div>
    </div>
  )
}
