'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'

/**
 * AthlasX-Ops-only tool for creating an Association + its first
 * AssociationStaff member — replaces the removed public self-serve
 * /onboarding/association flow (docs/AthlasX_Pivot_Compliance_Audit_and_Role_Prompts.md
 * Prompt A-1, decision: path a). POST /api/associations/onboard now
 * requires athlasx_ops auth, matching the pivot doc's W1 workflow: this
 * page exists for the Ops person who has ALREADY verified a real,
 * offline-signed data-sharing agreement — the confirmation checkbox below
 * is that Ops person's attestation, not the association's own.
 *
 * Access is enforced server-side twice: ops/layout.tsx returns 404 for
 * anyone who isn't athlasx_ops before this page ever mounts, and the API
 * route calls requireRole.
 */

const STATES = ['Andhra Pradesh', 'Assam', 'Bihar', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal']

export default function CreateAssociationPage() {
  const [name, setName] = useState('')
  const [type, setType] = useState<'state' | 'district'>('state')
  const [state, setState] = useState(STATES[0])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verified, setVerified] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ associationId: string; staffUserId: string } | null>(null)

  async function submit() {
    setError('')
    if (!name.trim() || !state || !email.trim() || !password) {
      setError('Association name, state, staff email and password are all required.')
      return
    }
    if (!verified) {
      setError('You must confirm the data-sharing agreement has actually been verified.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/associations/onboard', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type, state, email, password, dataSharingSigned: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create association')
      setResult(data)
      setName(''); setEmail(''); setPassword(''); setVerified(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create association')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5 max-w-xl">
      <div>
        <h1 className="text-xl font-black text-white">Create Association</h1>
        <p className="text-xs text-zinc-600 mt-0.5">Only use this after a real, offline-verified data-sharing agreement is on file.</p>
      </div>

      <div className="glass-card p-5 space-y-4">
        <div>
          <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1.5">Association name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Uttar Pradesh Cricket Association"
            className="w-full h-10 px-3 rounded-xl bg-white/[0.05] border border-white/10 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-green-500/50" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1.5">Type *</label>
            <div className="flex gap-2">
              {(['state', 'district'] as const).map((t) => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={`flex-1 h-10 rounded-xl text-sm font-bold border transition-colors capitalize ${type === t ? 'bg-ax-accent/15 border-ax-accent/40 text-ax-accentBright' : 'bg-white/[0.03] border-white/10 text-zinc-400'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1.5">State *</label>
            <select value={state} onChange={(e) => setState(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-green-500/50">
              {STATES.map((s) => <option key={s} value={s} className="bg-zinc-900">{s}</option>)}
            </select>
          </div>
        </div>

        <div className="pt-2 border-t border-white/[0.06] space-y-4">
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide">First staff account</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1.5">Email *</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="staff@association.org"
                className="w-full h-10 px-3 rounded-xl bg-white/[0.05] border border-white/10 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-green-500/50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1.5">Temporary password *</label>
              <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Hand this to the staff member out of band"
                className="w-full h-10 px-3 rounded-xl bg-white/[0.05] border border-white/10 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-green-500/50" />
            </div>
          </div>
        </div>

        <label className="flex items-start gap-2.5 p-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] cursor-pointer">
          <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} className="mt-0.5" />
          <span className="text-xs text-zinc-300">I have personally verified a real, signed data-sharing agreement with this association — this is not a self-attestation by the association itself.</span>
        </label>

        {error && <p className="text-xs text-red-400">{error}</p>}
        {result && (
          <div className="flex items-start gap-2 p-3 rounded-xl border border-green-500/25 bg-green-500/[0.06]">
            <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
            <p className="text-xs text-green-300">Association created. Staff account id <span className="font-mono">{result.staffUserId}</span> — hand the email/password to the association&apos;s nominated staff member directly.</p>
          </div>
        )}

        <button type="button" onClick={submit} disabled={submitting}
          className="w-full h-11 rounded-xl bg-ax-accent text-[#1a0e02] font-bold text-sm hover:bg-ax-accentBright disabled:opacity-50 transition-colors">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Create Association'}
        </button>
      </div>
    </div>
  )
}
