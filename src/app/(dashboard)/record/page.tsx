'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, Shield, Zap, Loader2, BarChart3 } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, ResponsiveContainer,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { dbRoleMap } from '@/lib/mock-performance-seed'

interface RecordData {
  player: { id: string; full_name: string; playing_role: string }
  score: { total: number; tier: string; batting: number; bowling: number; fitness: number; fitnessAssessed: boolean }
  percentile: { value: number | null; cohortSize: number; ageCategory: string; district: string }
  summary: { matches: number; runs: number; average: number; strikeRate: number; fifties: number; best: number }
  trend: { label: string; runs: number; sr: number }[]
  matches: { id: string; opponent: string; tournament: string; date: string; level: string; runs?: number; balls?: number; sr?: number }[]
}

// docs/AthlasX_Master_Data_Points_Phase1_Prompts.md L-2 audit — was
// text-blue/text-purple/text-amber/text-cyan, unrelated to the green
// scheme this pass targets but still off-system; folded into the ax
// accent/ok/bad set so every color on this page comes from one palette.
const levelColors: Record<string, string> = {
  local:    'text-ax-textDim  bg-white/[0.05]     border-ax-cardBorder',
  district: 'text-ax-accentBright bg-[rgba(255,138,30,0.1)]  border-[rgba(255,138,30,0.2)]',
  state:    'text-ax-ok       bg-[rgba(56,211,159,0.1)]  border-[rgba(56,211,159,0.2)]',
  national: 'text-ax-bad      bg-[rgba(255,90,77,0.1)]   border-[rgba(255,90,77,0.2)]',
}

function ChartTip({ active, payload, label }: { active?: boolean; payload?: Array<{value:number;name:string;color:string}>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-ax-bg border border-ax-cardBorder px-3 py-2.5 rounded-ax-md text-xs">
      <p className="text-ax-textDim mb-1.5 font-medium">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="font-bold mb-0.5" style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  )
}

