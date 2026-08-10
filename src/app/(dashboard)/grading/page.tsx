'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, ChevronRight, CheckCircle2, Clock,
  AlertCircle, Info, Send, Eye, EyeOff,
  TrendingUp, TrendingDown, Minus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PlayingRole, TournamentLevel } from '@/types'
import { calculateAthlasXScore, getProvenanceLabel, type VerifiedPerformanceRow } from '@/lib/athlasx-score'

/* ─── Quick View card ─────────────────────────────────────────────────────────
   Batting and Bowling only — fielding/keeping excluded (scorecard incomplete)
   Ref: Pivot_Document W4 / QV1–QV2 update (Mrigank's insight)

   Display numbers are derived from calculateAthlasXScore(), not hand-typed —
   the seed below is raw verified-match rows, the same shape the ingest
   pipeline will eventually produce.
───────────────────────────────────────────────────────────────────────────── */
interface PlayerQV {
  id: string
  name: string
  age: number
  district: string
  playing_role: PlayingRole
  batting_0_to_10?: number
  bowling_0_to_10?: number
  match_count: number
  tqi_weighted: number
  top_level: TournamentLevel
  recent_form?: string
  percentile: number
}

interface QVSeed {
  id: string
  name: string
  age: number
  district: string
  playing_role: PlayingRole
  recent_form?: string
  percentile: number
  performances: VerifiedPerformanceRow[]
}

const qvSeeds: QVSeed[] = [
  { id: 'p1', name: 'Arjun Sharma', age: 17, district: 'Kanpur', playing_role: 'Batsman', recent_form: '↑', percentile: 91,
    performances: Array.from({ length: 22 }, (_, i) => ({ level: 'district' as const, batting_runs: 34 + (i % 5) * 6, batting_balls: 30, batting_dismissed: i % 4 !== 0 })) },
  { id: 'p2', name: 'Rohan Verma', age: 18, district: 'Lucknow', playing_role: 'All-rounder', recent_form: '→', percentile: 85,
    performances: Array.from({ length: 18 }, (_, i) => ({ level: 'district' as const, batting_runs: 26 + (i % 4) * 5, batting_balls: 28, batting_dismissed: true, bowling_overs: 4, bowling_wickets: i % 3 === 0 ? 2 : 1, bowling_runs_conceded: 26 })) },
  { id: 'p3', name: 'Dev Patel', age: 16, district: 'Agra', playing_role: 'Bowler', recent_form: '↓', percentile: 79,
    performances: Array.from({ length: 15 }, (_, i) => ({ level: 'district' as const, bowling_overs: 4, bowling_wickets: i % 3 === 0 ? 3 : 1, bowling_runs_conceded: 24 })) },
  { id: 'p4', name: 'Aditya Singh', age: 17, district: 'Varanasi', playing_role: 'Batsman', recent_form: '→', percentile: 72,
    performances: Array.from({ length: 20 }, (_, i) => ({ level: 'district' as const, batting_runs: 20 + (i % 5) * 4, batting_balls: 27, batting_dismissed: i % 3 !== 0 })) },
  { id: 'p5', name: 'Karan Mehta', age: 18, district: 'Meerut', playing_role: 'Wicket-keeper Batsman', recent_form: '↑', percentile: 67,
    performances: Array.from({ length: 12 }, (_, i) => ({ level: 'district' as const, batting_runs: 18 + (i % 4) * 5, batting_balls: 26, batting_dismissed: true })) },
]

function topLevel(rows: VerifiedPerformanceRow[]): TournamentLevel {
  if (rows.some(r => r.level === 'national')) return 'national'
  if (rows.some(r => r.level === 'state')) return 'state'
  if (rows.some(r => r.level === 'district')) return 'district'
  return 'local'
}

const qvPool: PlayerQV[] = qvSeeds.map(seed => {
  const result = calculateAthlasXScore({
    playingRole: seed.playing_role,
    performances: seed.performances,
    yearsExperience: 3,
  })
  return {
    id: seed.id,
    name: seed.name,
    age: seed.age,
    district: seed.district,
    playing_role: seed.playing_role,
    batting_0_to_10: result.batting > 0 ? result.batting : undefined,
    bowling_0_to_10: result.bowling > 0 ? result.bowling : undefined,
    match_count: result.verifiedMatchCount,
    tqi_weighted: result.tqiWeightedMatches,
    top_level: topLevel(seed.performances),
    recent_form: seed.recent_form,
    percentile: seed.percentile,
  }
})

