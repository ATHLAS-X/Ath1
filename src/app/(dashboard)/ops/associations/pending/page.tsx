'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'

/**
 * AthlasX-Ops-only tool — the approval half of the self-serve association
 * pending gate (docs/AthlasX_Association_SelfServe_Fresh_Build_Prompt.md's
 * Prompt 4). A self-serve submission (POST /api/associations/self-serve-onboard)
 * creates a real account with zero real access until an Ops person
 * reviews it here and approves or rejects — src/lib/association/verification-gate.ts
 * is what actually withholds access in the meantime; this page is just
 * where that decision gets made.
 *
 * Same posture as the sibling ops/associations/new page: ops/layout.tsx
 * returns 404 for anyone who isn't athlasx_ops, and both API routes below
 * call requireRole.
 */

interface PendingAssociation {
  id: string
  name: string
  type: 'state' | 'district'
  state: string
  leadStaffEmail: string | null
  created_at: string
}

export default function PendingAssociationsPage() {
  const [pending, setPending] = useState<PendingAssociation[] | null>(null)
  const [error, setError] = useState('')
  const [actingId, setActingId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/ops/associations/pending')
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Failed to load pending associations')
        setPending(d.associations)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load pending associations'))
  }, [])

  async function decide(id: string, verification_status: 'approved' | 'rejected') {
    setActingId(id)
    setError('')
    try {
      const res = await fetch(`/api/ops/associations/${id}/verification`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verification_status }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update association')
      setPending((prev) => prev?.filter((a) => a.id !== id) ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update association')
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-xl font-black text-white">Pending Associations</h1>
        <p className="text-xs text-zinc-600 mt-0.5">Self-serve submissions awaiting a real, offline-verified data-sharing agreement before they get any access.</p>
      </div>

      {error && (
        <div className="glass-card p-4 border-red-500/30 bg-red-500/[0.06] text-sm text-red-400">{error}</div>
      )}

      {!pending && !error && (
        <div className="glass-card p-10 flex items-center justify-center text-zinc-600"><Loader2 className="w-5 h-5 animate-spin" /></div>
      )}

      {pending && pending.length === 0 && (
        <div className="glass-card p-8 text-center text-sm text-zinc-500">Nothing pending — every self-serve submission has been reviewed.</div>
      )}

      {pending && pending.length > 0 && (
        <div className="space-y-3">
          {pending.map((a) => (
            <div key={a.id} className="glass-card p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-white">{a.name}</p>
                <p className="text-xs text-zinc-500 mt-0.5 capitalize">{a.type} · {a.state}</p>
                <p className="text-xs text-zinc-600 mt-0.5">Staff: {a.leadStaffEmail ?? 'unknown'}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button" disabled={actingId === a.id} onClick={() => decide(a.id, 'rejected')}
                  className="h-9 px-3 rounded-xl text-xs font-bold border border-white/10 bg-white/[0.03] text-zinc-400 hover:border-red-500/40 hover:text-red-400 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <XCircle className="w-3.5 h-3.5" /> Reject
                </button>
                <button
                  type="button" disabled={actingId === a.id} onClick={() => decide(a.id, 'approved')}
                  className="h-9 px-3 rounded-xl text-xs font-bold border border-ax-accent/40 bg-ax-accent/15 text-ax-accentBright hover:bg-ax-accent/25 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {actingId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Approve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
