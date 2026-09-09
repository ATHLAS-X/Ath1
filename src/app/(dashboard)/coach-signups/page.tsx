'use client'

import { useEffect, useState } from 'react'
import { Loader2, Users } from 'lucide-react'

/**
 * Read-only review list for coach accounts that named this association
 * during self-serve sign-up (docs/AthlasX_Pivot_Compliance_Audit_and_Role_Prompts.md
 * Prompt C-1). No approve/reject action here — see the API route's header
 * comment for why (needs a schema change that wasn't authorized). Real
 * squad access is controlled separately and is unaffected by this list.
 */

interface CoachRow { id: string; full_name: string; email: string; created_at: string }

export default function CoachSignupsPage() {
  const [coaches, setCoaches] = useState<CoachRow[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/association/coaches')
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Failed to load coach signups')
        setCoaches(d.coaches)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load coach signups'))
  }, [])

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-xl font-black text-white">Coach Signups</h1>
        <p className="text-xs text-zinc-600 mt-0.5">Coach accounts that named your association during self-serve sign-up. This is a visibility list, not an approval queue — squad access is still granted separately.</p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {!coaches && !error ? (
        <div className="glass-card p-10 flex items-center justify-center text-zinc-600"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : !coaches || coaches.length === 0 ? (
        <div className="glass-card p-10 flex flex-col items-center text-center gap-2 text-zinc-600">
          <Users className="w-6 h-6" />
          <p className="text-sm font-bold">No coaches have named your association yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {coaches.map((c) => (
            <div key={c.id} className="glass-card p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-white">{c.full_name}</p>
                <p className="text-xs text-zinc-600 mt-0.5">{c.email}</p>
              </div>
              <p className="text-[11px] text-zinc-600">{new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
