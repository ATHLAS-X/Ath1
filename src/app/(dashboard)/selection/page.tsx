'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Search, Users,
  ChevronRight, AlertCircle, CheckCircle2, Clock, Loader2,
  TrendingUp, TrendingDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PlayingRole } from '@/types'

interface Candidate {
  id: string
  name: string
  age: number
  district: string
  playing_role: PlayingRole
  athlasx_score: number
  batting_0_to_10?: number
  bowling_0_to_10?: number
  match_count: number
  percentile: number
  flag: 'on_form' | 'form_drop' | 'skill_below_threshold' | 'none'
  graded_by: number
  total_selectors: number
}

const roleColors: Record<PlayingRole, string> = {
  'Batsman':              'text-blue-400  bg-blue-500/10  border-blue-500/20',
  'Bowler':               'text-purple-400 bg-purple-500/10 border-purple-500/20',
  'All-rounder':          'text-amber-400  bg-amber-500/10  border-amber-500/20',
  'Wicket-keeper Batsman':'text-cyan-400   bg-cyan-500/10   border-cyan-500/20',
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-zinc-600 w-14 shrink-0">{label}</span>
      <div className="flex-1 h-1 bg-white/[0.05] rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-green-700 to-green-400" style={{ width: `${(value / 10) * 100}%` }} />
      </div>
      <span className="text-[10px] font-bold text-zinc-400 w-6 text-right tabular-nums">{value.toFixed(1)}</span>
    </div>
  )
}

function GradeProgress({ graded, total }: { graded: number; total: number }) {
  const allDone = total > 0 && graded === total
  const partial = graded > 0 && graded < total
  return (
    <div className={cn(
      'flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold border',
      allDone ? 'bg-green-500/10 border-green-500/20 text-green-400'
               : partial ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
               : 'bg-white/[0.03] border-white/[0.06] text-zinc-600'
    )}>
      {allDone ? <CheckCircle2 className="w-3 h-3" /> : partial ? <Clock className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
      {graded}/{total} graded
    </div>
  )
}

export default function SelectionPage() {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<PlayingRole | 'All'>('All')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/candidate-pool').then(r => r.json()).then(data => {
      setCandidates(data.candidates ?? [])
      setLoading(false)
    })
  }, [])

  const filtered = candidates.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.district.toLowerCase().includes(search.toLowerCase())
    const matchesRole = roleFilter === 'All' || c.playing_role === roleFilter
    return matchesSearch && matchesRole
  })

  const totalGradingDone = candidates.filter(c => c.total_selectors > 0 && c.graded_by === c.total_selectors).length
  const withMatchHistory = candidates.filter(c => c.match_count > 0).length

  return (
    <div className="space-y-6 max-w-[1100px]">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white">Candidate Pool</h1>
          <p className="text-xs text-zinc-600 mt-0.5">{candidates.length} candidates in the active trial cycle</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className="px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-zinc-500">
            <span className="text-white font-bold">{totalGradingDone}</span> / {candidates.length} fully graded
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total registered',    value: String(candidates.length),  sub: 'Candidates in pool' },
          { label: 'With match history',  value: String(withMatchHistory),   sub: `${candidates.length > 0 ? Math.round((withMatchHistory / candidates.length) * 100) : 0}% have scorecard data` },
          { label: 'Fully graded',        value: String(totalGradingDone),   sub: 'All selectors submitted' },
          { label: 'Not yet started',     value: String(candidates.filter(c => c.graded_by === 0).length), sub: 'Awaiting grading' },
        ].map(s => (
          <div key={s.label} className="glass-card p-4">
            <p className="text-2xl font-black text-white tabular-nums">{s.value}</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">{s.sub}</p>
            <p className="text-[10px] text-zinc-700 mt-1">{s.label}</p>
          </div>
        ))}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08]">
          <Search className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or district…"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-700 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {(['All', 'Batsman', 'Bowler', 'All-rounder', 'Wicket-keeper Batsman'] as const).map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors',
                roleFilter === r ? 'bg-ax-accent/15 border-ax-accent/25 text-ax-accentBright' : 'bg-white/[0.02] border-white/[0.06] text-zinc-500 hover:text-zinc-300'
              )}
            >
              {r === 'Wicket-keeper Batsman' ? 'WK-Bat' : r}
            </button>
          ))}
        </div>
      </motion.div>

      {loading ? (
        <div className="glass-card p-10 flex items-center justify-center text-zinc-600"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 + i * 0.04 }}
              className="glass-card p-4 hover:border-white/[0.12] transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center text-xs font-black text-zinc-400 shrink-0">
                  {c.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-white">{c.name}</p>
                    <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full border', roleColors[c.playing_role])}>
                      {c.playing_role === 'Wicket-keeper Batsman' ? 'WK-Bat' : c.playing_role}
                    </span>
                    {c.flag === 'on_form' && (
                      <span className="flex items-center gap-1 text-[10px] text-green-400"><TrendingUp className="w-3 h-3" /> On form</span>
                    )}
                    {c.flag === 'form_drop' && (
                      <span className="flex items-center gap-1 text-[10px] text-red-400"><TrendingDown className="w-3 h-3" /> Form drop</span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-600 mt-0.5">{c.district} · Age {c.age} · {c.match_count} verified matches</p>
                </div>

                <div className="hidden md:block w-44 space-y-1.5 shrink-0">
                  {c.batting_0_to_10 !== undefined && <ScoreBar label="Batting" value={c.batting_0_to_10} />}
                  {c.bowling_0_to_10 !== undefined && <ScoreBar label="Bowling" value={c.bowling_0_to_10} />}
                </div>

                <div className="text-right shrink-0 w-20">
                  <p className="text-xl font-black text-white tabular-nums">{c.athlasx_score}</p>
                  <p className="text-[10px] text-zinc-600">P{c.percentile}</p>
                </div>

                <div className="shrink-0">
                  <GradeProgress graded={c.graded_by} total={c.total_selectors} />
                </div>

                <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 transition-colors shrink-0" />
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="w-8 h-8 text-zinc-700 mb-3" />
          <p className="text-sm font-bold text-zinc-500">No candidates match</p>
          <p className="text-xs text-zinc-700 mt-1">Try adjusting the search or role filter</p>
        </div>
      )}
    </div>
  )
}
