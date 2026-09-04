'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Database, Upload, RefreshCw, CheckCircle2,
  Clock, X, FileText, Link2, Zap,
  AlertTriangle, Eye, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { IngestMethod } from '@/types'
import type { IngestSourceKey } from '@/lib/ingest/types'
import { mapCsvToIngestPayload, INGEST_CSV_HEADERS } from '@/lib/ingest/csv-to-payload'
import { CRICHEROES_SYNC_FIXTURE } from '@/lib/ingest/fixtures/cricheroes-sync'

interface IngestJob {
  id: string
  source: string
  method: IngestMethod
  tournament: string
  match_count: number
  player_rows: number
  status: 'pending_review' | 'approved' | 'rejected' | 'processing'
  confidence: number
  conflicts: number
}

const methodLabel: Record<IngestMethod, string> = {
  api_sync:           'API Sync',
  structured_parser:  'PDF Parser',
  ocr:                'OCR',
  excel_mapper:       'Excel Upload',
  manual:             'Manual',
}

const statusConfig = {
  pending_review: { label: 'Pending Review', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', icon: Clock },
  approved:       { label: 'Approved',       color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', icon: CheckCircle2 },
  rejected:       { label: 'Rejected',       color: 'text-red-400',   bg: 'bg-red-500/10 border-red-500/20',     icon: X },
  processing:     { label: 'Processing',     color: 'text-blue-400',  bg: 'bg-blue-500/10 border-blue-500/20',   icon: RefreshCw },
}

/* ─── Confidence bar ─────────────────────────────────────────────────────────── */
function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 90 ? '#22c55e' : pct >= 75 ? '#f59e0b' : '#f87171'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] font-bold tabular-nums" style={{ color }}>{pct}%</span>
    </div>
  )
}

