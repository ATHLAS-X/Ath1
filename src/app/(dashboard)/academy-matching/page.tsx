'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Building2, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/*
 * W8 — Academy affiliation reconciliation
 *
 * Ingest sources (CricHeroes, manual CSV, OCR) supply an academy name as a
 * free-text string per player row — never a stable ID. This page shows raw
 * strings the fuzzy matcher (src/lib/string-similarity.ts) has queued
 * against the Academy registry, for a human to confirm or reject. Never
 * auto-merged.
 */

interface Candidate {
  id: string
  raw_string: string
  source: string
  similarity_score: number | null
  status: 'unmatched' | 'suggested'
  suggested_academy: { id: string; name: string; district: string } | null
}

export default function AcademyMatchingPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/academy-matching')
    const data = await res.json()
    setCandidates(data.candidates ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function confirm(id: string, academyId: string) {
    setBusyId(id)
    await fetch(`/api/academy-matching/${id}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ academyId }),
    })
    await load()
    setBusyId(null)
  }

  async function reject(id: string) {
    setBusyId(id)
    await fetch(`/api/academy-matching/${id}/reject`, { method: 'POST' })
    await load()
    setBusyId(null)
  }

  return (
    <div className="space-y-6 max-w-[900px]">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-black text-white">Academy Matching</h1>
        <p className="text-xs text-zinc-600 mt-0.5">Raw academy strings from ingest, queued for reconciliation against the registry</p>
      </motion.div>

      {loading ? (
        <div className="glass-card p-8 flex items-center justify-center text-zinc-600">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : candidates.length === 0 ? (
        <div className="glass-card p-8 flex flex-col items-center justify-center text-center">
          <Building2 className="w-8 h-8 text-zinc-700 mb-3" />
          <p className="text-sm font-bold text-zinc-500">Nothing queued</p>
          <p className="text-xs text-zinc-700 mt-1">Academy strings from new ingest jobs will appear here for review</p>
        </div>
      ) : (
        <div className="space-y-2">
          {candidates.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card p-4 flex items-center gap-4"
            >
              <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4 text-zinc-500" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">&ldquo;{c.raw_string}&rdquo;</p>
                <p className="text-[11px] text-zinc-600">Source: {c.source}</p>
                {c.suggested_academy ? (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="text-[10px] text-zinc-500">Suggested match:</span>
                    <span className="text-[10px] font-bold text-green-400">{c.suggested_academy.name}</span>
                    <span className="text-[10px] text-zinc-700">
                      ({Math.round((c.similarity_score ?? 0) * 100)}% similar)
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <AlertCircle className="w-3 h-3 text-amber-400" />
                    <span className="text-[10px] text-amber-400/80">No confident match found</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {c.suggested_academy && (
                  <button
                    onClick={() => confirm(c.id, c.suggested_academy!.id)}
                    disabled={busyId === c.id}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors',
                      'bg-green-500/10 border-green-500/25 text-green-400 hover:bg-green-500/15 disabled:opacity-50'
                    )}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Confirm
                  </button>
                )}
                <button
                  onClick={() => reject(c.id)}
                  disabled={busyId === c.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-white/[0.08] bg-white/[0.03] text-zinc-500 hover:text-red-400 hover:border-red-500/25 transition-colors disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5" /> Reject
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
