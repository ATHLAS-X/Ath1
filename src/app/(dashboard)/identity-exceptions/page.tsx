'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { UserSearch, CheckCircle2, GitBranch, GitMerge, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/*
 * W2 — Identity exception review
 *
 * Ingest rows that couldn't be auto-attributed to a player with confidence
 * (src/lib/identity-resolution.ts) land here as OPEN IdentityException rows.
 * A human must confirm which real player the row belongs to, split it into
 * a brand-new shadow profile, or merge it onto a different existing
 * candidate. Never auto-resolved.
 */

interface Candidate {
  id: string
  full_name: string | null
  dob: string | null
  district: string | null
  state: string | null
}

interface ExceptionRow {
  id: string
  reason: 'AMBIGUOUS_MATCH' | 'MULTIPLE_CANDIDATES'
  raw_name: string
  raw_dob: string | null
  raw_district: string | null
  candidates: Candidate[]
}

export default function IdentityExceptionsPage() {
  const [exceptions, setExceptions] = useState<ExceptionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Record<string, string>>({})

  async function load() {
    setLoading(true)
    const res = await fetch('/api/identity-exceptions')
    const data = await res.json()
    setExceptions(data.exceptions ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function resolve(id: string, action: 'confirm' | 'split' | 'merge', playerId?: string) {
    setBusyId(id)
    await fetch(`/api/identity-exceptions/${id}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: playerId ? JSON.stringify({ playerId }) : undefined,
    })
    setSelected((s) => { const next = { ...s }; delete next[id]; return next })
    await load()
    setBusyId(null)
  }

  return (
    <div className="space-y-6 max-w-[900px]">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-black text-white">Identity Exceptions</h1>
        <p className="text-xs text-zinc-600 mt-0.5">
          Ingested rows that couldn&apos;t be matched to a player with confidence — confirm the right person, merge onto a different one, or split off a new profile
        </p>
      </motion.div>

      {loading ? (
        <div className="glass-card p-8 flex items-center justify-center text-zinc-600">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : exceptions.length === 0 ? (
        <div className="glass-card p-8 flex flex-col items-center justify-center text-center">
          <UserSearch className="w-8 h-8 text-zinc-700 mb-3" />
          <p className="text-sm font-bold text-zinc-500">Nothing to review</p>
          <p className="text-xs text-zinc-700 mt-1">Ambiguous identity matches from new ingest jobs will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {exceptions.map((e, i) => {
            const isBusy = busyId === e.id
            const selectedId = selected[e.id]
            return (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass-card p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-white">{e.raw_name}</p>
                    <p className="text-[11px] text-zinc-600">
                      {e.raw_dob ? new Date(e.raw_dob).toLocaleDateString() : 'DOB unknown'}
                      {e.raw_district ? ` · ${e.raw_district}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[10px] font-bold text-amber-400/80">
                      {e.reason === 'MULTIPLE_CANDIDATES' ? 'Multiple candidates' : 'Ambiguous match'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {e.candidates.map((c) => (
                    <label
                      key={c.id}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors',
                        selectedId === c.id
                          ? 'border-green-500/30 bg-green-500/[0.06]'
                          : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]',
                      )}
                    >
                      <input
                        type="radio"
                        name={`candidate-${e.id}`}
                        checked={selectedId === c.id}
                        onChange={() => setSelected((s) => ({ ...s, [e.id]: c.id }))}
                        className="shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-white truncate">{c.full_name ?? 'Unknown player'}</p>
                        <p className="text-[10px] text-zinc-600">
                          {c.dob ? new Date(c.dob).toLocaleDateString() : 'DOB unknown'}
                          {c.district ? ` · ${c.district}` : ''}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <button
                    onClick={() => selectedId && resolve(e.id, 'confirm', selectedId)}
                    disabled={isBusy || !selectedId}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors bg-green-500/10 border-green-500/25 text-green-400 hover:bg-green-500/15 disabled:opacity-40"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Confirm selected
                  </button>
                  <button
                    onClick={() => selectedId && resolve(e.id, 'merge', selectedId)}
                    disabled={isBusy || !selectedId || e.candidates.length < 2}
                    title={e.candidates.length < 2 ? 'Only one candidate — use Confirm instead' : undefined}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:text-blue-400 hover:border-blue-500/25 transition-colors disabled:opacity-40"
                  >
                    <GitMerge className="w-3.5 h-3.5" /> Merge onto selected
                  </button>
                  <button
                    onClick={() => resolve(e.id, 'split')}
                    disabled={isBusy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-white/[0.08] bg-white/[0.03] text-zinc-500 hover:text-red-400 hover:border-red-500/25 transition-colors disabled:opacity-40 ml-auto"
                  >
                    <GitBranch className="w-3.5 h-3.5" /> Split — new person
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
