'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Shield, Loader2, BarChart3 } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, ResponsiveContainer,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { dbRoleMap } from '@/lib/mock-performance-seed'
import { RingGauge } from '@/components/ui/ring-gauge'

interface RecordData {
  player: { id: string; full_name: string; playing_role: string; district: string; academy: string | null }
  score: { total: number; tier: string; batting: number; bowling: number; fitness: number; fitnessAssessed: boolean }
  matrix: {
    batting: { score: number; matches: number; boundaryPct: number; average: number; strikeRate: number }
    bowling: { score: number; matches: number; economy: number; wickets: number; style: string | null }
    fitness: { assessed: boolean; score: number }
  }
  percentile: { value: number | null; cohortSize: number; ageCategory: string; district: string }
  summary: { matches: number; runs: number; average: number; strikeRate: number; fifties: number; best: number }
  trend: { label: string; runs: number; sr: number }[]
  scoreTrend: { week: string; score: number }[]
  matches: { id: string; opponent: string; tournament: string; date: string; level: string; runs?: number; balls?: number; sr?: number }[]
}

// Real score-tier ladder (src/lib/athlasx-score.ts's getScoreTier) — the
// mockup showed "Local → District → State → National" as a tier
// progression, but that's TournamentLevel (a match's competition level),
// a completely different concept from score.tier. Using the real tier
// labels here instead of reproducing the mockup's mislabeled ladder.
const TIER_LADDER = ['Rising', 'Developing', 'Advanced', 'Elite']

