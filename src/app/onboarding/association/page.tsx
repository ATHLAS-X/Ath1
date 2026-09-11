'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Anton, Barlow, Barlow_Semi_Condensed } from 'next/font/google'
import { ArrowRight, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StepRail } from '@/components/ui/step-rail'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { ASSOCIATION_SELF_SERVE_ENABLED } from '@/lib/feature-flags'

/*
 * Association self-serve onboarding — rebuilt fresh per
 * docs/AthlasX_Association_SelfServe_Fresh_Build_Prompt.md's Prompt 2,
 * deliberately NOT a resurrection of the pre-removal wizard (871b5b9,
 * removed 2026-09-06 for inverting the pivot doc's Ops-verifies-first
 * workflow — see docs/AthlasX_Pivot_Compliance_Audit_and_Role_Prompts.md's
 * Prompt A-1). The field list below is the same shape that version
 * collected (name/type/state/parent, email/password, data-sharing
 * consent) — reused as a reference for what to ask, not as code.
 *
 * The difference that actually matters is server-side, not here: this
 * wizard posts to POST /api/associations/self-serve-onboard (Prompt 3,
 * separate scope — not built yet as of this file), which must create the
 * Association with verification_status: 'pending', not 'approved'. This
 * page has no way to enforce that itself; it only collects the fields and
 * shows whatever the server decides.
 *
 * No phone/OTP step — confirmed directly (grepped src/app/api/associations/
 * onboard/route.ts, the existing Ops-only route) that association-role
 * account creation has never used phone/WhatsApp OTP verification, unlike
 * academy/coach/scout. Email+password only, same as that Ops route already
 * collects for the new staff account.
 *
 * Visual system matches player/coach/academy/scout onboarding — same
 * OB_VARS/FIELD_CLS/LABEL_CLS/OPTCARD_CLS token convention (see
 * src/app/academy/onboarding/page.tsx), not a fresh design.
 */

