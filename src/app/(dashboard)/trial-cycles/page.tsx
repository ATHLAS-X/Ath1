'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, MapPin, Users, ChevronRight,
  Clock, CheckCircle2, AlertCircle, FileText,
  Upload, ClipboardCheck, ClipboardList, X, ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TrialCycle } from '@/types'

/* ─── Mock data ──────────────────────────────────────────────────────────────── */
const mockCycles: (TrialCycle & { registrations: number; dossiers_ready: number })[] = [
  {
    id: '1',
    association_id: 'upca',
    age_category: 'U-19',
    dob_window_start: '2006-01-01',
    dob_window_end: '2009-12-31',
    fee_amount: 400,
    registration_opens: '2026-07-01',
    registration_closes: '2026-07-25',
    venues: [
      { id: 'v1', trial_cycle_id: '1', name: 'Green Park Stadium', district: 'Kanpur', date: '2026-08-10' },
      { id: 'v2', trial_cycle_id: '1', name: 'KD Singh Babu Stadium', district: 'Lucknow', date: '2026-08-12' },
    ],
    status: 'registration_open',
    created_at: '2026-06-20T00:00:00Z',
    registrations: 847,
    dossiers_ready: 0,
  },
  {
    id: '2',
    association_id: 'upca',
    age_category: 'U-16',
    dob_window_start: '2009-01-01',
    dob_window_end: '2011-12-31',
    fee_amount: 400,
    registration_opens: '2026-08-01',
    registration_closes: '2026-08-20',
    venues: [
      { id: 'v3', trial_cycle_id: '2', name: 'Muir Mills Ground', district: 'Kanpur', date: '2026-09-05' },
    ],
    status: 'upcoming',
    created_at: '2026-07-01T00:00:00Z',
    registrations: 0,
    dossiers_ready: 0,
  },
]

