'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus, Users, X } from 'lucide-react'
import { AcademyShell, EYEBROW_CLS, H1_CLS } from '../_theme'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

/**
 * Batches management — the one piece of the ported Sparsh batch subsystem
 * (src/lib/academy/batches.ts, src/app/api/academy/batches/**) with a full
 * CRUD API but no UI anywhere until now. Uses the ax.* tokens and shared
 * Card/Button components directly (not _theme.tsx's CARD_CLS/BTN_AMBER_CLS
 * constants the other four academy pages use) per this pass's own scope —
 * AcademyShell is kept only for the shared font/layout wrapper, not for its
 * local CSS-var styling helpers.
 *
 * Archive/edit are NOT built here — no PATCH/DELETE route exists on
 * src/app/api/academy/batches/route.ts, only GET (list active) and POST
 * (create). Adding those would mean writing new API surface, out of scope
 * for "build the UI for what already exists."
 */

interface Batch {
  id: string
  name: string
  age_group: string
  schedule: { day: string; start: string; end: string }[]
  status: 'active' | 'archived'
  player_count?: number
}

interface BatchPlayer {
  id: string
  name: string
  playing_role: string | null
}

const AGE_GROUPS = ['Any', 'U-10', 'U-13', 'U-17', 'Senior']
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function scheduleLabel(schedule: Batch['schedule']): string {
  if (!schedule.length) return 'No times set'
  const days = schedule.map(s => s.day).join('/')
  return `${days} · ${schedule[0].start}–${schedule[0].end}`
}

function NewBatchForm({ onCreated, onCancel }: { onCreated: (b: Batch) => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [ageGroup, setAgeGroup] = useState('Any')
  const [day, setDay] = useState('Mon')
  const [start, setStart] = useState('16:00')
  const [end, setEnd] = useState('18:00')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!name.trim()) { setError('Batch name is required.'); return }
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/academy/batches', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, age_group: ageGroup, schedule: [{ day, start, end }] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create batch')
      onCreated(data.batch)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create batch')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-ax-text">New Batch</p>
        <button type="button" onClick={onCancel} className="text-ax-textFaint hover:text-ax-text"><X className="w-4 h-4" /></button>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wide text-ax-textDim mb-1.5">Batch Name *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Morning U-14"
            className="w-full h-10 px-3 rounded-ax-md bg-ax-fieldBg border border-ax-cardBorder text-ax-text text-sm placeholder:text-ax-textFaint focus:outline-none focus:border-ax-accent" />
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wide text-ax-textDim mb-1.5">Age Group</label>
          <select value={ageGroup} onChange={e => setAgeGroup(e.target.value)}
            className="w-full h-10 px-3 rounded-ax-md bg-ax-fieldBg border border-ax-cardBorder text-ax-text text-sm focus:outline-none focus:border-ax-accent">
            {AGE_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wide text-ax-textDim mb-1.5">Day</label>
          <select value={day} onChange={e => setDay(e.target.value)}
            className="w-full h-10 px-3 rounded-ax-md bg-ax-fieldBg border border-ax-cardBorder text-ax-text text-sm focus:outline-none focus:border-ax-accent">
            {WEEKDAYS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-[11px] font-bold uppercase tracking-wide text-ax-textDim mb-1.5">Start</label>
            <input type="time" value={start} onChange={e => setStart(e.target.value)}
              className="w-full h-10 px-3 rounded-ax-md bg-ax-fieldBg border border-ax-cardBorder text-ax-text text-sm focus:outline-none focus:border-ax-accent" />
          </div>
          <div className="flex-1">
            <label className="block text-[11px] font-bold uppercase tracking-wide text-ax-textDim mb-1.5">End</label>
            <input type="time" value={end} onChange={e => setEnd(e.target.value)}
              className="w-full h-10 px-3 rounded-ax-md bg-ax-fieldBg border border-ax-cardBorder text-ax-text text-sm focus:outline-none focus:border-ax-accent" />
          </div>
        </div>
      </div>
      {error && <p className="text-xs text-ax-bad">{error}</p>}
      <Button onClick={submit} disabled={busy} variant="primary">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Batch'}
      </Button>
    </Card>
  )
}

