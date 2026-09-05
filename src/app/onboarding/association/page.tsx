'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { ArrowRight, ArrowLeft, Loader2, Zap, CheckCircle2, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { toast } from 'sonner'

/*
 * Self-serve association onboarding — the first real path to creating an
 * Association row and its first AssociationStaff member. Previously
 * associations existed only as seeded rows with staff membership inserted
 * directly (see docs/AthlasX_System_Design_and_Functionality_Reference.md
 * §4) — there was no application-level way to create either.
 *
 * No dedicated association-onboarding mockup was assigned in
 * design/import/MAPPING.md, so this follows /onboarding's own
 * single-client-component, step-gated-Continue architecture (same
 * pattern /trial-cycles's CreateCycleModal already uses) rather than the
 * design import's rail/stepper visual layout — and uses the app's
 * existing tokens (glass-card, --ax-green) rather than any mockup's
 * palette, consistent with the still-open design-system decision in
 * design/import/MAPPING.md.
 */

const TOTAL_STEPS = 4

const indianStates = [
  'Andhra Pradesh', 'Assam', 'Bihar', 'Delhi', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana',
  'Uttar Pradesh', 'West Bengal',
]

interface StateAssociation { id: string; name: string; state: string }

export default function AssociationOnboardingPage() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [stateAssociations, setStateAssociations] = useState<StateAssociation[]>([])
  const router = useRouter()

  const [form, setForm] = useState({
    name: '', type: '' as '' | 'state' | 'district', state: '', parentAssociationId: '',
    email: '', password: '',
    dataSharingSigned: false,
  })

  useEffect(() => {
    if (form.type !== 'district') return
    fetch('/api/associations/state-list')
      .then(r => r.json())
      .then(d => setStateAssociations(d.associations ?? []))
  }, [form.type])

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function canProceedStep1() {
    return Boolean(form.name && form.type && form.state)
  }
  function canProceedStep2() {
    return Boolean(form.email && form.password)
  }
  function canProceedStep3() {
    return form.dataSharingSigned
  }

  async function handleNext() {
    if (step === 1 && !canProceedStep1()) return
    if (step === 2 && !canProceedStep2()) return
    if (step === 3 && !canProceedStep3()) return
    if (step < TOTAL_STEPS) { setStep(s => s + 1); return }

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/associations/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          type: form.type,
          state: form.state,
          parentAssociationId: form.parentAssociationId || undefined,
          email: form.email,
          password: form.password,
          dataSharingSigned: form.dataSharingSigned,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to set up your association')
      toast.success('Association set up. Welcome to AthlasX.')
      // 'association' role's rootDestination is /dashboard (src/lib/chrome.ts) — verified, not assumed.
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set up your association')
    } finally {
      setLoading(false)
    }
  }

  const canProceed = step === 1 ? canProceedStep1() : step === 2 ? canProceedStep2() : step === 3 ? canProceedStep3() : true
  const progress = (step / TOTAL_STEPS) * 100

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col">
      <div className="border-b border-white/[0.05] px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-400 to-emerald-700 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white fill-white" />
          </div>
          <span className="text-xl font-black tracking-tight">
            Athlas<span className="text-gradient-green">X</span>
          </span>
        </Link>
        <div className="text-xs text-zinc-500">Step {step} of {TOTAL_STEPS}</div>
      </div>

      <div className="h-0.5 bg-white/[0.05]">
        <motion.div className="h-full bg-gradient-to-r from-green-600 to-emerald-400" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="space-y-6">

              {step === 1 && (
                <>
                  <div>
                    <h2 className="text-3xl font-black text-white mb-1">Your association</h2>
                    <p className="text-zinc-500 text-sm">Tell us about the cricket body you represent</p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-zinc-400 text-sm">Association name *</Label>
                      <Input value={form.name} onChange={e => update('name', e.target.value)} placeholder="Uttar Pradesh Cricket Association"
                        className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-zinc-400 text-sm">Type *</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {(['state', 'district'] as const).map(t => (
                          <button key={t} type="button" onClick={() => update('type', t)}
                            className={cn('px-3 py-2.5 rounded-xl text-sm font-medium border transition-all capitalize',
                              form.type === t ? 'bg-green-500/15 border-green-500/40 text-green-400' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:bg-white/[0.06]')}>
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-zinc-400 text-sm">State *</Label>
                      <select value={form.state} onChange={e => update('state', e.target.value)}
                        className="w-full h-10 px-3 rounded-xl bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-green-500/50">
                        <option value="" className="bg-zinc-900">Select state</option>
                        {indianStates.map(s => <option key={s} value={s} className="bg-zinc-900">{s}</option>)}
                      </select>
                    </div>
                    {form.type === 'district' && (
                      <div className="space-y-1.5">
                        <Label className="text-zinc-400 text-sm">Parent state association</Label>
                        <select value={form.parentAssociationId} onChange={e => update('parentAssociationId', e.target.value)}
                          className="w-full h-10 px-3 rounded-xl bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-green-500/50">
                          <option value="" className="bg-zinc-900">None on file yet (optional)</option>
                          {stateAssociations.map(a => <option key={a.id} value={a.id} className="bg-zinc-900">{a.name} ({a.state})</option>)}
                        </select>
                        <p className="text-[10px] text-zinc-700">Optional — many district associations don&apos;t have their state body on the platform yet. You can link this later.</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div>
                    <h2 className="text-3xl font-black text-white mb-1">Staff account</h2>
                    <p className="text-zinc-500 text-sm">This becomes your association&apos;s first staff login</p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-zinc-400 text-sm">Email *</Label>
                      <Input type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="secretary@association.org" autoComplete="email"
                        className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-zinc-400 text-sm">Password *</Label>
                      <Input type="password" value={form.password} onChange={e => update('password', e.target.value)} placeholder="Choose a password" autoComplete="new-password"
                        className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50" />
                    </div>
                    <p className="text-[10px] text-zinc-700">You&apos;ll be the first staff member and lead contact for this association. You can invite more staff after setup.</p>
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <div>
                    <h2 className="text-3xl font-black text-white mb-1">Data-sharing consent</h2>
                    <p className="text-zinc-500 text-sm">What you&apos;re actually agreeing to</p>
                  </div>
                  <div className="p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] space-y-3 text-xs text-zinc-400 leading-relaxed">
                    <p>
                      AthlasX exists to give your association a permanent, evidence-backed record of every player it evaluates — one that survives beyond a single trial cycle. To do that, we need your association&apos;s cooperation on two things:
                    </p>
                    <p>
                      <b className="text-zinc-200">Historical and ongoing match data.</b> Tournament results, trial registrations, and scorecard data your association already collects or has collected in the past. This can be handed over as files, or synced from a platform you already use (like CricHeroes) — whatever form it&apos;s in.
                    </p>
                    <p>
                      <b className="text-zinc-200">Approval authority.</b> Ingested data is not visible or scored until someone with access to this association&apos;s account reviews and approves it. Nothing is auto-published.
                    </p>
                    <p>
                      In return, AthlasX builds pre-camp dossiers for your registrants, runs blind grading for your selection committee, and tracks your squads through the season — at no cost to onboard.
                    </p>
                    <p className="text-amber-300/80">
                      This is a real agreement, not a formality: your association is agreeing to actually share its records with AthlasX, and to have a staff member review ingested data before it counts as verified. If your association isn&apos;t ready to do that yet, you can still explore the platform, but data ingest and trial cycles won&apos;t be meaningful until this is in place.
                    </p>
                  </div>
                  <label className="flex items-start gap-3 p-4 rounded-xl border border-white/10 bg-white/[0.03] cursor-pointer">
                    <input type="checkbox" checked={form.dataSharingSigned} onChange={e => update('dataSharingSigned', e.target.checked)} className="w-4 h-4 mt-0.5 accent-green-500" />
                    <span className="text-sm text-zinc-300">
                      I have the authority to agree on behalf of this association, and I agree to share the association&apos;s match and trial data with AthlasX as described above.
                    </span>
                  </label>
                </>
              )}

              {step === 4 && (
                <>
                  <div>
                    <h2 className="text-3xl font-black text-white mb-1">Review & submit</h2>
                    <p className="text-zinc-500 text-sm">Confirm before we set up your association</p>
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: 'Association', value: form.name || '—' },
                      { label: 'Type', value: form.type || '—' },
                      { label: 'State', value: form.state || '—' },
                      { label: 'Staff email', value: form.email || '—' },
                      { label: 'Data-sharing consent', value: form.dataSharingSigned ? 'Agreed' : 'Not agreed' },
                    ].map(row => (
                      <div key={row.label} className="flex justify-between text-sm py-2 border-b border-white/[0.05]">
                        <span className="text-zinc-500">{row.label}</span>
                        <span className="text-zinc-200 font-semibold truncate max-w-[220px] text-right capitalize">{row.value}</span>
                      </div>
                    ))}
                  </div>
                  {error && (
                    <div className="flex items-start gap-2 p-3 rounded-xl border border-red-500/20 bg-red-500/[0.06]">
                      <ShieldAlert className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                      <p className="text-xs text-red-400">{error}</p>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between mt-8 gap-4">
            {step > 1 ? (
              <button onClick={() => setStep(s => s - 1)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-zinc-400 hover:text-white text-sm font-medium transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            ) : <div />}

            <button
              onClick={handleNext}
              disabled={!canProceed || loading}
              className={cn('flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all',
                canProceed && !loading ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-white/[0.04] border border-white/[0.08] text-zinc-600 cursor-not-allowed')}
            >
              {loading ? (<><Loader2 className="w-4 h-4 animate-spin" /> Setting up…</>)
                : step === TOTAL_STEPS ? (<><CheckCircle2 className="w-4 h-4" /> Create Association</>)
                : (<>Continue <ArrowRight className="w-4 h-4" /></>)}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
