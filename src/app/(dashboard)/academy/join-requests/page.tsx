'use client'

import { useEffect, useState } from 'react'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { AcademyShell, CARD_CLS, CONTROL_CLS, BTN_AMBER_CLS, BTN_GHOST_CLS, EYEBROW_CLS, H1_CLS } from '../_theme'

/**
 * Join-request approval queue — where the "Pending Actions" tile on
 * design/import/AthlasX Academy Admin Dashboard.html and the guardian
 * self-registration submissions (design/import/AthlasX Player
 * Self-Registration.html) land, per this session's confirmed reading of
 * how the three design files connect.
 */

interface JoinRequest { id: string; name: string; age: number | null; candidate_phone: string | null; submitted_at: string | null }
interface Batch { id: string; name: string }

export default function JoinRequestsPage() {
  const [requests, setRequests] = useState<JoinRequest[] | null>(null)
  const [batches, setBatches] = useState<Batch[] | null>(null)
  const [batchChoice, setBatchChoice] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  function reload() {
    fetch('/api/academy/join-requests')
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Failed to load join requests')
        setRequests(d.requests ?? [])
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load join requests'))
  }

  useEffect(() => {
    reload()
    fetch('/api/academy/batches').then((r) => r.json()).then((d) => setBatches(d.batches ?? []))
  }, [])

  async function approve(id: string) {
    const batchId = batchChoice[id]
    if (!batchId) { setError('Pick a batch to approve into.'); return }
    setError(''); setBusyId(id)
    try {
      const res = await fetch(`/api/academy/join-requests/${id}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: batchId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to approve')
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve')
    } finally {
      setBusyId(null)
    }
  }

  async function reject(id: string) {
    setError(''); setBusyId(id)
    try {
      const res = await fetch(`/api/academy/join-requests/${id}/reject`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to reject')
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AcademyShell>
      <div className="max-w-[900px] mx-auto p-6 sm:p-8 space-y-5">
        <div>
          <p className={EYEBROW_CLS}>Academy Admin</p>
          <h1 className={H1_CLS}>Join Requests</h1>
        </div>

        {error && <p className="text-sm text-[color:var(--bad)]">{error}</p>}

        {!requests && !error ? (
          <div className="p-8 flex items-center justify-center text-[color:var(--text-dim)]"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : !requests || requests.length === 0 ? (
          <div className={CARD_CLS + ' p-10 text-center text-sm text-[color:var(--text-faint)]'}>No pending join requests.</div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <div key={req.id} className={CARD_CLS + ' p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4'}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold">{req.name}</p>
                  <p className="text-[12px] text-[color:var(--text-dim)] mt-0.5">
                    {req.age != null ? `${req.age} yrs` : 'Age unknown'} · {req.candidate_phone || 'No phone on file'}
                  </p>
                </div>
                <select value={batchChoice[req.id] ?? ''} onChange={(e) => setBatchChoice((s) => ({ ...s, [req.id]: e.target.value }))}
                  className={CONTROL_CLS + ' sm:w-56'}>
                  <option value="">Select a batch…</option>
                  {batches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <div className="flex gap-2 shrink-0">
                  <button type="button" onClick={() => approve(req.id)} disabled={busyId === req.id} className={BTN_AMBER_CLS}>
                    {busyId === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4 inline mr-1" /> Approve</>}
                  </button>
                  <button type="button" onClick={() => reject(req.id)} disabled={busyId === req.id} className={BTN_GHOST_CLS}>
                    <XCircle className="w-4 h-4 inline mr-1" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AcademyShell>
  )
}
