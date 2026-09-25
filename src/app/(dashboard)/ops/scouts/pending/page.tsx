'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'

/**
 * AthlasX-Ops-only tool — the approval half of the scout pending gate.
 * Mirrors src/app/(dashboard)/ops/associations/pending/page.tsx exactly:
 * src/lib/scout/verification-gate.ts is what actually withholds access in
 * the meantime, this page is just where the decision gets made.
 *
 * Same posture as the association version: ops/layout.tsx returns 404 for
 * anyone who isn't athlasx_ops, and both API routes below call
 * requireRole.
 */

interface PendingScout {
  id: string
  orgName: string
  orgType: 'franchise' | 'academy_recruiting_arm' | 'independent'
  contactName: string | null
  contactPhone: string | null
  email: string
  created_at: string
}

const ORG_TYPE_LABEL: Record<PendingScout['orgType'], string> = {
  franchise: 'Franchise',
  academy_recruiting_arm: 'Academy recruiting arm',
  independent: 'Independent',
}

export default function PendingScoutsPage() {
  const [pending, setPending] = useState<PendingScout[] | null>(null)
  const [error, setError] = useState('')
  const [actingId, setActingId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/ops/scouts/pending')
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Failed to load pending scouts')
        setPending(d.scouts)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load pending scouts'))
  }, [])

  async function decide(id: string, verification_status: 'approved' | 'rejected') {
    setActingId(id)
    setError('')
    try {
      const res = await fetch(`/api/ops/scouts/${id}/verification`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verification_status }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update scout')
      setPending((prev) => prev?.filter((s) => s.id !== id) ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update scout')
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-xl font-black text-white">Pending Scouts</h1>
        <p className="text-xs text-zinc-600 mt-0.5">Scout signups awaiting a real, offline-verified organization check before they get any access to candidate data.</p>
      </div>

      {error && (
        <div className="glass-card p-4 border-red-500/30 bg-red-500/[0.06] text-sm text-red-400">{error}</div>
      )}

      {!pending && !error && (
        <div className="glass-card p-10 flex items-center justify-center text-zinc-600"><Loader2 className="w-5 h-5 animate-spin" /></div>
      )}

      {pending && pending.length === 0 && (
        <div className="glass-card p-8 text-center text-sm text-zinc-500">Nothing pending — every scout signup has been reviewed.</div>
      )}

      {pending && pending.length > 0 && (
        <div className="space-y-3">
          {pending.map((s) => (
            <div key={s.id} className="glass-card p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-white">{s.orgName}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{ORG_TYPE_LABEL[s.orgType]}</p>
                <p className="text-xs text-zinc-600 mt-0.5">Contact: {s.contactName ?? 'unknown'}{s.contactPhone ? ` · ${s.contactPhone}` : ''}</p>
                <p className="text-xs text-zinc-600 mt-0.5">Account: {s.email}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button" disabled={actingId === s.id} onClick={() => decide(s.id, 'rejected')}
                  className="h-9 px-3 rounded-xl text-xs font-bold border border-white/10 bg-white/[0.03] text-zinc-400 hover:border-red-500/40 hover:text-red-400 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <XCircle className="w-3.5 h-3.5" /> Reject
                </button>
                <button
                  type="button" disabled={actingId === s.id} onClick={() => decide(s.id, 'approved')}
                  className="h-9 px-3 rounded-xl text-xs font-bold border border-ax-accent/40 bg-ax-accent/15 text-ax-accentBright hover:bg-ax-accent/25 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {actingId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Approve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
