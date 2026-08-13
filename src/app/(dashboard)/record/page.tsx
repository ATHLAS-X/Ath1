'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, Shield, Zap, Loader2, BarChart3 } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, ResponsiveContainer,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import { cn } from '@/lib/utils'

interface RecordData {
  player: { id: string; full_name: string; playing_role: string }
  score: { total: number; tier: string; batting: number; bowling: number; fitness: number; fitnessAssessed: boolean }
  summary: { matches: number; runs: number; average: number; strikeRate: number; fifties: number; best: number }
  trend: { label: string; runs: number; sr: number }[]
  matches: { id: string; opponent: string; tournament: string; date: string; level: string; runs?: number; balls?: number; sr?: number }[]
}

const levelColors: Record<string, string> = {
  local:    'text-zinc-400  bg-zinc-500/10  border-zinc-500/15',
  district: 'text-blue-400  bg-blue-500/10  border-blue-500/20',
  state:    'text-purple-400 bg-purple-500/10 border-purple-500/20',
  national: 'text-amber-400  bg-amber-500/10  border-amber-500/20',
}

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
  const [data, setData] = useState<RecordData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/my-record').then(r => r.json()).then(d => { setData(d.player ? d : null); setLoading(false) })
  }, [])

  if (loading) return <div className="glass-card p-10 flex items-center justify-center text-zinc-600"><Loader2 className="w-5 h-5 animate-spin" /></div>
  if (!data) return (
    <div className="glass-card p-8 flex flex-col items-center justify-center text-center">
      <BarChart3 className="w-8 h-8 text-zinc-700 mb-3" />
      <p className="text-sm font-bold text-zinc-500">No claimed player profile found</p>
      <p className="text-xs text-zinc-700 mt-1">Claim a profile at /claim to see a record here</p>
    </div>
  )

  const { player, score, summary, trend, matches } = data

  const summaryStats = [
    { label: 'Matches',     value: String(summary.matches), sub: 'Verified',      color: '#22c55e' },
    { label: 'Runs',        value: String(summary.runs),    sub: 'Total',         color: '#22c55e' },
    { label: 'Average',     value: summary.average.toFixed(1), sub: 'Batting avg', color: '#3b82f6' },
    { label: 'Strike Rate', value: summary.strikeRate.toFixed(1), sub: 'Overall', color: '#8b5cf6' },
    { label: 'Fifties',     value: String(summary.fifties), sub: 'Half-centuries', color: '#f59e0b' },
    { label: 'Best',        value: String(summary.best),    sub: 'Highest score', color: '#06b6d4' },
  ]

  return (
    <div className="space-y-6 max-w-[1100px]">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white">My Record</h1>
          <p className="text-xs text-zinc-600 mt-0.5">{player.full_name} · Association-verified match data only</p>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 font-bold">
            <Shield className="w-3 h-3" />
            {summary.matches} verified matches
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card p-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">AthlasX Score</p>
            <div className="flex items-end gap-3">
              <span className="text-5xl font-black text-white tabular-nums">{score.total}</span>
              <div className="flex items-center gap-1.5 pb-1">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-500/15 border border-green-500/25 text-green-400">{score.tier}</span>
                <TrendingUp className="w-4 h-4 text-green-400" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-right">
            <div>
              <p className="text-sm font-black text-white">{score.batting > 0 ? score.batting.toFixed(1) : '—'}</p>
              <p className="text-[10px] text-zinc-600">Batting /10</p>
            </div>
            <div>
              <p className="text-sm font-black text-white">{score.bowling > 0 ? score.bowling.toFixed(1) : '—'}</p>
              <p className="text-[10px] text-zinc-600">Bowling /10</p>
            </div>
            <div>
              <p className="text-sm font-black text-white">{score.fitnessAssessed ? score.fitness.toFixed(1) : '0'}</p>
              <p className="text-[10px] text-zinc-600">Fitness</p>
              {!score.fitnessAssessed && <p className="text-[9px] text-zinc-700">Not assessed</p>}
            </div>
          </div>
        </div>
      </motion.div>

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

      <div className="grid lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card p-5">
          <p className="text-sm font-bold text-white mb-0.5">Runs trend</p>
          <p className="text-xs text-zinc-600 mb-4">By match period</p>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={trend} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
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
          <p className="text-xs text-zinc-600 mb-4">By match period</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={trend} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#3f3f46', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#3f3f46', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="sr" name="Strike Rate" radius={[4, 4, 0, 0]} fill="#3b82f6" fillOpacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      <div className="space-y-2">
        {matches.map((m, i) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 + i * 0.05 }}
            className="glass-card p-4"
          >
            <div className="flex items-center gap-4">
              <div className={cn('text-[10px] font-bold px-2 py-1 rounded-lg border shrink-0', levelColors[m.level])}>
                {m.level.charAt(0).toUpperCase() + m.level.slice(1)}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">vs {m.opponent}</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">{m.tournament}</p>
              </div>

              <div className="text-right shrink-0">
                {m.runs !== undefined && (
                  <p className="text-sm font-black text-white tabular-nums">
                    {m.runs} <span className="text-xs text-zinc-600 font-medium">({m.balls}b)</span>
                  </p>
                )}
                {m.sr !== undefined && <p className="text-[10px] text-zinc-600">SR {m.sr.toFixed(1)}</p>}
              </div>

              <div className="text-right shrink-0 w-20">
                <p className="text-[10px] text-zinc-500">{new Date(m.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="flex items-start gap-2.5 p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
        <Zap className="w-3.5 h-3.5 text-zinc-600 mt-0.5 shrink-0" />
        <p className="text-[10px] text-zinc-600 leading-relaxed">
          Only association-approved match data enters your record and AthlasX score. Self-reported data is never included.
        </p>
      </motion.div>
    </div>
  )
}