const anton = Anton({ subsets: ['latin'], weight: '400', variable: '--font-anton' })
const barlow = Barlow({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-barlow' })
const barlowSemi = Barlow_Semi_Condensed({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-barlow-semi' })

const OB_VARS = {
  '--bg': '#0D0D0D',
  '--bg-soft': '#141312',
  '--text': '#F5F5F0',
  '--text-dim': 'rgba(245, 245, 240, 0.62)',
  '--text-faint': 'rgba(245, 245, 240, 0.4)',
  '--accent': '#FF8A1E',
  '--accent-bright': '#FFA64D',
  '--ov08': 'rgba(255, 138, 30, 0.08)',
  '--ov14': 'rgba(255, 138, 30, 0.14)',
  '--ov22': 'rgba(255, 138, 30, 0.22)',
  '--card-border': 'rgba(245, 245, 240, 0.14)',
  '--field-bg': 'rgba(245, 245, 240, 0.06)',
  '--ok': '#38d39f',
  '--bad': '#ff5a4d',
} as React.CSSProperties

const FIELD_CLS = 'bg-[color:var(--field-bg)] border-[color:var(--card-border)] text-[color:var(--text)] placeholder:text-[color:var(--text-faint)] h-[42px] rounded-[9px] focus:border-[color:var(--accent)] focus:bg-white/[0.09]'
const LABEL_CLS = 'font-[family-name:var(--font-barlow-semi)] text-[10.5px] font-bold uppercase tracking-[0.12em] text-[color:var(--text-dim)]'
const OPTCARD_CLS = (active: boolean) => cn(
  'transition-all border-[1.5px] rounded-[11px] px-3.5 py-3 text-left',
  active
    ? 'bg-[color:var(--ov14)] border-[color:var(--accent)]'
    : 'bg-[color:var(--field-bg)] border-[color:var(--card-border)] hover:border-white/30',
)

const TOTAL_STEPS = 3
const STEPS = [
  { key: 'account', label: 'Account', sublabel: 'Email + password' },
  { key: 'identity', label: 'Association Identity', sublabel: 'Name, type, location' },
  { key: 'consent', label: 'Data-Sharing Consent', sublabel: 'Review & submit' },
]
const STATES = ['Andhra Pradesh', 'Assam', 'Bihar', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal']

interface StateAssociation {
  id: string
  name: string
  state: string
}

export default function AssociationOnboardingPage() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [transitioning, setTransitioning] = useState(false)
  const [done, setDone] = useState(false)
  const router = useRouter()

  // Re-entry lock — see academy/coach/player onboarding's identical
  // locksRef for why a ref (not state) is needed here.
  const locksRef = useRef<Set<string>>(new Set())

  // Step 1 — Account
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Step 2 — Association identity
  const [name, setName] = useState('')
  const [type, setType] = useState<'state' | 'district'>('district')
  const [state, setState] = useState('')
  const [parentAssociationId, setParentAssociationId] = useState('')
  const [stateAssociations, setStateAssociations] = useState<StateAssociation[]>([])

  // Step 3 — Consent
  const [dataSharingSigned, setDataSharingSigned] = useState(false)
  const [scrolledConsent, setScrolledConsent] = useState(false)

  useEffect(() => {
    // Public endpoint (src/app/api/associations/state-list/route.ts) —
    // a district association picking its optional parent needs this
    // before it has any account of its own.
    fetch('/api/associations/state-list')
      .then((r) => r.json())
      .then((d) => setStateAssociations(d.associations ?? []))
      .catch(() => { /* parent-association picker is optional; a failed
        fetch just leaves the list empty, not a blocking error */ })
  }, [])

  function canProceed() {
    if (step === 1) return Boolean(email && password.length >= 10)
    if (step === 2) return Boolean(name && type && state)
    return dataSharingSigned && scrolledConsent
  }

  function handleConsentScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 24) setScrolledConsent(true)
  }

  async function handleNext() {
    if (!canProceed()) return
    if (locksRef.current.has('step-advance')) return
    locksRef.current.add('step-advance')

    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1)
      setTransitioning(true)
      setTimeout(() => { locksRef.current.delete('step-advance'); setTransitioning(false) }, 300)
      return
    }

    setLoading(true); setError('')
    try {
      const res = await fetch('/api/associations/self-serve-onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, type, state,
          parentAssociationId: type === 'district' ? parentAssociationId || undefined : undefined,
          email, password,
          dataSharingSigned,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to set up your association')
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set up your association')
    } finally {
      setLoading(false)
      locksRef.current.delete('step-advance')
    }
  }

  const progress = (step / TOTAL_STEPS) * 100

  // Off by default — see feature-flags.ts's ASSOCIATION_SELF_SERVE_ENABLED
  // comment. Don't flip it until the pending-verification gate (Prompt 3)
  // is built and proven, or this silently reopens the exact hole Prompt
  // A-1 closed. Checked after all hooks, before any other early return.
  if (!ASSOCIATION_SELF_SERVE_ENABLED) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-3">
          <ShieldAlert className="w-8 h-8 text-zinc-600 mx-auto" />
          <h1 className="text-xl font-bold text-white">Sign-up isn&apos;t self-serve yet</h1>
          <p className="text-sm text-zinc-500">
            AthlasX Ops sets up a new association directly after your data-sharing agreement is verified — this keeps every
            association&apos;s record trustworthy for everyone downstream. Reach out to AthlasX to get your association set up.
          </p>
          <Link href="/" className="inline-block mt-2 text-sm font-bold text-[#FFA64D] hover:text-[#FF8A1E]">Back to AthlasX</Link>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className={cn(anton.variable, barlow.variable, barlowSemi.variable)} style={OB_VARS}>
        <div className="min-h-screen flex items-center justify-center bg-[color:var(--bg)] font-[family-name:var(--font-barlow)] text-[color:var(--text)] p-6">
          <div className="max-w-md w-full text-center space-y-4">
            <CheckCircle2 className="w-10 h-10 text-[color:var(--ok)] mx-auto" />
            <h1 className="font-[family-name:var(--font-anton)] uppercase text-2xl">Submitted for verification</h1>
            <p className="text-sm text-[color:var(--text-dim)] leading-relaxed">
              {name} is now signed up, pending AthlasX Ops verification of your data-sharing agreement. You&apos;re signed in — you&apos;ll see full
              access to your association&apos;s dashboard the moment Ops approves it.
            </p>
            <button onClick={() => router.push('/')} className="inline-flex items-center gap-1.5 mt-2 text-sm font-bold text-[color:var(--accent-bright)] hover:text-[color:var(--accent)]">
              Continue to AthlasX <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(anton.variable, barlow.variable, barlowSemi.variable)} style={OB_VARS}>
      <div className="h-screen grid lg:grid-cols-[1fr_2fr] bg-[color:var(--bg)] font-[family-name:var(--font-barlow)] text-[color:var(--text)]">
        {/* ── LEFT RAIL ── */}
        <aside className="relative overflow-hidden flex flex-col p-8 lg:p-[2.618rem] bg-[color:var(--bg-soft)]">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(120% 80% at 0% 0%, var(--ov14), transparent 55%), radial-gradient(110% 70% at 0% 100%, var(--ov08), transparent 55%), linear-gradient(180deg, rgba(16,26,20,0.5) 0%, rgba(26,14,10,0.55) 100%)',
            }}
          />
          <div className="relative z-10 flex flex-col flex-1">
            <div className="font-[family-name:var(--font-barlow-semi)] uppercase tracking-[0.22em] font-bold text-[0.95rem] text-[color:var(--text)]">
              ATHLAS<span className="text-[color:var(--accent)]">X</span>
            </div>
            <div className="mt-6">
              <p className="font-[family-name:var(--font-barlow-semi)] uppercase tracking-[0.2em] text-[11px] font-bold text-[color:var(--accent-bright)] mb-1.5">Association Onboarding</p>
              <h1 className="font-[family-name:var(--font-anton)] uppercase font-normal leading-[0.92] text-[42px] text-[color:var(--text)]">
                Set up your <b className="text-[color:var(--accent)] font-normal">association.</b>
              </h1>
              <p className="mt-3.5 text-sm leading-relaxed text-[color:var(--text-dim)] max-w-[22rem]">
                Three steps. Your account starts pending — AthlasX Ops verifies your data-sharing agreement before your dashboard unlocks.
              </p>
            </div>

            <StepRail steps={STEPS} currentIndex={step - 1} className="mt-8" />
          </div>
        </aside>

        {/* ── RIGHT PANEL ── */}
        <main className="relative flex flex-col min-w-0 min-h-0">
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(110% 50% at 100% 0%, var(--ov08), transparent 55%)' }} />

          <div className="relative z-20 h-[3px] bg-[color:var(--card-border)]">
            <motion.div className="h-full" style={{ background: 'linear-gradient(90deg, var(--accent), var(--accent-bright))' }}
              initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.5 }} />
          </div>

          <div className="relative z-10 flex-1 overflow-y-auto">
            <div className="w-full max-w-[36rem] mx-auto px-6 sm:px-10 py-8 sm:py-10">
              <AnimatePresence mode="wait">
                <motion.div key={step} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.25 }} style={{ pointerEvents: transitioning ? 'none' : 'auto' }}>

                  {step === 1 && (
                    <>
                      <p className="font-[family-name:var(--font-barlow-semi)] uppercase tracking-[0.18em] text-[11px] font-bold text-[color:var(--accent-bright)] mb-1.5">Step {step} of {TOTAL_STEPS}</p>
                      <h2 className="font-[family-name:var(--font-anton)] uppercase font-normal leading-[0.92] text-[40px] text-[color:var(--text)] mb-2">Create your account</h2>
                      <p className="text-sm leading-relaxed text-[color:var(--text-dim)] max-w-[32rem] mb-7">
                        This is the account your association&apos;s nominated staff member signs in with. No phone verification needed for this role.
                      </p>

                      <div className="space-y-4">
                        <div>
                          <Label className={LABEL_CLS}>Email<span className="text-[color:var(--accent)] ml-0.5">*</span></Label>
                          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="secretary@association.org" autoComplete="email"
                            className={cn(FIELD_CLS, 'mt-1.5')} />
                        </div>
                        <div>
                          <Label className={LABEL_CLS}>Password<span className="text-[color:var(--accent)] ml-0.5">*</span></Label>
                          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Choose a password" autoComplete="new-password" minLength={10}
                            className={cn(FIELD_CLS, 'mt-1.5')} />
                          <p className="text-[11px] text-[color:var(--text-faint)] mt-1">At least 10 characters, with letters and numbers.</p>
                        </div>
                      </div>
                    </>
                  )}

                  {step === 2 && (
                    <>
                      <p className="font-[family-name:var(--font-barlow-semi)] uppercase tracking-[0.18em] text-[11px] font-bold text-[color:var(--accent-bright)] mb-1.5">Step {step} of {TOTAL_STEPS}</p>
                      <h2 className="font-[family-name:var(--font-anton)] uppercase font-normal leading-[0.92] text-[40px] text-[color:var(--text)] mb-2">Association identity</h2>
                      <p className="text-sm leading-relaxed text-[color:var(--text-dim)] max-w-[32rem] mb-7">Tell us who you are and where you operate.</p>

                      <div className="space-y-4">
                        <div>
                          <Label className={LABEL_CLS}>Association Name<span className="text-[color:var(--accent)] ml-0.5">*</span></Label>
                          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Uttar Pradesh Cricket Association" className={cn(FIELD_CLS, 'mt-1.5')} />
                        </div>

                        <div>
                          <Label className={LABEL_CLS}>Type<span className="text-[color:var(--accent)] ml-0.5">*</span></Label>
                          <div className="grid grid-cols-2 gap-2 mt-1.5">
                            <button type="button" onClick={() => setType('state')} className={OPTCARD_CLS(type === 'state')}>
                              <span className="block text-sm font-bold text-[color:var(--text)]">State</span>
                              <span className="block text-[11px] text-[color:var(--text-dim)]">Covers a whole state</span>
                            </button>
                            <button type="button" onClick={() => setType('district')} className={OPTCARD_CLS(type === 'district')}>
                              <span className="block text-sm font-bold text-[color:var(--text)]">District</span>
                              <span className="block text-[11px] text-[color:var(--text-dim)]">Covers one district</span>
                            </button>
                          </div>
                        </div>

                        <div>
                          <Label className={LABEL_CLS}>State<span className="text-[color:var(--accent)] ml-0.5">*</span></Label>
                          <select value={state} onChange={(e) => setState(e.target.value)}
                            className={cn(FIELD_CLS, 'mt-1.5 w-full px-3.5 text-sm bg-[color:var(--field-bg)] border-[color:var(--card-border)] rounded-[9px] appearance-none')}>
                            <option value="" className="bg-[#1a1a1a]">Select state…</option>
                            {STATES.map((s) => <option key={s} value={s} className="bg-[#1a1a1a]">{s}</option>)}
                          </select>
                        </div>

                        {type === 'district' && (
                          <div>
                            <Label className={LABEL_CLS}>Parent State Association <span className="text-[color:var(--text-faint)] normal-case font-normal">(optional)</span></Label>
                            <select value={parentAssociationId} onChange={(e) => setParentAssociationId(e.target.value)}
                              className={cn(FIELD_CLS, 'mt-1.5 w-full px-3.5 text-sm bg-[color:var(--field-bg)] border-[color:var(--card-border)] rounded-[9px] appearance-none')}>
                              <option value="" className="bg-[#1a1a1a]">Not sure / none on file yet</option>
                              {stateAssociations.map((a) => <option key={a.id} value={a.id} className="bg-[#1a1a1a]">{a.name} ({a.state})</option>)}
                            </select>
                            <p className="text-[11px] text-[color:var(--text-faint)] mt-1">Not every district association has one on file yet — leave this if yours doesn&apos;t.</p>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {step === 3 && (
                    <>
                      <p className="font-[family-name:var(--font-barlow-semi)] uppercase tracking-[0.18em] text-[11px] font-bold text-[color:var(--accent-bright)] mb-1.5">Step {step} of {TOTAL_STEPS}</p>
                      <h2 className="font-[family-name:var(--font-anton)] uppercase font-normal leading-[0.92] text-[40px] text-[color:var(--text)] mb-2">Data-sharing consent</h2>
                      <p className="text-sm leading-relaxed text-[color:var(--text-dim)] max-w-[32rem] mb-5">
                        Read this in full before submitting — it&apos;s the actual agreement, not a formality.
                      </p>

                      <div
                        onScroll={handleConsentScroll}
                        className="max-h-[15rem] overflow-y-auto p-4 rounded-[11px] border border-[color:var(--card-border)] bg-[color:var(--field-bg)] text-sm text-[color:var(--text-dim)] leading-relaxed space-y-3 mb-4"
                      >
                        <p>
                          By submitting this form, {name || 'your association'} agrees to share its tournament fixtures, scorecards, and
                          registered-player data with AthlasX for the purpose of building verified player records and enabling talent
                          identification within the association pathway.
                        </p>
                        <p>
                          Submitting does not grant your account real access immediately. Every association on AthlasX — self-serve or
                          not — starts in a <b className="text-[color:var(--text)]">pending</b> state. AthlasX Ops reviews and verifies this
                          agreement before your account can see or manage any real association-scoped data. You will be signed in once you
                          submit, but you will see a holding screen, not your dashboard, until that verification completes.
                        </p>
                        <p>
                          AthlasX does not sell your association&apos;s data to third parties. Player data shared through this agreement is
                          used only to compute verified performance records and AthlasX Scores, and to make players discoverable to
                          selection panels and (where a player has separately opted in) other associations or scouts, per each player&apos;s
                          own visibility setting — never to advertise, resell, or share with any party outside AthlasX&apos;s verified
                          pathway.
                        </p>
                        <p>
                          You can request a copy of this agreement, or ask AthlasX to stop processing your association&apos;s data, at any
                          time by contacting AthlasX Ops directly. This does not retroactively delete verified match records already
                          contributed to a player&apos;s history.
                        </p>
                      </div>

                      <label className={cn(
                        'flex items-start gap-2.5 p-3 rounded-[9px] border-[1.5px] cursor-pointer transition-colors',
                        !scrolledConsent ? 'border-[color:var(--card-border)] opacity-50 cursor-not-allowed' : dataSharingSigned ? 'border-[color:var(--accent)] bg-[color:var(--ov14)]' : 'border-[color:var(--card-border)] hover:border-white/30',
                      )}>
                        <input type="checkbox" disabled={!scrolledConsent} checked={dataSharingSigned}
                          onChange={(e) => setDataSharingSigned(e.target.checked)}
                          className="mt-0.5 w-[15px] h-[15px] accent-[color:var(--accent)]" />
                        <span className="text-sm text-[color:var(--text)]">
                          I have read the agreement above and confirm {name || 'my association'} agrees to share its data with AthlasX under
                          these terms.
                        </span>
                      </label>
                      {!scrolledConsent && (
                        <p className="text-[11px] text-[color:var(--text-faint)] mt-1.5">Scroll to the end of the agreement to enable this checkbox.</p>
                      )}
                    </>
                  )}

                  {error && (
                    <div className="flex items-start gap-2 p-3 mt-4 rounded-[9px] border border-[color:var(--bad)]/30 bg-[color:var(--bad)]/[0.08]">
                      <ShieldAlert className="w-3.5 h-3.5 text-[color:var(--bad)] mt-0.5 shrink-0" />
                      <p className="text-xs text-[color:var(--bad)]">{error}</p>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <div className="relative z-10 border-t border-[color:var(--card-border)] px-6 sm:px-10 py-4 flex items-center justify-between">
            {step > 1 ? (
              <button type="button" onClick={() => setStep((s) => s - 1)} className="text-sm font-bold text-[color:var(--text-dim)] hover:text-[color:var(--text)]">Back</button>
            ) : <span />}
            <button
              type="button" onClick={handleNext} disabled={!canProceed() || loading}
              className="font-[family-name:var(--font-barlow-semi)] px-6 py-3 rounded-[10px] text-sm font-bold uppercase tracking-wide bg-[color:var(--accent)] text-[#1a0e02] hover:bg-[color:var(--accent-bright)] transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? 'Submitting…' : step < TOTAL_STEPS ? 'Continue' : 'Submit for Verification'}
              {!loading && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </main>
      </div>
    </div>
  )
}