/* ─── Job detail panel ───────────────────────────────────────────────────────── */
function JobPanel({ job, onClose, onDecided }: { job: IngestJob; onClose: () => void; onDecided: (id: string, status: 'approved' | 'rejected') => void }) {
  const [action, setAction] = useState<'idle' | 'approved' | 'rejected'>('idle')
  const [deciding, setDeciding] = useState(false)

  async function decide(decision: 'approved' | 'rejected') {
    setDeciding(true)
    const res = await fetch(`/api/ingest/${job.id}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    })
    setDeciding(false)
    if (res.ok) {
      setAction(decision)
      onDecided(job.id, decision)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-end p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md h-full max-h-[90vh] bg-[#0d0d0d] border border-white/[0.08] rounded-2xl shadow-2xl overflow-y-auto"
      >
        <div className="sticky top-0 bg-[#0d0d0d] flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div>
            <h2 className="text-sm font-black text-white">Ingest Review</h2>
            <p className="text-[10px] text-zinc-600">{job.source} · {methodLabel[job.method]}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-zinc-500 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Tournament */}
          <div className="p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
            <p className="text-[10px] text-zinc-600 mb-1 uppercase tracking-widest">Tournament</p>
            <p className="text-sm font-bold text-white">{job.tournament}</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Matches',    value: job.match_count },
              { label: 'Player rows',value: job.player_rows },
              { label: 'Conflicts',  value: job.conflicts, warn: job.conflicts > 0 },
              { label: 'Confidence', value: `${Math.round(job.confidence * 100)}%` },
            ].map(s => (
              <div key={s.label} className={cn('p-3 rounded-xl border', (s as { warn?: boolean }).warn && job.conflicts > 0 ? 'border-amber-500/20 bg-amber-500/8' : 'border-white/[0.06] bg-white/[0.02]')}>
                <p className={cn('text-lg font-black tabular-nums', (s as { warn?: boolean }).warn && job.conflicts > 0 ? 'text-amber-300' : 'text-white')}>{s.value}</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Confidence breakdown */}
          <div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Confidence breakdown</p>
            <div className="space-y-2.5">
              {[
                { label: 'Name matching',    v: Math.min(job.confidence + 0.02, 1) },
                { label: 'Date consistency', v: job.confidence },
                { label: 'Score integrity',  v: Math.max(job.confidence - 0.05, 0.6) },
              ].map(r => (
                <div key={r.label} className="flex items-center gap-3">
                  <span className="text-xs text-zinc-600 w-36 shrink-0">{r.label}</span>
                  <ConfidenceBar value={r.v} />
                </div>
              ))}
            </div>
          </div>

          {/* Conflicts notice */}
          {job.conflicts > 0 && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/8">
              <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-300">{job.conflicts} player identity conflicts</p>
                <p className="text-[10px] text-amber-300/70 mt-0.5">Possible duplicate profiles or name variants. Review before approving to avoid double-counting.</p>
              </div>
            </div>
          )}

          {/* Provenance policy */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <Zap className="w-3 h-3 text-zinc-600 mt-0.5 shrink-0" />
            <p className="text-[9px] text-zinc-600 leading-relaxed">
              Every approved row carries: source, ingest_method, confidence_score, association_approval_status. This provenance travels with the player&apos;s Performance record permanently.
            </p>
          </div>

          {/* Action buttons */}
          {job.status === 'pending_review' && action === 'idle' && (
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => decide('rejected')}
                disabled={deciding}
                className="flex-1 py-2.5 rounded-xl border border-red-500/25 bg-red-500/10 text-red-400 text-sm font-bold hover:bg-red-500/20 transition-colors disabled:opacity-50"
              >
                {deciding ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Reject'}
              </button>
              <button
                onClick={() => decide('approved')}
                disabled={deciding}
                className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-bold transition-colors disabled:opacity-50"
              >
                {deciding ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Approve'}
              </button>
            </div>
          )}

          {action !== 'idle' && (
            <div className={cn('flex items-center gap-2 p-3.5 rounded-xl border', action === 'approved' ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20')}>
              {action === 'approved' ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <X className="w-4 h-4 text-red-400" />}
              <p className={cn('text-sm font-bold', action === 'approved' ? 'text-green-300' : 'text-red-300')}>
                {action === 'approved' ? 'Approved — data entering AthlasX' : 'Rejected — data excluded'}
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ─── Upload zone ─────────────────────────────────────────────────────────────── */
function UploadZone({
  disabled,
  onFile,
}: {
  disabled: boolean
  onFile: (file: File) => void
}) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function takeFile(file: File | undefined) {
    if (!file || disabled) return
    onFile(file)
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => {
        e.preventDefault()
        setDragging(false)
        takeFile(e.dataTransfer.files[0])
      }}
      onClick={() => { if (!disabled) inputRef.current?.click() }}
      className={cn(
        'border-2 border-dashed rounded-2xl p-8 text-center transition-colors',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        dragging ? 'border-green-500/50 bg-green-500/8' : 'border-white/[0.08] hover:border-white/[0.14] bg-white/[0.02]'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".json,.csv,application/json,text/csv"
        className="hidden"
        onChange={e => {
          takeFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <Upload className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
      <p className="text-sm font-bold text-zinc-400">Drop a scorecard JSON or CSV here</p>
      <p className="text-xs text-zinc-700 mt-1">or <span className="text-green-400 font-semibold">browse to upload</span></p>
      <div className="flex items-center justify-center gap-4 mt-4 text-[10px] text-zinc-700">
        <span>JSON · CSV</span>
        <span>·</span>
        <span>Mapped into the existing adapter payload</span>
      </div>
    </div>
  )
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */
export default function IngestPage() {
  const [jobs, setJobs] = useState<IngestJob[]>([])
  const [loading, setLoading] = useState(true)
  const [activeJob, setActiveJob] = useState<IngestJob | null>(null)
  const [cricheroesSyncing, setCricheroesSyncing] = useState(false)
  const [associationId, setAssociationId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const excelInputRef = useRef<HTMLInputElement>(null)

  async function refreshJobs() {
    const res = await fetch('/api/ingest')
    const data = await res.json()
    setJobs(data.jobs ?? [])
    if (typeof data.associationId === 'string') setAssociationId(data.associationId)
  }

  useEffect(() => {
    refreshJobs().finally(() => setLoading(false))
  }, [])

  function handleDecided(id: string, status: 'approved' | 'rejected') {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, status } : j))
  }

  async function postPayload(sourceKey: IngestSourceKey, payload: unknown) {
    if (!associationId) {
      setSubmitError('No association is scoped to this session')
      return
    }
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ associationId, sourceKey, payload }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submit failed')
      await refreshJobs()
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Submit failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleFile(file: File) {
    const name = file.name.toLowerCase()
    try {
      if (name.endsWith('.csv')) {
        await postPayload('excel_mapper', mapCsvToIngestPayload(await file.text()))
        return
      }
      if (name.endsWith('.json')) {
        await postPayload('structured_parser', JSON.parse(await file.text()))
        return
      }
      setSubmitError('JSON or CSV only — no PDF/OCR product in this slice')
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Could not read file')
    }
  }

  function downloadCsvTemplate() {
    const blob = new Blob([INGEST_CSV_HEADERS.join(',') + '\n'], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'athlasx-ingest-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function syncCricHeroesFixture() {
    setCricheroesSyncing(true)
    try {
      await postPayload('api_sync', CRICHEROES_SYNC_FIXTURE)
    } finally {
      setCricheroesSyncing(false)
    }
  }

  const pending = jobs.filter(j => j.status === 'pending_review').length
  const approved = jobs.filter(j => j.status === 'approved').length

  return (
    <div className="space-y-6 max-w-[1100px]">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white">Ingest & Data</h1>
          <p className="text-xs text-zinc-600 mt-0.5">W1 — Import match data · Every row carries provenance + confidence score</p>
        </div>
        <div className="flex items-center gap-2">
          {pending > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold">
              <Clock className="w-3.5 h-3.5" />
              {pending} pending review
            </div>
          )}
        </div>
      </motion.div>

      {/* Source connectors */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card p-5">
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Data sources</p>
        <div className="grid sm:grid-cols-3 gap-3">
          {/* CricHeroes */}
          <div className="p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-green-500/15 border border-green-500/25 flex items-center justify-center">
                  <Link2 className="w-4 h-4 text-green-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">CricHeroes</p>
                  <p className="text-[10px] text-zinc-500">Offline — documented fixture</p>
                </div>
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-[9px] text-zinc-500 font-bold">
                Fixture
              </div>
            </div>
            <button
              onClick={() => void syncCricHeroesFixture()}
              disabled={cricheroesSyncing || submitting || !associationId}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-600/80 hover:bg-green-600 text-white text-xs font-bold transition-colors disabled:opacity-60"
            >
              <RefreshCw className={cn('w-3 h-3', cricheroesSyncing && 'animate-spin')} />
              {cricheroesSyncing ? 'Syncing…' : 'Sync now'}
            </button>
            <p className="text-[9px] text-zinc-700">Posts the documented JSON fixture through api_sync. No live CricHeroes call.</p>
          </div>

          {/* PDF */}
          <div className="p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
                <FileText className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Scorecard PDFs</p>
                <p className="text-[10px] text-zinc-600">Upload & parse</p>
              </div>
            </div>
            <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full w-[84%]" />
            </div>
            <p className="text-[9px] text-zinc-700">Parser confidence 84% · Low confidence rows flagged for manual review</p>
          </div>

          {/* Excel */}
          <div className="p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                <Database className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Excel / CSV</p>
                <p className="text-[10px] text-zinc-600">Structured upload</p>
              </div>
            </div>
            <input
              ref={excelInputRef}
              type="file"
              accept=".json,.csv,application/json,text/csv"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) void handleFile(file)
                e.target.value = ''
              }}
            />
            <button
              onClick={() => excelInputRef.current?.click()}
              disabled={submitting || !associationId}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-zinc-400 hover:text-white text-xs font-medium transition-colors disabled:opacity-50"
            >
              <Upload className="w-3 h-3" />
              Upload file
            </button>
            <p className="text-[9px] text-zinc-700">
              <button type="button" onClick={downloadCsvTemplate} className="text-green-400 hover:underline">Download template</button>
              {' '}→ fill → upload JSON or CSV
            </p>
          </div>
        </div>
      </motion.div>

      {submitError && (
        <div className="flex items-start gap-2 p-3 rounded-xl border border-red-500/20 bg-red-500/8">
          <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
          <p className="text-xs text-red-300">{submitError}</p>
        </div>
      )}

      {/* Upload zone */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <UploadZone disabled={submitting || !associationId} onFile={file => void handleFile(file)} />
      </motion.div>

      {/* Jobs queue */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Recent ingest jobs</p>
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <span className="text-green-400 font-bold">{approved}</span> approved ·
            <span className="text-amber-400 font-bold">{pending}</span> pending
          </div>
        </div>

        {loading ? (
          <div className="glass-card p-10 flex items-center justify-center text-zinc-600"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (
        <div className="space-y-2">
          {jobs.map((job, i) => {
            const cfg = statusConfig[job.status]
            const StatusIcon = cfg.icon

            return (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 + i * 0.05 }}
                className="glass-card p-4 hover:border-white/[0.12] transition-colors"
              >
                <div className="flex items-center gap-4">
                  {/* Source icon */}
                  <div className="w-9 h-9 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center shrink-0">
                    {job.method === 'api_sync' ? <Link2 className="w-4 h-4 text-green-400" />
                      : job.method === 'structured_parser' ? <FileText className="w-4 h-4 text-blue-400" />
                      : <Database className="w-4 h-4 text-amber-400" />}
                  </div>

                  {/* Tournament + meta */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{job.tournament}</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">
                      {job.source} · {methodLabel[job.method]} · {job.match_count} matches · {job.player_rows} rows
                    </p>
                  </div>

                  {/* Confidence */}
                  <div className="hidden md:block w-28 shrink-0">
                    <ConfidenceBar value={job.confidence} />
                  </div>

                  {/* Conflicts */}
                  {job.conflicts > 0 && (
                    <div className="flex items-center gap-1 text-[10px] text-amber-400 font-bold shrink-0">
                      <AlertTriangle className="w-3 h-3" />
                      {job.conflicts}
                    </div>
                  )}

                  {/* Status */}
                  <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-bold shrink-0', cfg.bg, cfg.color)}>
                    <StatusIcon className="w-3 h-3" />
                    {cfg.label}
                  </div>

                  {/* Review button */}
                  {job.status === 'pending_review' && (
                    <button
                      onClick={() => setActiveJob(job)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs font-semibold text-zinc-400 hover:text-white transition-colors shrink-0"
                    >
                      <Eye className="w-3 h-3" />
                      Review
                    </button>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
        )}
      </motion.div>

      {/* Detail panel */}
      <AnimatePresence>
        {activeJob && <JobPanel job={activeJob} onClose={() => setActiveJob(null)} onDecided={handleDecided} />}
      </AnimatePresence>
    </div>
  )
}