function BatchRosterPanel({ batch, onClose }: { batch: Batch; onClose: () => void }) {
  const [players, setPlayers] = useState<BatchPlayer[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/academy/batches/${batch.id}/players`)
      .then(async r => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Failed to load roster')
        setPlayers(d.players ?? [])
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load roster'))
  }, [batch.id])

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-ax-text">{batch.name} — Roster</p>
        <button type="button" onClick={onClose} className="text-ax-textFaint hover:text-ax-text"><X className="w-4 h-4" /></button>
      </div>
      {error && <p className="text-xs text-ax-bad">{error}</p>}
      {!players && !error && <Loader2 className="w-4 h-4 animate-spin text-ax-textFaint" />}
      {players && players.length === 0 && <p className="text-xs text-ax-textFaint">No players assigned to this batch yet — assign players from the Players page.</p>}
      {players && players.length > 0 && (
        <div className="space-y-1.5">
          {players.map(p => (
            <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-ax-sm bg-white/[0.03] border border-ax-cardBorder">
              <span className="text-sm text-ax-text">{p.name}</span>
              <span className="text-[11px] text-ax-textFaint">{p.playing_role ?? '—'}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

export default function BatchesPage() {
  const [batches, setBatches] = useState<Batch[] | null>(null)
  const [error, setError] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [rosterFor, setRosterFor] = useState<Batch | null>(null)

  function load() {
    fetch('/api/academy/batches')
      .then(async r => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Failed to load batches')
        setBatches(d.batches ?? [])
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load batches'))
  }

  useEffect(load, [])

  return (
    <AcademyShell>
      <div className="max-w-[900px] mx-auto p-6 sm:p-8 space-y-5 font-barlow">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={EYEBROW_CLS}>
              Athlas<span className="text-ax-accent">X</span> · Academy Admin
            </p>
            <h1 className={H1_CLS}>Batches</h1>
          </div>
          {!showNew && (
            <Button variant="primary" onClick={() => setShowNew(true)}>
              <Plus className="w-4 h-4" /> New Batch
            </Button>
          )}
        </div>

        {showNew && (
          <NewBatchForm
            onCreated={(b) => { setShowNew(false); setBatches(prev => prev ? [b, ...prev] : [b]) }}
            onCancel={() => setShowNew(false)}
          />
        )}

        {error && <p className="text-sm text-ax-bad">{error}</p>}

        {!batches && !error && (
          <Card className="p-10 flex items-center justify-center text-ax-textFaint"><Loader2 className="w-5 h-5 animate-spin" /></Card>
        )}

        {batches && batches.length === 0 && !showNew && (
          <Card className="p-8 flex flex-col items-center justify-center text-center">
            <Users className="w-8 h-8 text-ax-textFaint mb-3" />
            <p className="text-sm font-bold text-ax-textDim">No batches yet</p>
            <p className="text-xs text-ax-textFaint mt-1">Create your first batch to start assigning players.</p>
          </Card>
        )}

        {batches && batches.length > 0 && (
          <div className="space-y-2">
            {batches.map(b => (
              <Card key={b.id} className="p-4 cursor-pointer hover:border-white/[0.24] transition-colors" onClick={() => setRosterFor(b)}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-ax-text">{b.name}</p>
                    <p className="text-[11px] text-ax-textFaint mt-0.5">{b.age_group} · {scheduleLabel(b.schedule)}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-ax-textDim">
                    <Users className="w-3.5 h-3.5" />
                    {b.player_count ?? 0}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {rosterFor && <BatchRosterPanel batch={rosterFor} onClose={() => setRosterFor(null)} />}
      </div>
    </AcademyShell>
  )
}
