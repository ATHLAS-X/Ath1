'use client'

import { useEffect, useState } from 'react'
import { Loader2, FileText } from 'lucide-react'

interface RegistrationRow {
  id: string
  player: { id: string; full_name: string; playing_role: string | null; district: string }
  venue: { id: string; name: string }
  dossier: { id: string; has_match_history: boolean } | null
}

export default function DossiersClient({ cycleId }: { cycleId: string }) {
  const [rows, setRows] = useState<RegistrationRow[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/trial-cycles/${cycleId}/registrations`).then(r => r.json()).then(d => setRows(d.registrations ?? []))
  }, [cycleId])

  if (!rows) return <div className="glass-card p-10 flex items-center justify-center text-zinc-600"><Loader2 className="w-5 h-5 animate-spin" /></div>

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
      <div className="glass-card p-3 space-y-1 max-h-[70vh] overflow-y-auto">
        {rows.length === 0 && <p className="text-xs text-zinc-600 p-3">No registrants yet</p>}
        {rows.map(r => (
          <button
            key={r.id}
            onClick={() => setSelected(r.id)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between ${selected === r.id ? 'bg-emerald-500/10 text-emerald-300' : 'text-zinc-300 hover:bg-zinc-900'}`}
          >
            <span>
              <span className="block font-medium">{r.player.full_name}</span>
              <span className="block text-[11px] text-zinc-600">{r.venue.name} · {r.player.district}</span>
            </span>
            <FileText className={`w-3.5 h-3.5 ${r.dossier ? 'text-emerald-400' : 'text-zinc-700'}`} />
          </button>
        ))}
      </div>
      <div className="glass-card p-6">
        {selected ? <DossierDetail cycleId={cycleId} registrationId={selected} /> : (
          <p className="text-sm text-zinc-600">Select a registrant to view their pre-camp dossier.</p>
        )}
      </div>
    </div>
  )
}

interface DossierData {
  has_match_history: boolean
  percentile_vs_cohort: number | null
  contents_snapshot: {
    batting: number
    bowling: number
    total: number
    match_count: number
    cohort_size: number
    recent_form: { level: string; batting_runs: number | null; bowling_wickets: number | null }[]
  }
}

function DossierDetail({ cycleId, registrationId }: { cycleId: string; registrationId: string }) {
  const [dossier, setDossier] = useState<DossierData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/trial-cycles/${cycleId}/registrations/${registrationId}/dossier`)
      .then(r => r.json())
      .then(d => setDossier(d.dossier ?? null))
      .finally(() => setLoading(false))
  }, [cycleId, registrationId])

  if (loading) return <Loader2 className="w-5 h-5 animate-spin text-zinc-600" />
  if (!dossier) return <p className="text-sm text-red-400">Could not load dossier</p>

  if (!dossier.has_match_history) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-amber-400">Thin dossier</p>
        <p className="text-sm text-zinc-400">No verified prior tournament history on file for this player. Assessment will rely on trial-day observation.</p>
      </div>
    )
  }

  const c = dossier.contents_snapshot
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Batting" value={c.batting.toFixed(1)} />
        <Stat label="Bowling" value={c.bowling.toFixed(1)} />
        <Stat label="AthlasX Score" value={c.total.toFixed(0)} />
      </div>
      <p className="text-xs text-zinc-500">
        {c.match_count} verified matches · {dossier.percentile_vs_cohort !== null
          ? `${dossier.percentile_vs_cohort}th percentile vs. cohort (n=${c.cohort_size})`
          : `Percentile not available — cohort below the reliability floor (n=${c.cohort_size})`}
      </p>
      <div>
        <p className="text-xs text-zinc-500 mb-2">Recent form</p>
        <div className="space-y-1">
          {c.recent_form.map((f, i) => (
            <div key={i} className="flex justify-between text-xs text-zinc-400 border-b border-zinc-900 py-1">
              <span className="capitalize">{f.level}</span>
              <span>{f.batting_runs !== null ? `${f.batting_runs} runs` : ''} {f.bowling_wickets !== null ? `${f.bowling_wickets} wkts` : ''}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-zinc-800 rounded-lg p-3 text-center">
      <p className="text-lg font-bold text-zinc-100">{value}</p>
      <p className="text-[11px] text-zinc-600">{label}</p>
    </div>
  )
}
