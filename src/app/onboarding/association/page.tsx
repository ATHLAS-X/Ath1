'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { ArrowRight, ArrowLeft, Loader2, CheckCircle2, ShieldAlert } from 'lucide-react'
import { Anton, Barlow, Barlow_Semi_Condensed } from 'next/font/google'
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
 * single-client-component, step-gated-Continue architecture (same pattern
 * /trial-cycles's CreateCycleModal already uses).
 *
 * Presentation-only restyle to the shared orange/Anton-Barlow system used
 * by / and /auth and by the player/coach onboarding wizards — since no
 * dedicated mockup exists for this route, this matches the shared token
 * set and component visual language (fields, optcards, buttons) from
 * Onboarding.html / Coach Onboarding.html rather than any specific file.
 * Scoped exactly the same way: inline CSS vars local to this page, nothing
 * added to globals.css or tailwind.config.ts. Step structure and the POST
 * /api/associations/onboard call are unchanged.
 */

const anton = Anton({ subsets: ['latin'], weight: '400', variable: '--font-anton' })
const barlow = Barlow({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-barlow' })
const barlowSemi = Barlow_Semi_Condensed({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-barlow-semi' })

const ASSOCIATION_VARS = {
  '--bg': '#0D0D0D',
  '--bg-soft': '#141312',
  '--accent': '#FF8A1E',
  '--accent-bright': '#FFA64D',
  '--accent-rgb': '255, 138, 30',
  '--ok': '#38d39f',
  '--bad': '#ff5a4d',
  '--card-border': 'rgba(245, 245, 240, 0.14)',
  '--field-bg': 'rgba(245, 245, 240, 0.06)',
  '--ease': 'cubic-bezier(0.22, 1, 0.36, 1)',
} as React.CSSProperties

const FIELD_CLS = 'bg-[color:var(--field-bg)] border-[color:var(--card-border)] text-white placeholder:text-white/40 h-10 rounded-[9px] focus:border-[color:var(--accent)] focus:bg-white/[0.09]'
const LABEL_CLS = 'font-[family-name:var(--font-barlow-semi)] text-[11px] font-bold uppercase tracking-[0.1em] text-white/70'
const OPTCARD_CLS = (active: boolean) => cn(
  'transition-all border-[1.5px] rounded-[11px]',
  active
    ? 'bg-[rgba(255,138,30,0.14)] border-[color:var(--accent)] text-[color:var(--accent-bright)]'
    : 'bg-[color:var(--field-bg)] border-[color:var(--card-border)] text-white/70 hover:border-white/30',
)

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
    <div className={cn(anton.variable, barlow.variable, barlowSemi.variable)} style={ASSOCIATION_VARS}>
      <div className="min-h-screen bg-[color:var(--bg)] flex flex-col font-[family-name:var(--font-barlow)]">
        <div className="border-b border-[color:var(--card-border)] px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-[family-name:var(--font-barlow-semi)] text-lg font-bold uppercase tracking-[0.1em] text-white">
              Athlas<span className="text-[color:var(--accent)]">X</span>
            </span>
          </Link>
          <div className="font-[family-name:var(--font-barlow-semi)] text-xs uppercase tracking-wide text-white/50">Step {step} of {TOTAL_STEPS}</div>
        </div>

        <div className="h-[3px] bg-[color:var(--card-border)]">
          <motion.div className="h-full" style={{ background: 'linear-gradient(90deg, var(--accent), var(--accent-bright))' }}
            initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
        </div>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-lg">
            <AnimatePresence mode="wait">
              <motion.div key={step} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="space-y-6">

                {step === 1 && (
                  <>
                    <div>
                      <h2 className="font-[family-name:var(--font-anton)] uppercase font-normal text-3xl text-white mb-1">Your association</h2>
                      <p className="text-white/50 text-sm">Tell us about the cricket body you represent</p>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label className={LABEL_CLS}>Association name *</Label>
                        <Input value={form.name} onChange={e => update('name', e.target.value)} placeholder="Uttar Pradesh Cricket Association"
                          className={FIELD_CLS} />
                      </div>
                      <div className="space-y-2">
                        <Label className={LABEL_CLS}>Type *</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {(['state', 'district'] as const).map(t => (
                            <button key={t} type="button" onClick={() => update('type', t)}
                              className={cn('px-3 py-2.5 text-sm font-medium capitalize', OPTCARD_CLS(form.type === t))}>
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className={LABEL_CLS}>State *</Label>
                        <select value={form.state} onChange={e => update('state', e.target.value)}
                          className={cn('w-full px-3', FIELD_CLS)}>
                          <option value="" className="bg-[#141312]">Select state</option>
                          {indianStates.map(s => <option key={s} value={s} className="bg-[#141312]">{s}</option>)}
                        </select>
                      </div>
                      {form.type === 'district' && (
                        <div className="space-y-1.5">
                          <Label className={LABEL_CLS}>Parent state association</Label>
                          <select value={form.parentAssociationId} onChange={e => update('parentAssociationId', e.target.value)}
                            className={cn('w-full px-3', FIELD_CLS)}>
                            <option value="" className="bg-[#141312]">None on file yet (optional)</option>
                            {stateAssociations.map(a => <option key={a.id} value={a.id} className="bg-[#141312]">{a.name} ({a.state})</option>)}
                          </select>
                          <p className="text-[10px] text-white/40">Optional — many district associations don&apos;t have their state body on the platform yet. You can link this later.</p>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {step === 2 && (
                  <>
                    <div>
                      <h2 className="font-[family-name:var(--font-anton)] uppercase font-normal text-3xl text-white mb-1">Staff account</h2>
                      <p className="text-white/50 text-sm">This becomes your association&apos;s first staff login</p>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label className={LABEL_CLS}>Email *</Label>
                        <Input type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="secretary@association.org" autoComplete="email"
                          className={FIELD_CLS} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className={LABEL_CLS}>Password *</Label>
                        <Input type="password" value={form.password} onChange={e => update('password', e.target.value)} placeholder="Choose a password" autoComplete="new-password"
                          className={FIELD_CLS} />
                      </div>
                      <p className="text-[10px] text-white/40">You&apos;ll be the first staff member and lead contact for this association. You can invite more staff after setup.</p>
                    </div>
                  </>
                )}

                {step === 3 && (
                  <>
                    <div>
                      <h2 className="font-[family-name:var(--font-anton)] uppercase font-normal text-3xl text-white mb-1">Data-sharing consent</h2>
                      <p className="text-white/50 text-sm">What you&apos;re actually agreeing to</p>
                    </div>
                    <div className="p-4 rounded-[14px] border border-[color:var(--card-border)] bg-white/[0.02] space-y-3 text-xs text-white/60 leading-relaxed">
                      <p>
                        AthlasX exists to give your association a permanent, evidence-backed record of every player it evaluates — one that survives beyond a single trial cycle. To do that, we need your association&apos;s cooperation on two things:
                      </p>
                      <p>
                        <b className="text-white/90">Historical and ongoing match data.</b> Tournament results, trial registrations, and scorecard data your association already collects or has collected in the past. This can be handed over as files, or synced from a platform you already use (like CricHeroes) — whatever form it&apos;s in.
                      </p>
                      <p>
                        <b className="text-white/90">Approval authority.</b> Ingested data is not visible or scored until someone with access to this association&apos;s account reviews and approves it. Nothing is auto-published.
                      </p>
                      <p>
                        In return, AthlasX builds pre-camp dossiers for your registrants, runs blind grading for your selection committee, and tracks your squads through the season — at no cost to onboard.
                      </p>
                      <p className="text-[color:var(--accent-bright)]">
                        This is a real agreement, not a formality: your association is agreeing to actually share its records with AthlasX, and to have a staff member review ingested data before it counts as verified. If your association isn&apos;t ready to do that yet, you can still explore the platform, but data ingest and trial cycles won&apos;t be meaningful until this is in place.
                      </p>
                    </div>
                    <label className="flex items-start gap-3 p-4 rounded-[11px] border border-[color:var(--card-border)] bg-[color:var(--field-bg)] cursor-pointer">
                      <input type="checkbox" checked={form.dataSharingSigned} onChange={e => update('dataSharingSigned', e.target.checked)} className="w-4 h-4 mt-0.5 accent-[color:var(--accent)]" />
                      <span className="text-sm text-white/80">
                        I have the authority to agree on behalf of this association, and I agree to share the association&apos;s match and trial data with AthlasX as described above.
                      </span>
                    </label>
                  </>
                )}

                {step === 4 && (
                  <>
                    <div>
                      <h2 className="font-[family-name:var(--font-anton)] uppercase font-normal text-3xl text-white mb-1">Review & submit</h2>
                      <p className="text-white/50 text-sm">Confirm before we set up your association</p>
                    </div>
                    <div className="space-y-3">
                      {[
                        { label: 'Association', value: form.name || '—' },
                        { label: 'Type', value: form.type || '—' },
                        { label: 'State', value: form.state || '—' },
                        { label: 'Staff email', value: form.email || '—' },
                        { label: 'Data-sharing consent', value: form.dataSharingSigned ? 'Agreed' : 'Not agreed' },
                      ].map(row => (
                        <div key={row.label} className="flex justify-between text-sm py-2 border-b border-[color:var(--card-border)]">
                          <span className="text-white/50">{row.label}</span>
                          <span className="text-white font-semibold truncate max-w-[220px] text-right capitalize">{row.value}</span>
                        </div>
                      ))}
                    </div>
                    {error && (
                      <div className="flex items-start gap-2 p-3 rounded-[11px] border border-[color:var(--bad)]/30 bg-[color:var(--bad)]/[0.08]">
                        <ShieldAlert className="w-3.5 h-3.5 text-[color:var(--bad)] mt-0.5 shrink-0" />
                        <p className="text-xs text-[color:var(--bad)]">{error}</p>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            </AnimatePresence>

            <div className="flex items-center justify-between mt-8 gap-4">
              {step > 1 ? (
                <button onClick={() => setStep(s => s - 1)}
                  className="font-[family-name:var(--font-barlow-semi)] flex items-center gap-2 px-4 py-2.5 rounded-[9px] bg-transparent border-[1.5px] border-[color:var(--card-border)] text-white/70 hover:text-white hover:border-white/40 text-sm font-bold uppercase tracking-wide transition-colors">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
              ) : <div />}

              <button
                onClick={handleNext}
                disabled={!canProceed || loading}
                className={cn(
                  'font-[family-name:var(--font-barlow-semi)] flex items-center gap-2 px-6 py-2.5 rounded-[9px] text-sm font-bold uppercase tracking-wide transition-all',
                  canProceed && !loading
                    ? 'bg-[color:var(--accent)] text-[#1a0e02] shadow-[0_8px_22px_-8px_rgba(255,138,30,0.7)] hover:bg-[color:var(--accent-bright)]'
                    : 'bg-white/[0.04] border border-[color:var(--card-border)] text-white/40 cursor-not-allowed',
                )}
              >
                {loading ? (<><Loader2 className="w-4 h-4 animate-spin" /> Setting up…</>)
                  : step === TOTAL_STEPS ? (<><CheckCircle2 className="w-4 h-4" /> Create Association</>)
                  : (<>Continue <ArrowRight className="w-4 h-4" /></>)}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
