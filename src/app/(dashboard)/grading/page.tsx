'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, ChevronRight, CheckCircle2, Clock,
  AlertCircle, Info, Send, EyeOff, Loader2,
  UserCog, Lock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PlayingRole, TournamentLevel } from '@/types'
import { calculateAthlasXScore, getProvenanceLabel } from '@/lib/athlasx-score'
import { dbRoleMap, seedPerformances } from '@/lib/mock-performance-seed'

/* ─── Quick View card ─────────────────────────────────────────────────────────
   Batting and Bowling only — fielding/keeping excluded (scorecard incomplete)
   Ref: Pivot_Document W4 / QV1–QV2 update (Mrigank's insight)

   Display numbers are derived from calculateAthlasXScore(), not hand-typed.
   Grade submission and reads go through /api/grading/[sessionId]/* — the
   server enforces the blind boundary (a selector's own grades only, until
   the chair unlocks convergence). This page no longer decides that itself.
───────────────────────────────────────────────────────────────────────────── */
interface PlayerQV {
  id: string
  name: string
  district: string
  playing_role: PlayingRole
  batting_0_to_10?: number
  bowling_0_to_10?: number
  match_count: number
  tqi_weighted: number
  top_level: TournamentLevel
}

interface DbPlayer {
  id: string
  full_name: string
  district: string
  playing_role: string | null
}

interface Selector {
  id: string
  email: string
}

