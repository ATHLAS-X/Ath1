'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  BookOpen, CheckCircle2, AlertTriangle, Send,
  ChevronRight, Loader2, Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { dbRoleMap } from '@/lib/mock-performance-seed'

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

export default function CoachPage() {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [squad, setSquad] = useState<CoachPlayer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/coach/squad').then(r => r.json()).then(data => {
      setSquad(data.squad ?? [])
      setLoading(false)
    })
  }, [])

  const needsEval  = squad.filter(p => !p.fitness_rating).length
  const upToDate   = squad.length - needsEval

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

  return (
    <div className="space-y-6 max-w-[900px] font-barlow">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-anton uppercase text-xl text-ax-text">Coach Dashboard</h1>
          <p className="text-xs text-ax-textFaint mt-0.5">W7 · Supervised evaluations + squad notes</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {needsEval > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-ax-md bg-[rgba(255,138,30,0.1)] border border-[rgba(255,138,30,0.2)] text-ax-accentBright font-bold">
              <AlertTriangle className="w-3.5 h-3.5" />
              {needsEval} need evaluation
            </div>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-ax-md bg-white/[0.03] border border-ax-cardBorder text-ax-textDim">
            <Users className="w-3.5 h-3.5" />
            <span className="text-ax-text font-bold">{squad.length}</span> in squad
          </div>
          {upToDate > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-ax-md bg-[rgba(56,211,159,0.1)] border border-[rgba(56,211,159,0.2)] text-ax-ok font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {upToDate} up to date
            </div>
          )}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}
        className="flex items-start gap-3 p-4 rounded-ax-xl border border-[rgba(255,138,30,0.2)] bg-[rgba(255,138,30,0.08)]">
        <BookOpen className="w-4 h-4 text-ax-accentBright mt-0.5 shrink-0" />
        <div className="space-y-0.5">
          <p className="text-xs font-bold text-ax-accentBright">Evaluation policy</p>
          <p className="text-xs text-ax-textFaint">Fitness and behaviour ratings are coach-supervised only — never from player self-report. A rating of zero means not yet assessed, not a penalty. Raw evaluations are coach-only; selectors see only the advisory note.</p>
        </div>
      </motion.div>

      {loading ? (
        <Card className="p-10 flex items-center justify-center text-ax-textFaint"><Loader2 className="w-5 h-5 animate-spin" /></Card>
      ) : squad.length === 0 ? (
        <Card className="p-8 flex flex-col items-center justify-center text-center">
          <Users className="w-8 h-8 text-ax-textFaint mb-3" />
          <p className="text-sm font-bold text-ax-textDim">No squad found</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {squad.map((p, i) => {
            const isActive = activeId === p.id
            return (
              <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + i * 0.05 }}>
                <Card
                  className={cn('p-4 cursor-pointer transition-colors hover:border-white/[0.24]', isActive && 'border-white/[0.24]')}
                  onClick={() => setActiveId(isActive ? null : p.id)}
                >
                  {/* Desktop/tablet: single inline row (≥768px) */}
                  <div className="hidden md:flex items-center gap-4">
                    <div className="w-9 h-9 rounded-ax-md bg-[rgba(255,138,30,0.14)] border border-ax-cardBorder flex items-center justify-center text-xs font-black text-ax-accentBright shrink-0">
                      {p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-ax-text">{p.name}</p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/[0.05] border border-ax-cardBorder text-ax-textDim uppercase tracking-wide">
                          {dbRoleMap[p.playing_role] ?? p.playing_role.replace(/_/g, ' ')}
                        </span>
                        {p.flag === 'form_drop' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-ax-sm border bg-[rgba(255,90,77,0.1)] border-[rgba(255,90,77,0.2)] text-ax-bad uppercase tracking-wide">Form drop</span>
                        )}
                        {p.flag === 'on_form' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-ax-sm border bg-[rgba(56,211,159,0.1)] border-[rgba(56,211,159,0.2)] text-ax-ok uppercase tracking-wide">On form</span>
                        )}
                      </div>
                      <p className="text-[11px] text-ax-textFaint">{p.district} · Age {p.age}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className={cn('text-[10px] font-bold px-2 py-1 rounded-ax-sm border', p.fitness_rating ? 'bg-[rgba(56,211,159,0.1)] border-[rgba(56,211,159,0.2)] text-ax-ok' : 'bg-white/[0.03] border-ax-cardBorder text-ax-textFaint')}>
                        Fit: {p.fitness_rating ?? '—'}
                      </div>
                      <div className={cn('text-[10px] font-bold px-2 py-1 rounded-ax-sm border', p.behaviour_rating ? 'bg-[rgba(255,138,30,0.1)] border-[rgba(255,138,30,0.2)] text-ax-accentBright' : 'bg-white/[0.03] border-ax-cardBorder text-ax-textFaint')}>
                        Beh: {p.behaviour_rating ?? '—'}
                      </div>
                      <div className="text-xl font-black text-ax-text tabular-nums">{p.athlasx_score}</div>
                      <ChevronRight className={cn('w-4 h-4 text-ax-textFaint transition-transform', isActive && 'rotate-90')} />
                    </div>
                  </div>

                  {/* Mobile: stacked card (<768px) */}
                  <div className="md:hidden space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-ax-md bg-[rgba(255,138,30,0.14)] border border-ax-cardBorder flex items-center justify-center text-xs font-black text-ax-accentBright shrink-0">
                        {p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <p className="text-sm font-bold text-ax-text flex-1 min-w-0 truncate">{p.name}</p>
                      {p.flag === 'form_drop' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-ax-sm border bg-[rgba(255,90,77,0.1)] border-[rgba(255,90,77,0.2)] text-ax-bad uppercase tracking-wide shrink-0">Form drop</span>
                      )}
                      {p.flag === 'on_form' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-ax-sm border bg-[rgba(56,211,159,0.1)] border-[rgba(56,211,159,0.2)] text-ax-ok uppercase tracking-wide shrink-0">On form</span>
                      )}
                      <ChevronRight className={cn('w-4 h-4 text-ax-textFaint transition-transform shrink-0', isActive && 'rotate-90')} />
                    </div>
                    <div className="flex items-center gap-2 pl-12">
                      <span className="text-[11px] text-ax-textFaint">{p.district} · Age {p.age}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/[0.05] border border-ax-cardBorder text-ax-textDim uppercase tracking-wide">
                        {dbRoleMap[p.playing_role] ?? p.playing_role.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pl-12">
                      <div className={cn('text-[10px] font-bold px-2 py-1 rounded-ax-sm border', p.fitness_rating ? 'bg-[rgba(56,211,159,0.1)] border-[rgba(56,211,159,0.2)] text-ax-ok' : 'bg-white/[0.03] border-ax-cardBorder text-ax-textFaint')}>
                        Fit: {p.fitness_rating ?? '—'}
                      </div>
                      <div className={cn('text-[10px] font-bold px-2 py-1 rounded-ax-sm border', p.behaviour_rating ? 'bg-[rgba(255,138,30,0.1)] border-[rgba(255,138,30,0.2)] text-ax-accentBright' : 'bg-white/[0.03] border-ax-cardBorder text-ax-textFaint')}>
                        Beh: {p.behaviour_rating ?? '—'}
                      </div>
                      <div className="text-lg font-black text-ax-text tabular-nums ml-auto">{p.athlasx_score}</div>
                    </div>
                  </div>
                </Card>

                {isActive && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mx-2 mt-1">
                    <EvalForm player={p} onSave={data => handleSave(p.id, data)} />
                  </motion.div>
                )}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