// Grades the current selector has submitted — simulates blind state
const myGrades: Record<string, number | undefined> = {
  p1: 8, p3: 6
}

function SkillDot({ value }: { value: number }) {
  const color = value >= 7 ? 'bg-green-400' : value >= 5 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-1">
      <div className={cn('w-1.5 h-1.5 rounded-full', color)} />
      <span className="text-xs font-bold text-white tabular-nums">{value.toFixed(1)}</span>
    </div>
  )
}

function FormIndicator({ form }: { form?: string }) {
  if (form === '↑') return <TrendingUp className="w-3.5 h-3.5 text-green-400" />
  if (form === '↓') return <TrendingDown className="w-3.5 h-3.5 text-red-400" />
  return <Minus className="w-3.5 h-3.5 text-zinc-600" />
}

/* ─── Quick View card ────────────────────────────────────────────────────────── */
function QuickViewCard({ player }: { player: PlayerQV }) {
  const provenance = getProvenanceLabel(player.match_count, player.tqi_weighted, player.top_level)

  return (
    <div className="p-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-white">{player.name}</p>
          <p className="text-[10px] text-zinc-600">{player.district} · Age {player.age}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <FormIndicator form={player.recent_form} />
          <span className="text-[10px] font-bold text-zinc-500">P{player.percentile}</span>
        </div>
      </div>

      {/* Skill snapshot — batting + bowling only */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Scorecard-derivable · 0–10</p>
        {player.batting_0_to_10 !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-500">Batting</span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-1 bg-white/[0.05] rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-green-700 to-green-400" style={{ width: `${player.batting_0_to_10 * 10}%` }} />
              </div>
              <SkillDot value={player.batting_0_to_10} />
            </div>
          </div>
        )}
        {player.bowling_0_to_10 !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-500">Bowling</span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-1 bg-white/[0.05] rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-purple-700 to-purple-400" style={{ width: `${player.bowling_0_to_10! * 10}%` }} />
              </div>
              <SkillDot value={player.bowling_0_to_10!} />
            </div>
          </div>
        )}
        {/* Fielding / Keeping exclusion note */}
        <div className="flex items-start gap-1.5 p-2 rounded-lg bg-white/[0.02] border border-white/[0.05]">
          <Info className="w-3 h-3 text-zinc-600 mt-0.5 shrink-0" />
          <p className="text-[9px] text-zinc-700 leading-snug">
            Fielding & keeping not rated from data. Scorecards record only successful attempts — drops and missed stumpings are invisible. Assessed at camp.
          </p>
        </div>
      </div>

      {/* Provenance */}
      <p className="text-[9px] text-zinc-700">{provenance}</p>
    </div>
  )
}