function buildQvPool(players: DbPlayer[]): PlayerQV[] {
  return players.map(p => {
    const role = dbRoleMap[p.playing_role ?? 'Batsman'] ?? 'Batsman'
    const performances = seedPerformances(p.id, role)
    const result = calculateAthlasXScore({ playingRole: role, performances, yearsExperience: 3 })
    return {
      id: p.id,
      name: p.full_name,
      district: p.district,
      playing_role: role,
      batting_0_to_10: result.batting > 0 ? result.batting : undefined,
      bowling_0_to_10: result.bowling > 0 ? result.bowling : undefined,
      match_count: result.verifiedMatchCount,
      tqi_weighted: result.tqiWeightedMatches,
      top_level: 'district',
    }
  })
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

/* ─── Quick View card ────────────────────────────────────────────────────────── */
function QuickViewCard({ player }: { player: PlayerQV }) {
  const provenance = getProvenanceLabel(player.match_count, player.tqi_weighted, player.top_level)

  return (
    <div className="p-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-white">{player.name}</p>
          <p className="text-[10px] text-zinc-600">{player.district}</p>
        </div>
      </div>

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
        <div className="flex items-start gap-1.5 p-2 rounded-lg bg-white/[0.02] border border-white/[0.05]">
          <Info className="w-3 h-3 text-zinc-600 mt-0.5 shrink-0" />
          <p className="text-[9px] text-zinc-700 leading-snug">
            Fielding & keeping not rated from data. Scorecards record only successful attempts — drops and missed stumpings are invisible. Assessed at camp.
          </p>
        </div>
      </div>

      <p className="text-[9px] text-zinc-700">{provenance}</p>
    </div>
  )
}

/* ─── Grade input panel ───────────────────────────────────────────────────────── */
function GradePanel({ existing, locked, onSubmit }: {
  existing?: number
  locked: boolean
  onSubmit: (grade: number, notes: string) => Promise<void>
}) {
  const [grade, setGrade] = useState<number | undefined>(existing)
  const [notes, setNotes] = useState('')
  const [submitted, setSubmitted] = useState(!!existing)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setGrade(existing); setSubmitted(!!existing) }, [existing])

  async function handleSubmit() {
    if (!grade) return
    setSaving(true)
    await onSubmit(grade, notes)
    setSaving(false)
    setSubmitted(true)
  }

  if (locked) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        <Lock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
        <p className="text-xs text-zinc-500">Grading is closed — convergence has been unlocked for this session.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {submitted && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/8 border border-green-500/15">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
          <p className="text-xs text-green-300/80">Grade saved to the server. Hidden from other selectors until convergence is unlocked by the chair.</p>
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
            disabled={!grade || saving}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all',
              grade && !saving
                ? 'bg-green-600 hover:bg-green-500 text-white'
                : 'bg-white/[0.04] border border-white/[0.08] text-zinc-600 cursor-not-allowed'
            )}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
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
  const [loading, setLoading] = useState(true)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [chairId, setChairId] = useState<string | null>(null)
  const [unlockedAt, setUnlockedAt] = useState<string | null>(null)
  const [qvPool, setQvPool] = useState<PlayerQV[]>([])
  const [selectors, setSelectors] = useState<Selector[]>([])
  const [selectorId, setSelectorId] = useState<string>('')
  const [grades, setGrades] = useState<Record<string, number>>({})
  const [activeId, setActiveId] = useState<string | null>(null)
  const [unlocking, setUnlocking] = useState(false)

  useEffect(() => {
    fetch('/api/grading/session')
      .then(r => r.json())
      .then(data => {
        if (!data.session) { setLoading(false); return }
        setSessionId(data.session.id)
        setChairId(data.session.chair_id)
        setUnlockedAt(data.session.convergence_unlocked_at)
        setQvPool(buildQvPool(data.session.players))
        setSelectors(data.selectors)
        setSelectorId(data.session.chair_id)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (!sessionId || !selectorId) return
    fetch(`/api/grading/${sessionId}/mine?selectorId=${selectorId}`)
      .then(r => r.json())
      .then(data => {
        const map: Record<string, number> = {}
        for (const g of data.grades ?? []) map[g.player_id] = g.overall_grade
        setGrades(map)
      })
  }, [sessionId, selectorId])

  async function submitGrade(playerId: string, grade: number, notes: string) {
    if (!sessionId || !selectorId) return
    const res = await fetch(`/api/grading/${sessionId}/grade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectorId, playerId, grade, notes }),
    })
    if (res.ok) setGrades(prev => ({ ...prev, [playerId]: grade }))
  }

  async function unlockConvergence() {
    if (!sessionId) return
    setUnlocking(true)
    const res = await fetch(`/api/grading/${sessionId}/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chairId: selectorId }),
    })
    if (res.ok) {
      const data = await res.json()
      setUnlockedAt(data.convergence_unlocked_at)
    }
    setUnlocking(false)
  }

  const active = qvPool.find(p => p.id === activeId)
  const gradedCount = Object.keys(grades).length
  const isChair = selectorId === chairId
  const locked = !!unlockedAt

  if (loading) {
    return <div className="glass-card p-10 flex items-center justify-center text-zinc-600"><Loader2 className="w-5 h-5 animate-spin" /></div>
  }

  if (!sessionId) {
    return (
      <div className="glass-card p-8 flex flex-col items-center justify-center text-center">
        <Shield className="w-8 h-8 text-zinc-700 mb-3" />
        <p className="text-sm font-bold text-zinc-500">No selection session found</p>
        <p className="text-xs text-zinc-700 mt-1">Run prisma/seed.ts against the database to create one</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-[1100px]">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white">Blind Grading</h1>
          <p className="text-xs text-zinc-600 mt-0.5">Your grades are hidden until chair unlocks convergence</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-xl border',
            gradedCount === qvPool.length && qvPool.length > 0
              ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : 'bg-white/[0.03] border-white/[0.06] text-zinc-500'
          )}>
            {gradedCount === qvPool.length && qvPool.length > 0 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
            {gradedCount} / {qvPool.length} graded
          </div>
        </div>
      </motion.div>

      {/* Acting-as selector — stand-in for real auth */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-3 flex items-center gap-3">
        <UserCog className="w-4 h-4 text-zinc-500 shrink-0" />
        <span className="text-xs text-zinc-500">Acting as selector:</span>
        <select
          value={selectorId}
          onChange={e => { setActiveId(null); setSelectorId(e.target.value) }}
          className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-green-500/40"
        >
          <option value={chairId ?? ''} className="bg-zinc-900">Chair ({chairId?.slice(0, 8)}…)</option>
          {selectors.filter(s => s.id !== chairId).map(s => (
            <option key={s.id} value={s.id} className="bg-zinc-900">{s.email}</option>
          ))}
        </select>
        {isChair && !locked && (
          <button
            onClick={unlockConvergence}
            disabled={unlocking}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/10 border border-amber-500/25 text-amber-400 hover:bg-amber-500/15 transition-colors disabled:opacity-50"
          >
            {unlocking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
            Unlock convergence
          </button>
        )}
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}
        className={cn('flex items-start gap-3 p-4 rounded-2xl border', locked ? 'border-white/[0.08] bg-white/[0.02]' : 'border-amber-500/15 bg-amber-500/6')}>
        <AlertCircle className={cn('w-4 h-4 mt-0.5 shrink-0', locked ? 'text-zinc-500' : 'text-amber-400')} />
        <div>
          <p className={cn('text-sm font-bold', locked ? 'text-zinc-400' : 'text-amber-300')}>
            {locked ? 'Convergence unlocked' : 'Blind independent grading is active'}
          </p>
          <p className={cn('text-xs mt-0.5', locked ? 'text-zinc-600' : 'text-amber-300/70')}>
            {locked
              ? 'Grading is closed for this session. See the Convergence page for the aggregated view.'
              : 'You cannot see grades submitted by other selectors — the server enforces this, not the page. The committee chair unlocks the convergence view once grading is complete.'}
          </p>
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-4">
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
                    existing={grades[active.id]}
                    locked={locked}
                    onSubmit={(grade, notes) => submitGrade(active.id, grade, notes)}
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