export default function RecordPage() {
  const [data, setData] = useState<RecordData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)

  useEffect(() => {
    fetch('/api/my-record')
      .then(r => {
        if (!r.ok) throw new Error(`GET /api/my-record ${r.status}`)
        return r.json()
      })
      .then(d => { setData(d.player ? d : null); setLoading(false) })
      .catch(e => { console.error(e); setFetchError(true); setLoading(false) })
  }, [])

  if (loading) return <Card className="p-10 flex items-center justify-center text-ax-textFaint"><Loader2 className="w-5 h-5 animate-spin" /></Card>
  if (fetchError) return (
    <Card className="p-8 flex flex-col items-center justify-center text-center">
      <BarChart3 className="w-8 h-8 text-ax-bad mb-3" />
      <p className="text-sm font-bold text-ax-textDim">Something went wrong loading your record</p>
      <p className="text-xs text-ax-textFaint mt-1">Try refreshing.</p>
    </Card>
  )
  if (!data) return (
    <Card className="p-8 flex flex-col items-center justify-center text-center">
      <BarChart3 className="w-8 h-8 text-ax-textFaint mb-3" />
      <p className="text-sm font-bold text-ax-textDim">No claimed player profile found</p>
      <p className="text-xs text-ax-textFaint mt-1">Claim a profile at /claim to see a record here</p>
    </Card>
  )

  const { player, score, percentile, summary, trend, matches } = data

  const summaryStats = [
    { label: 'Matches',     value: String(summary.matches), sub: 'Verified' },
    { label: 'Runs',        value: String(summary.runs),    sub: 'Total' },
    { label: 'Average',     value: summary.average.toFixed(1), sub: 'Batting avg' },
    { label: 'Strike Rate', value: summary.strikeRate.toFixed(1), sub: 'Overall' },
    { label: 'Fifties',     value: String(summary.fifties), sub: 'Half-centuries' },
    { label: 'Best',        value: String(summary.best),    sub: 'Highest score' },
  ]

  return (
    <div className="space-y-6 max-w-[1100px] font-barlow">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-anton uppercase text-xl text-ax-text">My Record</h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/[0.05] border border-ax-cardBorder text-ax-textDim uppercase tracking-wide">
              {dbRoleMap[player.playing_role] ?? player.playing_role.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-xs text-ax-textFaint mt-0.5">{player.full_name} · Association-verified match data only</p>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-ax-md bg-[rgba(56,211,159,0.1)] border border-[rgba(56,211,159,0.2)] text-ax-ok font-bold">
            <Shield className="w-3 h-3" />
            {summary.matches} verified matches
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card className="p-5 relative">
          <span className="absolute top-4 right-5 text-[10px] font-bold px-2 py-1 rounded-ax-sm border border-[rgba(255,138,30,0.25)] bg-[rgba(255,138,30,0.1)] text-ax-accentBright uppercase tracking-wide">
            Tier · {score.tier}
          </span>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-[10px] font-bold text-ax-textFaint uppercase tracking-widest mb-1">AthlasX Score</p>
              <div className="flex items-end gap-3">
                <span className="text-5xl font-black text-ax-text tabular-nums">{score.total}</span>
                <div className="flex items-center gap-1.5 pb-1">
                  <TrendingUp className="w-4 h-4 text-ax-accentBright" />
                </div>
              </div>
              {percentile.value !== null ? (
                <p className="text-[11px] text-ax-textFaint mt-1.5">
                  <span className="text-ax-text font-bold">Top {(100 - percentile.value).toFixed(0)}%</span> of {percentile.ageCategory} {player.playing_role.replace(/_/g, ' ')}s in {percentile.district} <span className="text-ax-textFaint/70">({percentile.cohortSize} players)</span>
                </p>
              ) : (
                <p className="text-[11px] text-ax-textFaint/70 mt-1.5">Not enough {percentile.ageCategory} {player.playing_role.replace(/_/g, ' ')}s in {percentile.district} yet for a percentile ({percentile.cohortSize} so far)</p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3 w-full sm:w-auto sm:min-w-[280px]">
              {[
                { label: 'Batting', value: score.batting, shown: score.batting > 0 ? score.batting.toFixed(1) : '—' },
                { label: 'Bowling', value: score.bowling, shown: score.bowling > 0 ? score.bowling.toFixed(1) : '—' },
                { label: 'Fitness', value: score.fitnessAssessed ? score.fitness : 0, shown: score.fitnessAssessed ? score.fitness.toFixed(1) : '0' },
              ].map(t => (
                <div key={t.label} className="p-2.5 rounded-ax-md border border-ax-cardBorder bg-white/[0.02]">
                  <p className="text-[9px] font-bold text-ax-textFaint uppercase tracking-wide">{t.label}</p>
                  <p className="text-sm font-black text-ax-text tabular-nums">{t.shown}<span className="text-[9px] text-ax-textFaint font-medium">/10</span></p>
                  <div className="h-1 rounded-full bg-white/[0.06] mt-1.5 overflow-hidden">
                    <div className="h-full rounded-full bg-ax-accent" style={{ width: `${Math.min(100, Math.max(0, (t.value / 10) * 100))}%` }} />
                  </div>
                  {t.label === 'Fitness' && !score.fitnessAssessed && <p className="text-[8px] text-ax-textFaint/70 mt-1">Not assessed</p>}
                </div>
              ))}
            </div>
          </div>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {summaryStats.map(s => (
            <div key={s.label} className="text-center p-3 rounded-ax-md border border-ax-cardBorder bg-white/[0.02]">
              <div className="text-xl font-black tabular-nums text-ax-accentBright">{s.value}</div>
              <div className="text-[9px] font-bold text-ax-textFaint mt-0.5 uppercase tracking-wide">{s.label}</div>
              <div className="text-[8px] text-ax-textFaint/70 mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="p-5">
            <p className="text-sm font-bold text-ax-text mb-0.5">Runs trend</p>
            <p className="text-xs text-ax-textFaint mb-4">By match period</p>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={trend} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="gRuns" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF8A1E" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#FF8A1E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fill: 'rgba(245,245,240,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'rgba(245,245,240,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="runs" name="Runs" stroke="#FF8A1E" strokeWidth={2} fill="url(#gRuns)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
            <table className="sr-only" aria-label="Runs by match period">
              <thead><tr><th>Period</th><th>Runs</th></tr></thead>
              <tbody>{trend.map(t => <tr key={t.label}><td>{t.label}</td><td>{t.runs}</td></tr>)}</tbody>
            </table>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="p-5">
            <p className="text-sm font-bold text-ax-text mb-0.5">Strike rate trend</p>
            <p className="text-xs text-ax-textFaint mb-4">By match period</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={trend} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="gStrikeRate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FFA64D" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#FF8A1E" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(245,245,240,0.06)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: 'rgba(245,245,240,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'rgba(245,245,240,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="sr" name="Strike Rate" radius={[4, 4, 0, 0]} fill="url(#gStrikeRate)" />
              </BarChart>
            </ResponsiveContainer>
            <table className="sr-only" aria-label="Strike rate by match period">
              <thead><tr><th>Period</th><th>Strike Rate</th></tr></thead>
              <tbody>{trend.map(t => <tr key={t.label}><td>{t.label}</td><td>{t.sr}</td></tr>)}</tbody>
            </table>
          </Card>
        </motion.div>
      </div>

      {matches.length === 0 && (
        <Card className="p-8 flex flex-col items-center justify-center text-center">
          <BarChart3 className="w-8 h-8 text-ax-textFaint mb-3" />
          <p className="text-sm font-bold text-ax-textDim">No verified matches yet</p>
          <p className="text-xs text-ax-textFaint mt-1">Scores appear once your association ingests and approves match data</p>
        </Card>
      )}

      <div className="space-y-2">
        {matches.map((m, i) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 + i * 0.05 }}
          >
            <Card className="p-4">
              <div className="flex items-center gap-4">
                <div className={cn('text-[10px] font-bold px-2 py-1 rounded-ax-sm border shrink-0', levelColors[m.level])}>
                  {m.level.charAt(0).toUpperCase() + m.level.slice(1)}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-ax-text truncate">vs {m.opponent}</p>
                  <p className="text-[10px] text-ax-textFaint mt-0.5 truncate">{m.tournament}</p>
                </div>

                <div className="text-right shrink-0">
                  {m.runs !== undefined && (
                    <p className="text-sm font-black text-ax-text tabular-nums">
                      {m.runs} <span className="text-xs text-ax-textFaint font-medium">({m.balls}b)</span>
                    </p>
                  )}
                  {m.sr !== undefined && <p className="text-[10px] text-ax-textFaint">SR {m.sr.toFixed(1)}</p>}
                </div>

                <div className="text-right shrink-0 w-20">
                  <p className="text-[10px] text-ax-textDim">{new Date(m.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="flex items-start gap-2.5 p-4 rounded-ax-lg border border-ax-cardBorder bg-white/[0.02]">
        <Zap className="w-3.5 h-3.5 text-ax-textFaint mt-0.5 shrink-0" />
        <p className="text-[10px] text-ax-textFaint leading-relaxed">
          Only association-approved match data enters your record and AthlasX score. Self-reported data is never included.
        </p>
      </motion.div>
    </div>
  )
}
