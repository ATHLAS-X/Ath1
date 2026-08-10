'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  GitMerge, Lock, Unlock, AlertTriangle, CheckCircle2, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConvergenceRow {
  player_id: string
  name: string
  district: string
  grades: number[]
  average: number
  consensus: 'unanimous' | 'split' | 'contested'
}

const consensusConfig = {
  unanimous: { label: 'Unanimous',  color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
  split:     { label: 'Split',      color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  contested: { label: 'Contested',  color: 'text-red-400',   bg: 'bg-red-500/10 border-red-500/20'     },
}

function GradeDistribution({ grades }: { grades: number[] }) {
  const buckets: Record<string, number> = {}
  for (let i = 1; i <= 10; i++) buckets[i] = 0
  grades.forEach(g => { if (buckets[g] !== undefined) buckets[g]++ })
  const max = Math.max(...Object.values(buckets), 1)

  return (
    <div className="flex items-end gap-1 h-8">
      {Object.entries(buckets).map(([n, count]) => (
        <div key={n} className="flex flex-col items-center gap-0.5 flex-1">
          <div
            className={cn('w-full rounded-t-sm transition-all', count > 0 ? 'bg-green-500' : 'bg-white/[0.05]')}
            style={{ height: `${(count / max) * 100}%`, minHeight: count > 0 ? 4 : 2 }}
          />
        </div>
      ))}
    </div>
  )
}

export default function ConvergencePage() {
  const [loading, setLoading] = useState(true)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [chairId, setChairId] = useState<string | null>(null)
  const [unlocked, setUnlocked] = useState(false)
  const [rows, setRows] = useState<ConvergenceRow[]>([])
  const [alreadySelected, setAlreadySelected] = useState<string[]>([])
  const [error, setError] = useState('')
  const [sort, setSort] = useState<'avg_desc' | 'avg_asc' | 'contested'>('avg_desc')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [locking, setLocking] = useState(false)

  useEffect(() => {
    fetch('/api/grading/session')
      .then(r => r.json())
      .then(async data => {
        if (!data.session) { setLoading(false); return }
        setSessionId(data.session.id)
        setChairId(data.session.chair_id)
        setUnlocked(!!data.session.convergence_unlocked_at)

        if (data.session.convergence_unlocked_at) {
          const res = await fetch(`/api/grading/${data.session.id}/convergence`)
          if (res.ok) {
            const conv = await res.json()
            setRows(conv.views)
            setAlreadySelected(conv.alreadySelected ?? [])
          } else {
            const err = await res.json()
            setError(err.error)
          }
        }
        setLoading(false)
      })
  }, [])

  async function lockSquad() {
    if (!sessionId || !chairId || selected.size === 0) return
    setLocking(true)
    const res = await fetch(`/api/grading/${sessionId}/lock-squad`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chairId, playerIds: Array.from(selected) }),
    })
    if (res.ok) {
      setAlreadySelected(prev => [...prev, ...Array.from(selected)])
      setSelected(new Set())
    } else {
      const data = await res.json()
      setError(data.error)
    }
    setLocking(false)
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const sorted = [...rows].sort((a, b) => {
    if (sort === 'avg_desc') return b.average - a.average
    if (sort === 'avg_asc') return a.average - b.average
    const order = { contested: 0, split: 1, unanimous: 2 }
    return order[a.consensus] - order[b.consensus]
  })

  const unanimous = rows.filter(r => r.consensus === 'unanimous').length
  const split = rows.filter(r => r.consensus === 'split').length
  const contested = rows.filter(r => r.consensus === 'contested').length

  if (loading) {
    return <div className="glass-card p-10 flex items-center justify-center text-zinc-600"><Loader2 className="w-5 h-5 animate-spin" /></div>
  }

  if (!sessionId) {
    return (
      <div className="glass-card p-8 flex flex-col items-center justify-center text-center">
        <GitMerge className="w-8 h-8 text-zinc-700 mb-3" />
        <p className="text-sm font-bold text-zinc-500">No selection session found</p>
      </div>
    )
  }

  if (!unlocked) {
    return (
      <div className="space-y-6 max-w-[1100px]">
        <div>
          <h1 className="text-xl font-black text-white">Convergence View</h1>
          <p className="text-xs text-zinc-600 mt-0.5">Visible to all selectors after chair unlock</p>
        </div>
        <div className="glass-card p-8 flex flex-col items-center justify-center text-center">
          <Lock className="w-8 h-8 text-zinc-700 mb-3" />
          <p className="text-sm font-bold text-zinc-500">Locked — waiting for chair</p>
          <p className="text-xs text-zinc-700 mt-1">Unlock convergence from the Grading page once all selectors have submitted</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-[1100px]">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white">Convergence View</h1>
          <p className="text-xs text-zinc-600 mt-0.5">Visible to all selectors after chair unlock</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold bg-green-500/10 border-green-500/25 text-green-400">
          <Unlock className="w-3.5 h-3.5" />
          Convergence unlocked
        </div>
      </motion.div>

      {error && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl border border-red-500/15 bg-red-500/8">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
          <p className="text-xs text-red-300/80">{error}</p>
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="grid grid-cols-3 gap-3">
        {[
          { label: 'Unanimous', value: unanimous, color: 'text-green-400', sub: 'All selectors agree' },
          { label: 'Split',     value: split,      color: 'text-amber-400', sub: 'Minor disagreement' },
          { label: 'Contested', value: contested,  color: 'text-red-400',   sub: 'Requires discussion' },
        ].map(s => (
          <div key={s.label} className="glass-card p-4">
            <p className={cn('text-3xl font-black tabular-nums', s.color)}>{s.value}</p>
            <p className="text-xs font-bold text-zinc-400 mt-0.5">{s.label}</p>
            <p className="text-[10px] text-zinc-700">{s.sub}</p>
          </div>
        ))}
      </motion.div>

      {contested > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex items-start gap-3 p-4 rounded-2xl border border-red-500/15 bg-red-500/6">
          <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-red-300">{contested} contested player{contested > 1 ? 's' : ''} need committee discussion</p>
            <p className="text-xs text-red-300/70 mt-0.5">Grade range spans ≥3 points. Sort by &quot;Contested first&quot; to address these before squad lock.</p>
          </div>
        </motion.div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          {[
            { key: 'avg_desc', label: 'Highest first' },
            { key: 'avg_asc',  label: 'Lowest first' },
            { key: 'contested',label: 'Contested first' },
          ].map(s => (
            <button
              key={s.key}
              onClick={() => setSort(s.key as typeof sort)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors',
                sort === s.key
                  ? 'bg-green-500/15 border-green-500/25 text-green-400'
                  : 'bg-white/[0.02] border-white/[0.06] text-zinc-500 hover:text-zinc-300'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {sorted.map((row, i) => {
          const cfg = consensusConfig[row.consensus]
          const isSelected = selected.has(row.player_id)
          const isLocked = alreadySelected.includes(row.player_id)
          return (
            <motion.div
              key={row.player_id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 + i * 0.04 }}
              className={cn(
                'glass-card p-4 transition-colors',
                isSelected && 'border-green-500/25 bg-green-500/[0.04]',
                isLocked && 'opacity-60'
              )}
            >
              <div className="flex items-center gap-4">
                <button
                  onClick={() => !isLocked && toggleSelect(row.player_id)}
                  disabled={isLocked}
                  className={cn(
                    'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors',
                    isLocked ? 'bg-green-600 border-green-600' :
                    isSelected ? 'bg-green-500 border-green-500' : 'bg-transparent border-white/[0.15] hover:border-white/30'
                  )}
                >
                  {(isSelected || isLocked) && <CheckCircle2 className="w-3 h-3 text-white" />}
                </button>

                <div className="w-40 shrink-0">
                  <p className="text-sm font-bold text-white truncate">{row.name}</p>
                  <p className="text-[10px] text-zinc-600">{row.district}</p>
                </div>

                <div className="flex-1 min-w-[120px]">
                  <GradeDistribution grades={row.grades} />
                  <div className="flex justify-between text-[8px] text-zinc-700 mt-0.5 px-0.5">
                    <span>1</span><span>5</span><span>10</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {row.grades.map((g, j) => (
                    <div key={j} className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black border',
                      g >= 8 ? 'bg-green-500/15 border-green-500/25 text-green-300'
                              : g >= 6 ? 'bg-amber-500/15 border-amber-500/25 text-amber-300'
                              : 'bg-red-500/10 border-red-500/20 text-red-400'
                    )}>
                      {g}
                    </div>
                  ))}
                </div>

                <div className="text-right w-16 shrink-0">
                  <p className="text-xl font-black text-white tabular-nums">{row.average.toFixed(1)}</p>
                  <p className="text-[9px] text-zinc-600">avg</p>
                </div>

                <div className={cn('px-2 py-1 rounded-lg border text-[10px] font-bold shrink-0', cfg.bg, cfg.color)}>
                  {isLocked ? 'Selected' : cfg.label}
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="glass-card p-5 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-bold text-white">Lock Final Squad</p>
          <p className="text-xs text-zinc-600 mt-0.5">Once locked, selections are immutable.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500">{selected.size} players marked for selection</span>
          <button
            onClick={lockSquad}
            disabled={selected.size === 0 || locking}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all',
              selected.size > 0 && !locking
                ? 'bg-green-600 hover:bg-green-500 text-white'
                : 'bg-white/[0.04] border border-white/[0.08] text-zinc-600 cursor-not-allowed'
            )}
          >
            {locking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            Lock Squad
          </button>
        </div>
      </motion.div>
    </div>
  )
}