const statusConfig = {
  upcoming:            { label: 'Upcoming',           color: 'text-zinc-400',  bg: 'bg-zinc-500/10 border-zinc-500/20',  dot: 'bg-zinc-500'  },
  registration_open:   { label: 'Registration Open',  color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', dot: 'bg-green-400', live: true },
  registration_closed: { label: 'Registration Closed',color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', dot: 'bg-amber-400' },
  in_progress:         { label: 'Camp In Progress',   color: 'text-blue-400',  bg: 'bg-blue-500/10 border-blue-500/20',  dot: 'bg-blue-400'  },
  completed:           { label: 'Completed',          color: 'text-zinc-500',  bg: 'bg-zinc-500/8 border-zinc-500/15',   dot: 'bg-zinc-600'  },
}

/* ─── Create cycle modal ─────────────────────────────────────────────────────── */
function CreateCycleModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1)
  const STEPS = 3

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 16 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[#0d0d0d] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div>
            <h2 className="text-sm font-bold text-white">New Trial Cycle</h2>
            <p className="text-xs text-zinc-600 mt-0.5">Step {step} of {STEPS}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-zinc-500 hover:text-white transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-1 px-6 pt-4">
          {Array.from({ length: STEPS }).map((_, i) => (
            <div key={i} className={cn('h-1 flex-1 rounded-full transition-colors duration-300', i < step ? 'bg-green-500' : 'bg-white/[0.06]')} />
          ))}
        </div>

        <div className="px-6 py-5 space-y-4">
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Age Category & Dates</p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-zinc-500 font-medium mb-1.5 block">Age Category</label>
                  <select className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-green-500/40">
                    {['U-14', 'U-16', 'U-19', 'U-23', 'Open'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-500 font-medium mb-1.5 block">DOB From</label>
                    <input type="date" className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-green-500/40" />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 font-medium mb-1.5 block">DOB To</label>
                    <input type="date" className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-green-500/40" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-500 font-medium mb-1.5 block">Registration Opens</label>
                    <input type="date" className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-green-500/40" />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 font-medium mb-1.5 block">Registration Closes</label>
                    <input type="date" className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-green-500/40" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-zinc-500 font-medium mb-1.5 block">Registration Fee (₹)</label>
                  <input type="number" placeholder="400" className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-green-500/40" />
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Venues</p>
              <div className="space-y-2.5">
                {[1, 2].map((i) => (
                  <div key={i} className="p-3.5 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-2.5">
                    <p className="text-xs font-bold text-zinc-400">Venue {i}</p>
                    <input placeholder="Venue name" className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-green-500/40" />
                    <div className="grid grid-cols-2 gap-2">
                      <input placeholder="District" className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-green-500/40" />
                      <input type="date" className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500/40" />
                    </div>
                  </div>
                ))}
                <button className="w-full py-2 rounded-xl border border-dashed border-white/[0.08] text-xs text-zinc-600 hover:text-zinc-400 hover:border-white/[0.14] transition-colors">
                  + Add another venue
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Confirm & Publish</p>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2.5">
                {[
                  ['Category', 'U-19'],
                  ['DOB Window', '2006–2009'],
                  ['Registration', '1 Jul – 25 Jul 2026'],
                  ['Fee', '₹400'],
                  ['Venues', '2 added'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-zinc-600">{k}</span>
                    <span className="text-zinc-300 font-semibold">{v}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/8 border border-amber-500/15">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-300/80">Publishing will open registration to players. This cannot be undone. Verify all dates before confirming.</p>
              </div>
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.06]">
          <button
            onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
            className="text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {step > 1 ? '← Back' : 'Cancel'}
          </button>
          <button
            onClick={() => step < STEPS ? setStep(s => s + 1) : onClose()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition-colors"
          >
            {step < STEPS ? 'Next' : 'Publish Cycle'}
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ─── Cycle card ─────────────────────────────────────────────────────────────── */
function CycleCard({ cycle }: { cycle: typeof mockCycles[0] }) {
  const cfg = statusConfig[cycle.status]
  const daysLeft = Math.max(0, Math.ceil((new Date(cycle.registration_closes).getTime() - Date.now()) / 86400000))

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-5 space-y-4"
    >
      {/* Header row */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-bold text-white">{cycle.age_category} Trials</h3>
            <span className={cn('flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border', cfg.bg, cfg.color)}>
              {(cfg as { live?: boolean }).live && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
              {cfg.label}
            </span>
          </div>
          <p className="text-xs text-zinc-600">UPCA · 2026–27 Season</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-white tabular-nums">{cycle.registrations.toLocaleString()}</p>
          <p className="text-[10px] text-zinc-600">registrations</p>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <p className="text-xs font-black text-white">{cycle.venues.length}</p>
          <p className="text-[10px] text-zinc-600 mt-0.5">Venues</p>
        </div>
        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <p className="text-xs font-black text-white">{cycle.age_category}</p>
          <p className="text-[10px] text-zinc-600 mt-0.5">Category</p>
        </div>
        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <p className="text-xs font-black text-white">₹{cycle.fee_amount}</p>
          <p className="text-[10px] text-zinc-600 mt-0.5">Reg. fee</p>
        </div>
      </div>

      {/* Venues */}
      <div className="space-y-1.5">
        {cycle.venues.map(v => (
          <div key={v.id} className="flex items-center gap-2 text-xs text-zinc-500">
            <MapPin className="w-3 h-3 text-zinc-700 shrink-0" />
            <span className="flex-1 truncate">{v.name}</span>
            <span className="text-zinc-700">{new Date(v.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
          </div>
        ))}
      </div>

      {/* Progress — dossier generation */}
      {cycle.status === 'registration_open' && (
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-zinc-500 font-medium">Dossier readiness</span>
            <span className="text-zinc-400">{cycle.dossiers_ready} / {cycle.registrations}</span>
          </div>
          <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-green-600 to-green-400"
              style={{ width: cycle.registrations > 0 ? `${(cycle.dossiers_ready / cycle.registrations) * 100}%` : '0%' }}
            />
          </div>
          {cycle.dossiers_ready === 0 && (
            <p className="text-[10px] text-zinc-700 mt-1.5">Dossiers generate automatically when registration closes</p>
          )}
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-white/[0.05]">
        {cycle.status === 'registration_open' && (
          <div className="flex items-center gap-1 text-[10px] text-amber-400 mr-auto">
            <Clock className="w-3 h-3" />
            <span>{daysLeft}d left to register</span>
          </div>
        )}
        <button className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs font-medium text-zinc-400 hover:text-white transition-colors">
          View registrations <ChevronRight className="w-3 h-3" />
        </button>
        {cycle.status === 'registration_closed' && (
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-600/90 hover:bg-green-500 text-white text-xs font-bold transition-colors">
            <FileText className="w-3 h-3" />
            Generate Dossiers
          </button>
        )}
      </div>
    </motion.div>
  )
}

/* ─── Page ───────────────────────────────────────────────────────────────────── */
export default function TrialCyclesPage() {
  const [showCreate, setShowCreate] = useState(false)

  const steps = [
    { icon: Upload,        label: 'Historical data ingested',  done: true  },
    { icon: Users,         label: 'Players identity-resolved', done: true  },
    { icon: ClipboardList, label: 'Trial cycle published',     done: true  },
    { icon: FileText,      label: 'Dossiers generated',        done: false },
    { icon: ClipboardCheck,label: 'Camp day check-in',         done: false },
  ]

  return (
    <div className="space-y-6 max-w-[1100px]">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-start justify-between gap-4"
      >
        <div>
          <h1 className="text-xl font-black text-white">Trial Cycles</h1>
          <p className="text-xs text-zinc-600 mt-0.5">Manage registration, venues, and pre-camp dossier generation</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-bold transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Trial Cycle
        </button>
      </motion.div>

      {/* W3 pipeline tracker */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="glass-card p-5"
      >
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">W3 Pipeline · UPCA U-19 2026–27</p>
        <div className="flex items-center gap-0">
          {steps.map((s, i) => (
            <div key={s.label} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                <div className={cn(
                  'w-8 h-8 rounded-xl flex items-center justify-center border transition-colors',
                  s.done
                    ? 'bg-green-500/15 border-green-500/30 text-green-400'
                    : 'bg-white/[0.03] border-white/[0.08] text-zinc-600'
                )}>
                  {s.done
                    ? <CheckCircle2 className="w-4 h-4" />
                    : <s.icon className="w-4 h-4" />
                  }
                </div>
                <p className={cn('text-[9px] font-medium text-center leading-tight max-w-[64px]', s.done ? 'text-green-400' : 'text-zinc-600')}>
                  {s.label}
                </p>
              </div>
              {i < steps.length - 1 && (
                <div className={cn('flex-1 h-px mx-1 mb-5', s.done ? 'bg-green-500/30' : 'bg-white/[0.05]')} />
              )}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Cycle cards */}
      <div className="grid lg:grid-cols-2 gap-4">
        {mockCycles.map((c, i) => (
          <motion.div key={c.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 + i * 0.06 }}>
            <CycleCard cycle={c} />
          </motion.div>
        ))}
      </div>

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && <CreateCycleModal onClose={() => setShowCreate(false)} />}
      </AnimatePresence>
    </div>
  )
}
