'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  GitMerge, Lock, Unlock, AlertTriangle, CheckCircle2,
  ChevronRight, Users, BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ─── Mock convergence data ─────────────────────────────────────────────────── */
interface ConvergenceRow {
  player_id: string
  name: string
  district: string
  grades: number[]
  average: number
  consensus: 'unanimous' | 'split' | 'contested'
}

const mockRows: ConvergenceRow[] = [
  { player_id: 'p1', name: 'Arjun Sharma',   district: 'Kanpur',   grades: [8, 8, 9], average: 8.3, consensus: 'unanimous' },
  { player_id: 'p2', name: 'Rohan Verma',    district: 'Lucknow',  grades: [7, 8, 6], average: 7.0, consensus: 'split'     },
  { player_id: 'p3', name: 'Dev Patel',      district: 'Agra',     grades: [6, 4, 5], average: 5.0, consensus: 'contested' },
  { player_id: 'p4', name: 'Aditya Singh',   district: 'Varanasi', grades: [7, 7, 7], average: 7.0, consensus: 'unanimous' },
  { player_id: 'p5', name: 'Karan Mehta',    district: 'Meerut',   grades: [6, 5, 7], average: 6.0, consensus: 'split'     },
  { player_id: 'p6', name: 'Rahul Gupta',    district: 'Kanpur',   grades: [5, 6, 5], average: 5.3, consensus: 'split'     },
  { player_id: 'p7', name: 'Vivek Yadav',    district: 'Lucknow',  grades: [4, 3, 4], average: 3.7, consensus: 'unanimous' },
  { player_id: 'p8', name: 'Saurabh Tiwari', district: 'Allahabad',grades: [5, 7, 3], average: 5.0, consensus: 'contested' },
]

const consensusConfig = {
  unanimous: { label: 'Unanimous',  color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
  split:     { label: 'Split',      color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  contested: { label: 'Contested',  color: 'text-red-400',   bg: 'bg-red-500/10 border-red-500/20'     },
}

/* ─── Grade distribution bar ─────────────────────────────────────────────────── */
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

/* ─── Page ─────────────────────────────────────────────────────────────────── */
export default function ConvergencePage() {
  const [unlocked] = useState(true) // chair has unlocked
  const [sort, setSort] = useState<'avg_desc' | 'avg_asc' | 'contested'>('avg_desc')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const sorted = [...mockRows].sort((a, b) => {
    if (sort === 'avg_desc') return b.average - a.average
    if (sort === 'avg_asc') return a.average - b.average
    // contested first
    const order = { contested: 0, split: 1, unanimous: 2 }
    return order[a.consensus] - order[b.consensus]
  })

  const unanimous = mockRows.filter(r => r.consensus === 'unanimous').length
  const contested = mockRows.filter(r => r.consensus === 'contested').length

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-6 max-w-[1100px]">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white">Convergence View</h1>
          <p className="text-xs text-zinc-600 mt-0.5">UPCA U-19 2026–27 · Visible to all selectors after chair unlock</p>
        </div>
        <div className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold',
          unlocked
            ? 'bg-green-500/10 border-green-500/25 text-green-400'
            : 'bg-zinc-500/10 border-zinc-500/20 text-zinc-500'
        )}>
          {unlocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
          {unlocked ? 'Convergence unlocked' : 'Locked — waiting for chair'}
        </div>
      </motion.div>

      {/* Summary stats */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="grid grid-cols-3 gap-3">
        {[
          { label: 'Unanimous', value: unanimous, color: 'text-green-400', sub: 'All selectors agree' },
          { label: 'Split',     value: mockRows.filter(r => r.consensus === 'split').length, color: 'text-amber-400', sub: 'Minor disagreement' },
          { label: 'Contested', value: contested, color: 'text-red-400',   sub: 'Requires discussion' },
        ].map(s => (
          <div key={s.label} className="glass-card p-4">
            <p className={cn('text-3xl font-black tabular-nums', s.color)}>{s.value}</p>
            <p className="text-xs font-bold text-zinc-400 mt-0.5">{s.label}</p>
            <p className="text-[10px] text-zinc-700">{s.sub}</p>
          </div>
        ))}
      </motion.div>

      {/* Contested alert */}
      {contested > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex items-start gap-3 p-4 rounded-2xl border border-red-500/15 bg-red-500/6">
          <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-red-300">{contested} contested player{contested > 1 ? 's' : ''} need committee discussion</p>
            <p className="text-xs text-red-300/70 mt-0.5">Grade range spans ≥3 points. Sort by "Contested first" to address these before squad lock.</p>
          </div>
        </motion.div>
      )}

      {/* Sort + Squad action */}
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
        {selected.size > 0 && (
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition-colors">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Select {selected.size} to squad
          </button>
        )}
      </div>

      {/* Convergence table */}
      <div className="space-y-2">
        {sorted.map((row, i) => {
          const cfg = consensusConfig[row.consensus]
          const isSelected = selected.has(row.player_id)
          return (
            <motion.div
              key={row.player_id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 + i * 0.04 }}
              className={cn(
                'glass-card p-4 transition-colors',
                isSelected && 'border-green-500/25 bg-green-500/[0.04]'
              )}
            >
              <div className="flex items-center gap-4">
                {/* Checkbox */}
                <button
                  onClick={() => toggleSelect(row.player_id)}
                  className={cn(
                    'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors',
                    isSelected ? 'bg-green-500 border-green-500' : 'bg-transparent border-white/[0.15] hover:border-white/30'
                  )}
                >
                  {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                </button>

                {/* Name */}
                <div className="w-40 shrink-0">
                  <p className="text-sm font-bold text-white truncate">{row.name}</p>
                  <p className="text-[10px] text-zinc-600">{row.district}</p>
                </div>

                {/* Distribution chart */}
                <div className="flex-1 min-w-[120px]">
                  <GradeDistribution grades={row.grades} />
                  <div className="flex justify-between text-[8px] text-zinc-700 mt-0.5 px-0.5">
                    <span>1</span><span>5</span><span>10</span>
                  </div>
                </div>

                {/* Individual grades (blind until unlocked) */}
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

                {/* Average */}
                <div className="text-right w-16 shrink-0">
                  <p className="text-xl font-black text-white tabular-nums">{row.average.toFixed(1)}</p>
                  <p className="text-[9px] text-zinc-600">avg</p>
                </div>

                {/* Consensus */}
                <div className={cn('px-2 py-1 rounded-lg border text-[10px] font-bold shrink-0', cfg.bg, cfg.color)}>
                  {cfg.label}
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Squad lock action */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="glass-card p-5 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-bold text-white">Lock Final Squad</p>
          <p className="text-xs text-zinc-600 mt-0.5">Once locked, selections are immutable. Each selected player requires a rationale.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500">{selected.size} players marked for selection</span>
          <button
            disabled={selected.size === 0}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all',
              selected.size > 0
                ? 'bg-green-600 hover:bg-green-500 text-white'
                : 'bg-white/[0.04] border border-white/[0.08] text-zinc-600 cursor-not-allowed'
            )}
          >
            <Lock className="w-4 h-4" />
            Lock Squad
          </button>
        </div>
      </motion.div>
    </div>
  )
}