// Quadrant-card tier badge for the Performance Matrix, on the same 0–10
// scale as score.batting/score.bowling (athlasx-score.ts) — a separate
// scale from TIER_LADDER above, which describes the 0–100 total score.
function matrixTier(value: number, hasData: boolean): { label: string; className: string } {
  if (!hasData) return { label: 'No data', className: 'text-ax-textFaint bg-white/[0.05] border-ax-cardBorder' }
  if (value >= 8) return { label: 'Elite tier', className: 'text-ax-ok bg-[rgba(56,211,159,0.15)] border-[rgba(56,211,159,0.2)]' }
  if (value >= 6) return { label: 'Strong tier', className: 'text-ax-accentBright bg-[rgba(255,138,30,0.15)] border-[rgba(255,138,30,0.2)]' }
  if (value >= 4) return { label: 'Developing', className: 'text-amber-400 bg-amber-500/15 border-amber-500/20' }
  return { label: 'Support tier', className: 'text-ax-textDim bg-white/[0.05] border-ax-cardBorder' }
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

  const { player, score, matrix, percentile, summary, trend, scoreTrend, matches } = data
  const firstName = player.full_name.split(' ')[0]
  const roleLabel = dbRoleMap[player.playing_role] ?? player.playing_role.replace(/_/g, ' ')

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
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <p className="font-barlow-semi text-[11px] font-bold uppercase tracking-[0.18em] text-ax-accentBright">Your record</p>
        <h1 className="font-anton uppercase text-2xl sm:text-[30px] text-ax-text mt-1">Hi, {firstName}</h1>
      </motion.div>

      {/* Hero. The mockup's headline here was a fabricated "average is up 6
          runs this season" delta and a "Log a match" CTA for self-reported
          entry — neither is real: /api/my-record's trend is monthly total
          runs, not a period-over-period average, and this page's own footer
          note below states self-reported match data is never included in
          the record. Both dropped; the hero instead surfaces the one real,
          unambiguous fact (verified match count) that used to live in the
          badge this replaces. */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-ax-lg border border-ax-cardBorder p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-5"
        style={{ background: 'linear-gradient(120deg, rgba(255,138,30,0.08), var(--ax-bg-soft) 55%)' }}
      >
        <div className="max-w-xl">
          <p className="font-barlow-semi text-[11px] font-bold uppercase tracking-[0.18em] text-ax-accentBright">
            {roleLabel} · {percentile.district}
          </p>
          <h2 className="font-anton uppercase text-xl sm:text-2xl text-ax-text mt-1.5 leading-tight">
            {summary.matches > 0
              ? `${summary.matches} verified match${summary.matches === 1 ? '' : 'es'} on your record`
              : 'No verified matches on your record yet'}
          </h2>
          <p className="text-[13.5px] text-ax-textDim mt-2.5 leading-relaxed max-w-md">
            Only association-approved match data enters your record and AthlasX score. Self-reported data is never included.
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-ax-md bg-[rgba(56,211,159,0.1)] border border-[rgba(56,211,159,0.2)] text-ax-ok text-[11px] font-bold">
          <Shield className="w-3.5 h-3.5" />
          Verified only
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card className="p-5">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-5 min-w-0">
              <RingGauge value={score.total} max={100} label={score.total} sublabel="AthlasX" size={92} strokeWidth={9} />
              <div className="min-w-0">
                <p className="text-lg font-bold text-ax-text">{player.full_name}</p>
                <p className="text-xs text-ax-textFaint mt-0.5">
                  {roleLabel} · {player.district}{player.academy ? ` · ${player.academy}` : ''}
                </p>
                {percentile.value !== null ? (
                  <p className="text-[11px] text-ax-textFaint mt-2">
                    <span className="text-ax-text font-bold">Top {(100 - percentile.value).toFixed(0)}%</span> of {percentile.ageCategory} {player.playing_role.replace(/_/g, ' ')}s in {percentile.district} <span className="text-ax-textFaint/70">({percentile.cohortSize} players)</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-ax-textFaint/70 mt-2">Not enough {percentile.ageCategory} {player.playing_role.replace(/_/g, ' ')}s in {percentile.district} yet for a percentile ({percentile.cohortSize} so far)</p>
                )}
              </div>
            </div>
            <span className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-ax-sm border border-[rgba(255,138,30,0.25)] bg-[rgba(255,138,30,0.1)] text-ax-accentBright uppercase tracking-wide">
              Tier · {score.tier}
            </span>
          </div>

          {/* Real tier ladder — score.tier (Rising/Developing/Advanced/Elite)
              is the actual field; this just visualizes where it sits. */}
          <div className="flex items-center gap-1.5 mt-4">
            {TIER_LADDER.map((t, i) => (
              <div key={t} className="flex items-center flex-1 last:flex-none">
                <span className={cn('text-[9px] font-bold uppercase tracking-wide whitespace-nowrap', t === score.tier ? 'text-ax-accentBright' : 'text-ax-textFaint/60')}>{t}</span>
                {i < TIER_LADDER.length - 1 && <div className={cn('h-px flex-1 mx-2', TIER_LADDER.indexOf(score.tier) > i ? 'bg-ax-accent' : 'bg-ax-cardBorder')} />}
              </div>
            ))}
          </div>

        </Card>
      </motion.div>

      {/* Performance Matrix — three quadrant cards (Batting/Bowling/Fitness),
          each with a tier badge and its own real substats, ported from the
          Stitch mockup's "Core Performance Matrix" layout. Fitness always
          shows "Not assessed" here — athlasx-score.ts's fitnessAssessed is
          hardcoded false (no fitness data is collected anywhere in this
          app yet), so unlike the mockup's fabricated Yo-Yo/sprint numbers,
          this card shows only that honest state. */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="font-barlow-semi text-[11px] text-ax-accentBright tracking-wider uppercase font-bold">Core performance matrix</span>
          <span className="font-barlow-semi text-xs text-ax-textFaint font-semibold">Verified data only</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(() => {
            const battingHasData = matrix.batting.matches > 0
            const battingBadge = matrixTier(matrix.batting.score, battingHasData)
            return (
              <Card className="p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-barlow-semi text-xs text-ax-textDim uppercase font-bold">Batting</span>
                    <span className={cn('text-[10px] font-barlow-semi uppercase font-bold px-2 py-0.5 rounded border', battingBadge.className)}>{battingBadge.label}</span>
                  </div>
                  <div className="flex items-baseline gap-1 my-2">
                    <span className="font-anton text-3xl text-ax-text">{battingHasData ? matrix.batting.score.toFixed(1) : '—'}</span>
                    <span className="font-barlow text-xs text-ax-textFaint">/10</span>
                  </div>
                </div>
                {battingHasData ? (
                  <div className="space-y-1.5 pt-2 border-t border-ax-cardBorder text-xs font-barlow text-ax-textDim">
                    <div className="flex justify-between"><span>Boundary runs %</span><strong className="text-ax-text">{matrix.batting.boundaryPct}%</strong></div>
                    <div className="flex justify-between"><span>Average</span><strong className="text-ax-text">{matrix.batting.average.toFixed(1)}</strong></div>
                    <div className="flex justify-between"><span>Strike rate</span><strong className="text-ax-ok">{matrix.batting.strikeRate.toFixed(1)}</strong></div>
                  </div>
                ) : (
                  <p className="text-[11px] text-ax-textFaint/70 pt-2 border-t border-ax-cardBorder">No verified batting innings yet</p>
                )}
              </Card>
            )
          })()}

          {(() => {
            const bowlingHasData = matrix.bowling.matches > 0
            const bowlingBadge = matrixTier(matrix.bowling.score, bowlingHasData)
            return (
              <Card className="p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-barlow-semi text-xs text-ax-textDim uppercase font-bold">Bowling</span>
                    <span className={cn('text-[10px] font-barlow-semi uppercase font-bold px-2 py-0.5 rounded border', bowlingBadge.className)}>{bowlingBadge.label}</span>
                  </div>
                  <div className="flex items-baseline gap-1 my-2">
                    <span className="font-anton text-3xl text-ax-text">{bowlingHasData ? matrix.bowling.score.toFixed(1) : '—'}</span>
                    <span className="font-barlow text-xs text-ax-textFaint">/10</span>
                  </div>
                </div>
                {bowlingHasData ? (
                  <div className="space-y-1.5 pt-2 border-t border-ax-cardBorder text-xs font-barlow text-ax-textDim">
                    <div className="flex justify-between"><span>Discipline</span><strong className="text-ax-text">{matrix.bowling.style ? matrix.bowling.style.replace(/_/g, ' ') : '—'}</strong></div>
                    <div className="flex justify-between"><span>Economy</span><strong className="text-ax-text">{matrix.bowling.economy.toFixed(1)} RPO</strong></div>
                    <div className="flex justify-between"><span>Wickets</span><strong className="text-ax-ok">{matrix.bowling.wickets} / {matrix.bowling.matches} inns</strong></div>
                  </div>
                ) : (
                  <p className="text-[11px] text-ax-textFaint/70 pt-2 border-t border-ax-cardBorder">No verified bowling figures yet</p>
                )}
              </Card>
            )
          })()}

          <Card className="p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-barlow-semi text-xs text-ax-textDim uppercase font-bold">Fitness &amp; endurance</span>
                <span className="text-[10px] font-barlow-semi uppercase font-bold px-2 py-0.5 rounded border text-ax-textFaint bg-white/[0.05] border-ax-cardBorder">Not assessed</span>
              </div>
              <div className="flex items-baseline gap-1 my-2">
                <span className="font-anton text-3xl text-ax-text">—</span>
                <span className="font-barlow text-xs text-ax-textFaint">/10</span>
              </div>
            </div>
            <p className="text-[11px] text-ax-textFaint/70 pt-2 border-t border-ax-cardBorder">Fitness assessment isn&apos;t collected yet — this card will populate once that&apos;s built.</p>
          </Card>
        </div>
      </motion.div>

      {/* Career telemetry strip — real aggregates from verified matches only
          (summaryStats, defined above from `summary`), restyled to match
          the mockup's labeled-strip treatment. */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="p-4 flex flex-col gap-3">
          <span className="font-barlow-semi text-[11px] text-ax-accentBright tracking-wider uppercase font-bold">Career telemetry summary</span>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {summaryStats.map(s => (
              <div key={s.label} className="text-center p-3 rounded-ax-md border border-ax-cardBorder bg-white/[0.02]">
                <div className="text-xl font-black tabular-nums text-ax-accentBright">{s.value}</div>
                <div className="text-[9px] font-bold text-ax-textFaint mt-0.5 uppercase tracking-wide">{s.label}</div>
                <div className="text-[8px] text-ax-textFaint/70 mt-0.5">{s.sub}</div>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* Score trend — real, from PlayerWeek.rolling_4week_average, only
          populated for players who've been through coach-supervised
          weekly assessment. No fabricated line for players without it. */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
        <Card className="p-5">
          <p className="text-sm font-bold text-ax-text mb-0.5">Score trend</p>
          <p className="text-xs text-ax-textFaint mb-4">
            {scoreTrend.length >= 2
              ? `Last ${scoreTrend.length} weekly assessments${scoreTrend.length >= 2 ? ` · ${scoreTrend[scoreTrend.length - 1].score > scoreTrend[0].score ? '+' : ''}${(scoreTrend[scoreTrend.length - 1].score - scoreTrend[0].score).toFixed(1)} since ${new Date(scoreTrend[0].week).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}` : ''}`
              : 'No weekly assessment history yet'}
          </p>
          {scoreTrend.length >= 2 ? (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={scoreTrend} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="gScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF8A1E" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#FF8A1E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="week" tickFormatter={(w: string) => new Date(w).toLocaleDateString('en-IN', { month: 'short' })} tick={{ fill: 'rgba(245,245,240,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'rgba(245,245,240,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="score" name="AthlasX score" stroke="#FF8A1E" strokeWidth={2} fill="url(#gScore)" dot={{ r: 3, fill: '#FF8A1E' }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-ax-textFaint/70 py-8 text-center">Score history builds up once your coach starts weekly assessments.</p>
          )}
        </Card>
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
    </div>
  )
}
