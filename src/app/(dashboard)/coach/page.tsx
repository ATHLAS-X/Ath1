'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  BookOpen, CheckCircle2, AlertTriangle, Send,
  TrendingUp, TrendingDown, Users, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ─── Mock squad data ────────────────────────────────────────────────────────── */
interface CoachPlayer {
  id: string
  name: string
  age: number
  district: string
  fitness_rating?: number    // 1–5 coach-supervised
  behaviour_rating?: number  // 1–5 coach evaluation
  coach_note?: string
  flag: 'on_form' | 'form_drop' | 'none'
  athlasx_score: number
}

const squad: CoachPlayer[] = [
  { id: 'p1', name: 'Arjun Sharma',   age: 17, district: 'Kanpur',   flag: 'on_form',   athlasx_score: 82, fitness_rating: 4, behaviour_rating: 5 },
  { id: 'p2', name: 'Rohan Verma',    age: 18, district: 'Lucknow',  flag: 'none',      athlasx_score: 77, fitness_rating: 3 },
  { id: 'p3', name: 'Dev Patel',      age: 16, district: 'Agra',     flag: 'form_drop', athlasx_score: 65, fitness_rating: 2, coach_note: 'Lost rhythm post-injury. Working on it.' },
  { id: 'p4', name: 'Aditya Singh',   age: 17, district: 'Varanasi', flag: 'none',      athlasx_score: 68 },
  { id: 'p5', name: 'Karan Mehta',    age: 18, district: 'Meerut',   flag: 'on_form',   athlasx_score: 65, fitness_rating: 4, behaviour_rating: 4 },
]

/* ─── Coach evaluation form ──────────────────────────────────────────────────── */
function EvalForm({ player, onSave }: { player: CoachPlayer; onSave: (data: { fitness?: number; behaviour?: number; note: string }) => void }) {
  const [fitness, setFitness]     = useState<number | undefined>(player.fitness_rating)
  const [behaviour, setBehaviour] = useState<number | undefined>(player.behaviour_rating)
  const [note, setNote]           = useState(player.coach_note ?? '')
  const [saved, setSaved] = useState(false)

  function handle() {
    onSave({ fitness, behaviour, note })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function RatingRow({ label, value, onChange, caption }: { label: string; value?: number; onChange: (v: number) => void; caption: string }) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-zinc-400">{label}</p>
          <span className="text-[10px] text-zinc-700">{caption}</span>
        </div>
        <div className="flex items-center gap-2">
          {[1,2,3,4,5].map(n => (
            <button
              key={n}
              onClick={() => onChange(n)}
              className={cn(
                'flex-1 h-9 rounded-xl text-sm font-black border transition-all',
                value === n
                  ? 'bg-green-500/20 border-green-500/40 text-green-300'
                  : 'bg-white/[0.03] border-white/[0.08] text-zinc-500 hover:text-white hover:border-white/[0.14]'
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
    <div className="space-y-4 p-4 rounded-2xl border border-white/[0.08] bg-white/[0.02]">
      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Supervised Evaluation · {player.name}</p>

      <RatingRow
        label="Fitness (1–5)"
        value={fitness}
        onChange={setFitness}
        caption="Coach-supervised only. Enters AthlasX score."
      />

      <RatingRow
        label="Behaviour (1–5)"
        value={behaviour}
        onChange={setBehaviour}
        caption="Based on direct observation. Coach-only access."
      />

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-zinc-400">Coach Note</p>
          <span className="text-[9px] text-zinc-700">Advisory · 200 char · Visible to selectors in deep view</span>
        </div>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value.slice(0, 200))}
          placeholder="Brief advisory note for selectors…"
          rows={3}
          className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-green-500/30 resize-none"
        />
        <div className="flex justify-between text-[9px] text-zinc-700">
          <span>Selectors see this note and the advisory flag — not raw evaluations</span>
          <span>{note.length}/200</span>
        </div>
      </div>

      <button
        onClick={handle}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-bold transition-all"
      >
        {saved ? <CheckCircle2 className="w-4 h-4" /> : <Send className="w-4 h-4" />}
        {saved ? 'Saved' : 'Save Evaluation'}
      </button>
    </div>
  )
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */
export default function CoachPage() {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [localSquad, setLocalSquad] = useState(squad)

  const needsEval  = localSquad.filter(p => !p.fitness_rating).length
  const flagged    = localSquad.filter(p => p.flag === 'form_drop').length

  function handleSave(id: string, data: { fitness?: number; behaviour?: number; note: string }) {
    setLocalSquad(prev => prev.map(p =>
      p.id === id ? { ...p, fitness_rating: data.fitness, behaviour_rating: data.behaviour, coach_note: data.note } : p
    ))
  }

  return (
    <div className="space-y-6 max-w-[900px]">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white">Coach Dashboard</h1>
          <p className="text-xs text-zinc-600 mt-0.5">W7 · Supervised evaluations + squad notes</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {needsEval > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold">
              <AlertTriangle className="w-3.5 h-3.5" />
              {needsEval} need evaluation
            </div>
          )}
          <div className="px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-zinc-500">
            <span className="text-white font-bold">{localSquad.length}</span> in squad
          </div>
        </div>
      </motion.div>

      {/* Policy note */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}
        className="flex items-start gap-3 p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
        <BookOpen className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
        <div className="space-y-0.5">
          <p className="text-xs font-bold text-zinc-300">Evaluation policy</p>
          <p className="text-xs text-zinc-600">Fitness and behaviour ratings are coach-supervised only — never from player self-report. A rating of zero means not yet assessed, not a penalty. Raw evaluations are coach-only; selectors see only the advisory note.</p>
        </div>
      </motion.div>

      {/* Squad list */}
      <div className="space-y-2">
        {localSquad.map((p, i) => {
          const isActive = activeId === p.id
          const fullyEvaluated = p.fitness_rating && p.behaviour_rating
          return (
            <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + i * 0.05 }}>
              <div
                className={cn('glass-card p-4 cursor-pointer transition-colors hover:border-white/[0.12]', isActive && 'border-white/[0.12]')}
                onClick={() => setActiveId(isActive ? null : p.id)}
              >
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center text-xs font-black text-zinc-400 shrink-0">
                    {p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white">{p.name}</p>
                      {p.flag === 'form_drop' && <span className="text-[10px] text-red-400 font-bold">🔴 Form drop</span>}
                      {p.flag === 'on_form'   && <span className="text-[10px] text-green-400 font-bold">🟢 On form</span>}
                    </div>
                    <p className="text-[11px] text-zinc-600">{p.district} · Age {p.age}</p>
                  </div>

                  {/* Eval badges */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className={cn('text-[10px] font-bold px-2 py-1 rounded-lg border', p.fitness_rating ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-white/[0.03] border-white/[0.06] text-zinc-600')}>
                      Fit: {p.fitness_rating ?? '—'}
                    </div>
                    <div className={cn('text-[10px] font-bold px-2 py-1 rounded-lg border', p.behaviour_rating ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-white/[0.03] border-white/[0.06] text-zinc-600')}>
                      Beh: {p.behaviour_rating ?? '—'}
                    </div>
                    <div className="text-xl font-black text-white tabular-nums">{p.athlasx_score}</div>
                    <ChevronRight className={cn('w-4 h-4 text-zinc-600 transition-transform', isActive && 'rotate-90')} />
                  </div>
                </div>
              </div>

              {/* Inline eval form */}
              {isActive && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mx-2 mt-1">
                  <EvalForm
                    player={localSquad.find(q => q.id === p.id)!}
                    onSave={data => handleSave(p.id, data)}
                  />
                </motion.div>
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
