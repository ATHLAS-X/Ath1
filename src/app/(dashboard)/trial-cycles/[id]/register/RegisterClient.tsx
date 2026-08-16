'use client'

import { useEffect, useState } from 'react'
import { Loader2, CheckCircle2, Upload } from 'lucide-react'

interface Venue { id: string; name: string; district: string; date: string }
interface Cycle {
  id: string
  age_category: string
  fee_amount: number
  venues: Venue[]
  status: string
}

function toDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function RegisterClient({ cycleId }: { cycleId: string }) {
  const [cycle, setCycle] = useState<Cycle | null>(null)
  const [venueId, setVenueId] = useState('')
  const [dobProof, setDobProof] = useState<File | null>(null)
  const [residencyProof, setResidencyProof] = useState<File | null>(null)
  const [footageBatting, setFootageBatting] = useState<File | null>(null)
  const [feeAcknowledged, setFeeAcknowledged] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    fetch('/api/trial-cycles')
      .then(r => r.json())
      .then(d => setCycle(d.cycles?.find((c: Cycle) => c.id === cycleId) ?? null))
  }, [cycleId])

  if (!cycle) return <div className="glass-card p-10 flex items-center justify-center text-zinc-600"><Loader2 className="w-5 h-5 animate-spin" /></div>

  if (done) {
    return (
      <div className="glass-card p-8 flex flex-col items-center text-center gap-2">
        <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        <p className="text-sm font-bold text-zinc-200">Registration submitted</p>
        <p className="text-xs text-zinc-500">Your registration is saved. Pay ₹{cycle.fee_amount} in cash at the venue on trial day — online payment isn't available yet.</p>
      </div>
    )
  }

  async function submit() {
    if (!venueId) { setError('Choose a venue'); return }
    if (!feeAcknowledged) { setError('Acknowledge the fee note to continue'); return }
    setSubmitting(true)
    setError(null)
    try {
      const body: Record<string, string> = { venueId }
      if (dobProof) body.dobProof = await toDataUri(dobProof)
      if (residencyProof) body.residencyProof = await toDataUri(residencyProof)
      if (footageBatting) body.footageBatting = await toDataUri(footageBatting)

      const res = await fetch(`/api/trial-cycles/${cycleId}/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Registration failed'); return }
      setDone(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="glass-card p-6 max-w-xl mx-auto space-y-5">
      <div>
        <p className="text-xs text-zinc-500">Trial cycle</p>
        <p className="text-sm font-bold text-zinc-200">{cycle.age_category} category</p>
      </div>

      <div>
        <p className="text-xs text-zinc-500 mb-2">Venue</p>
        <select
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200"
          value={venueId}
          onChange={e => setVenueId(e.target.value)}
        >
          <option value="">Select a venue</option>
          {cycle.venues.map(v => (
            <option key={v.id} value={v.id}>{v.name} — {v.district} ({new Date(v.date).toLocaleDateString()})</option>
          ))}
        </select>
      </div>

      <div className="border border-zinc-800 rounded-lg p-3">
        <p className="text-xs text-zinc-400">
          Registration fee: <span className="font-bold text-zinc-200">₹{cycle.fee_amount}</span>. Online payment
          isn&apos;t available yet — this step doesn&apos;t collect any payment. Please pay in cash at the venue
          on trial day. Your registration is saved either way.
        </p>
        <label className="flex items-center gap-2 mt-2 text-xs text-zinc-300">
          <input type="checkbox" checked={feeAcknowledged} onChange={e => setFeeAcknowledged(e.target.checked)} />
          I understand and will pay at the venue
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-zinc-500">Documents (optional)</p>
        <label className="flex items-center gap-2 text-xs text-zinc-400 border border-dashed border-zinc-800 rounded-lg px-3 py-2 cursor-pointer">
          <Upload className="w-3.5 h-3.5" /> {dobProof ? dobProof.name : 'DOB proof (JPEG/PNG/PDF)'}
          <input type="file" accept="image/jpeg,image/png,application/pdf" className="hidden" onChange={e => setDobProof(e.target.files?.[0] ?? null)} />
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-400 border border-dashed border-zinc-800 rounded-lg px-3 py-2 cursor-pointer">
          <Upload className="w-3.5 h-3.5" /> {residencyProof ? residencyProof.name : 'Residency proof (JPEG/PNG/PDF)'}
          <input type="file" accept="image/jpeg,image/png,application/pdf" className="hidden" onChange={e => setResidencyProof(e.target.files?.[0] ?? null)} />
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-zinc-500">Footage (optional)</p>
        <label className="flex items-center gap-2 text-xs text-zinc-400 border border-dashed border-zinc-800 rounded-lg px-3 py-2 cursor-pointer">
          <Upload className="w-3.5 h-3.5" /> {footageBatting ? footageBatting.name : 'Batting clip (image/PDF placeholder)'}
          <input type="file" accept="image/jpeg,image/png,application/pdf" className="hidden" onChange={e => setFootageBatting(e.target.files?.[0] ?? null)} />
        </label>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        onClick={submit}
        disabled={submitting}
        className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm rounded-lg py-2.5 disabled:opacity-50"
      >
        {submitting ? 'Submitting…' : 'Submit registration'}
      </button>
    </div>
  )
}