/* ─── Grade input panel ───────────────────────────────────────────────────────── */
function GradePanel({ player, existing, onSubmit }: {
  player: PlayerQV
  existing?: number
  onSubmit: (grade: number, notes: string) => void
}) {
  const [grade, setGrade] = useState<number | undefined>(existing)
  const [notes, setNotes] = useState('')
  const [submitted, setSubmitted] = useState(!!existing)

  function handleSubmit() {
    if (!grade) return
    onSubmit(grade, notes)
    setSubmitted(true)
  }

  return (
    <div className="space-y-4">
      {submitted && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/8 border border-green-500/15">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
          <p className="text-xs text-green-300/80">Grade submitted. Hidden from other selectors until convergence is unlocked by the chair.</p>
        </div>
      )}

      <div>
        <p className="text-xs font-bold text-zinc-400 mb-3 uppercase tracking-widest">Your grade (1–10)</p>
        <div className="grid grid-cols-5 gap-2">
          {[1,2,3,4,5,6,7,8,9,10].map(n => (
            <button
              key={n}
              onClick={() => !submitted && setGrade(n)}
              disabled={submitted}
              className={cn(
                'h-10 rounded-xl text-sm font-black border transition-all',
                grade === n
                  ? 'bg-green-500/20 border-green-500/40 text-green-300 scale-105'
                  : submitted
                    ? 'bg-white/[0.02] border-white/[0.04] text-zinc-700 cursor-default'
                    : 'bg-white/[0.03] border-white/[0.08] text-zinc-500 hover:text-white hover:border-white/[0.14]'
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {!submitted && (
        <>
          <div>
            <p className="text-xs font-bold text-zinc-400 mb-2 uppercase tracking-widest">Notes (optional)</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Brief rationale for your grade…"
              maxLength={300}
              rows={3}
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-green-500/30 resize-none"
            />
            <p className="text-[10px] text-zinc-700 mt-1 text-right">{notes.length}/300</p>
          </div>
          <button
            onClick={handleSubmit}
            disabled={!grade}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all',
              grade
                ? 'bg-green-600 hover:bg-green-500 text-white'
                : 'bg-white/[0.04] border border-white/[0.08] text-zinc-600 cursor-not-allowed'
            )}
          >
            <Send className="w-4 h-4" />
            Submit Grade
          </button>
          <p className="text-[10px] text-zinc-700 text-center">Your grade is hidden from all other selectors until the chair unlocks convergence</p>
        </>
      )}
    </div>
  )
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */
export default function GradingPage() {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [grades, setGrades] = useState<Record<string, number>>(
    Object.fromEntries(Object.entries(myGrades).filter(([,v]) => v !== undefined)) as Record<string, number>
  )

  const active = qvPool.find(p => p.id === activeId)
  const gradedCount = Object.keys(grades).length

  return (
    <div className="space-y-6 max-w-[1100px]">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white">Blind Grading</h1>
          <p className="text-xs text-zinc-600 mt-0.5">UPCA U-19 2026–27 · Your grades are hidden until chair unlocks convergence</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-xl border',
            gradedCount === qvPool.length
              ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : 'bg-white/[0.03] border-white/[0.06] text-zinc-500'
          )}>
            {gradedCount === qvPool.length ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
            {gradedCount} / {qvPool.length} graded
          </div>
        </div>
      </motion.div>

      {/* Blind grading notice */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}
        className="flex items-start gap-3 p-4 rounded-2xl border border-amber-500/15 bg-amber-500/6">
        <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-bold text-amber-300">Blind independent grading is active</p>
          <p className="text-xs text-amber-300/70 mt-0.5">You cannot see grades submitted by other selectors. The committee chair will unlock the convergence view once all selectors have submitted.</p>
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-4">
        {/* Player list */}
        <div className="space-y-2">
          {qvPool.map((p, i) => {
            const graded = grades[p.id] !== undefined
            return (
              <motion.button
                key={p.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + i * 0.05 }}
                onClick={() => setActiveId(activeId === p.id ? null : p.id)}
                className={cn(
                  'w-full glass-card p-4 flex items-center gap-4 text-left hover:border-white/[0.12] transition-colors',
                  activeId === p.id && 'border-green-500/25 bg-green-500/[0.04]'
                )}
              >
                {/* Avatar */}
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center text-xs font-black text-zinc-400 shrink-0">
                  {p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">{p.name}</p>
                  <p className="text-[11px] text-zinc-600">{p.district} · {p.playing_role === 'Wicket-keeper Batsman' ? 'WK-Bat' : p.playing_role}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {graded ? (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-green-500/10 border border-green-500/20 text-[10px] font-bold text-green-400">
                      <CheckCircle2 className="w-3 h-3" />
                      Grade: {grades[p.id]}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[10px] font-bold text-zinc-600">
                      <Clock className="w-3 h-3" />
                      Pending
                    </div>
                  )}
                  <ChevronRight className={cn('w-4 h-4 transition-transform text-zinc-600', activeId === p.id && 'rotate-90 text-green-400')} />
                </div>
              </motion.button>
            )
          })}
        </div>

        {/* Detail panel */}
        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {active ? (
              <motion.div
                key={active.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="glass-card p-5 space-y-5"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Player Quick View</p>
                  <div className="flex items-center gap-1 text-[10px] text-zinc-600">
                    <EyeOff className="w-3 h-3" />
                    Scorecard data only
                  </div>
                </div>
                <QuickViewCard player={active} />
                <div className="border-t border-white/[0.06] pt-4">
                  <GradePanel
                    player={active}
                    existing={grades[active.id]}
                    onSubmit={(grade) => setGrades(prev => ({ ...prev, [active.id]: grade }))}
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-card p-8 flex flex-col items-center justify-center text-center"
              >
                <Shield className="w-8 h-8 text-zinc-700 mb-3" />
                <p className="text-sm font-bold text-zinc-500">Select a player to grade</p>
                <p className="text-xs text-zinc-700 mt-1">Quick View shows batting and bowling from verified match data</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
