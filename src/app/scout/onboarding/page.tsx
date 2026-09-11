'use client'

import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Anton, Barlow, Barlow_Semi_Condensed } from 'next/font/google'
import { ArrowRight, Loader2, CheckCircle2, ShieldAlert, Building2, Landmark, UserRound } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StepRail } from '@/components/ui/step-rail'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { SCOUT_SELF_SERVE_ENABLED } from '@/lib/feature-flags'

/*
 * Scout self-serve onboarding — built from scratch as a 2-step wizard
 * (Account, Organization), not 5 padded down to 2. The Academy wizard's
 * old Steps 3-4 taught a concrete lesson worth not repeating here: every
 * field in this file is sent to POST /api/scout/onboard and persisted on
 * ScoutProfile (prisma/schema.prisma) — nothing decorative-only.
 *
 * Player-data safety for what a scout can see is NOT decided or enforced
 * anywhere in this file. It's already independently hard-enforced in
 * src/lib/player-visibility.ts: FRANCHISE_SCOUT_ENABLED + isAdult(player.dob),
 * checked at three separate points, excluding every minor regardless of
 * this wizard, this role, or this flag. This file only creates the
 * account; it grants no player-data access by itself.
 *
 * Visual language matches the shared orange/Anton-Barlow onboarding system
 * used by player/coach/academy onboarding — no dedicated Scout mockup
 * exists, so this follows their shared token set and component patterns
 * directly (same as the original association wizard's approach to an
 * unassigned mockup).
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
  'transition-all border-[1.5px] rounded-[11px]',
  active
    ? 'bg-[color:var(--ov14)] border-[color:var(--accent)]'
    : 'bg-[color:var(--field-bg)] border-[color:var(--card-border)] hover:border-white/30',
)

const TOTAL_STEPS = 2
const STEPS = [
  { key: 'account', label: 'Account', sublabel: 'Phone + OTP' },
  { key: 'organization', label: 'Organization', sublabel: 'Who you scout for' },
]

const ORG_TYPES = [
  { v: 'franchise', label: 'Franchise', s: 'Professional league team', icon: Building2 },
  { v: 'academy_recruiting_arm', label: 'Academy Recruiting Arm', s: 'Scouting for an academy', icon: Landmark },
  { v: 'independent', label: 'Independent', s: 'Freelance / unaffiliated', icon: UserRound },
]

export default function ScoutOnboardingPage() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [transitioning, setTransitioning] = useState(false)
  const [done, setDone] = useState(false)
  const router = useRouter()

  const locksRef = useRef<Set<string>>(new Set())

  // Step 1 — Account
  const [mobile, setMobile] = useState('')
  const [otpRequestId, setOtpRequestId] = useState('')
  const [otpDevCode, setOtpDevCode] = useState('')
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', ''])
  const [otpVerified, setOtpVerified] = useState(false)
  const [sendingOtp, setSendingOtp] = useState(false)
  const [verifyingOtp, setVerifyingOtp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  // Step 2 — Organization
  const [orgName, setOrgName] = useState('')
  const [orgType, setOrgType] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')

  async function sendOtp() {
    if (locksRef.current.has('send-otp')) return
    locksRef.current.add('send-otp')
    try {
      await sendOtpImpl()
    } finally {
      locksRef.current.delete('send-otp')
    }
  }

  async function sendOtpImpl() {
    if (mobile.replace(/\D/g, '').length !== 10) { setError('Enter a valid 10-digit mobile number.'); return }
    setSendingOtp(true); setError('')
    try {
      const res = await fetch('/api/scout/onboard/send-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not send OTP')
      setOtpRequestId(data.requestId)
      setOtpDevCode(data.devCode)
      setTimeout(() => otpRefs.current[0]?.focus(), 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send OTP')
    } finally {
      setSendingOtp(false)
    }
  }

  function setOtpDigit(i: number, v: string) {
    const digit = v.replace(/\D/g, '').slice(0, 1)
    setOtpDigits(d => { const next = [...d]; next[i] = digit; return next })
    if (digit && otpRefs.current[i + 1]) otpRefs.current[i + 1]?.focus()
  }

  async function verifyOtp() {
    if (locksRef.current.has('verify-otp')) return
    locksRef.current.add('verify-otp')
    try {
      await verifyOtpImpl()
    } finally {
      locksRef.current.delete('verify-otp')
    }
  }

  async function verifyOtpImpl() {
    setVerifyingOtp(true); setError('')
    try {
      // Client-side check against the dev code only decides whether to let
      // the user proceed in the UI — the account is only ever created
      // after the server independently re-verifies via verifyScoutOtp()
      // in POST /api/scout/onboard.
      if (otpDigits.join('') !== otpDevCode) throw new Error('Incorrect OTP')
      setOtpVerified(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Incorrect OTP')
    } finally {
      setVerifyingOtp(false)
    }
  }

  function canProceed() {
    if (step === 1) return otpVerified && Boolean(email && password)
    if (step === 2) return Boolean(orgName && orgType)
    return true
  }

  async function handleNext() {
    if (!canProceed()) return
    if (locksRef.current.has('step-advance')) return
    locksRef.current.add('step-advance')

    if (step < TOTAL_STEPS) {
      setStep(s => s + 1)
      setTransitioning(true)
      setTimeout(() => { locksRef.current.delete('step-advance'); setTransitioning(false) }, 300)
      return
    }

    setLoading(true); setError('')
    try {
      const res = await fetch('/api/scout/onboard', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile, requestId: otpRequestId, otp: otpDigits.join(''), email, password,
          org_name: orgName, org_type: orgType,
          contact_name: contactName, contact_phone: contactPhone,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to set up your scout account')
      setDone(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to set up your scout account'
      // Same OTP-recovery pattern as academy/onboarding — see that file's
      // identical comment for why this drops back to Step 1 specifically.
      if (/incorrect or expired otp|phone verification is required/i.test(message)) {
        setOtpVerified(false)
        setOtpRequestId('')
        setOtpDevCode('')
        setOtpDigits(['', '', '', '', '', ''])
        setStep(1)
        setError("We couldn't confirm your verification — please verify again to finish.")
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
      locksRef.current.delete('step-advance')
    }
  }

  const progress = (step / TOTAL_STEPS) * 100

  // Self-serve scout signup is flagged off by default — see
  // src/lib/feature-flags.ts's SCOUT_SELF_SERVE_ENABLED comment.
  if (!SCOUT_SELF_SERVE_ENABLED) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-3">
          <ShieldAlert className="w-8 h-8 text-zinc-600 mx-auto" />
          <h1 className="text-xl font-bold text-white">Scout sign-up isn&apos;t available yet</h1>
          <p className="text-sm text-zinc-500">AthlasX doesn&apos;t currently offer self-serve scout accounts.</p>
          <Link href="/" className="inline-block mt-2 text-sm font-bold text-[#FFA64D] hover:text-[#FF8A1E]">Back to AthlasX</Link>
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
              <p className="font-[family-name:var(--font-barlow-semi)] uppercase tracking-[0.2em] text-[11px] font-bold text-[color:var(--accent-bright)] mb-1.5">Scout Onboarding</p>
              <h1 className="font-[family-name:var(--font-anton)] uppercase font-normal leading-[0.92] text-[42px] text-[color:var(--text)]">
                Start <b className="text-[color:var(--accent)] font-normal">scouting.</b>
              </h1>
              <p className="mt-3.5 text-sm leading-relaxed text-[color:var(--text-dim)] max-w-[22rem]">Two steps. You&apos;ll only ever see players who have opted in and are 18 or older — no exceptions, enforced platform-wide.</p>
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
            <div className="w-full max-w-[40rem] mx-auto px-6 sm:px-10 py-8 sm:py-10">
              <AnimatePresence mode="wait">
                <motion.div key={step} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.25 }} style={{ pointerEvents: transitioning ? 'none' : 'auto' }}>

                  {step === 1 && (
                    <>
                      <p className="font-[family-name:var(--font-barlow-semi)] uppercase tracking-[0.18em] text-[11px] font-bold text-[color:var(--accent-bright)] mb-1.5">Step {step} of {TOTAL_STEPS}</p>
                      <h2 className="font-[family-name:var(--font-anton)] uppercase font-normal leading-[0.92] text-[40px] text-[color:var(--text)] mb-2">Create your account</h2>
                      <p className="text-sm leading-relaxed text-[color:var(--text-dim)] max-w-[32rem] mb-7">We&apos;ll text a one-time code to verify your WhatsApp number.</p>

                      <div className="mb-4">
                        <Label className={LABEL_CLS}>Mobile Number (WhatsApp)<span className="text-[color:var(--accent)] ml-0.5">*</span></Label>
                        <div className="flex gap-2 mt-1.5">
                          <span className="flex-none flex items-center px-3.5 border border-[color:var(--card-border)] rounded-[9px] bg-[color:var(--field-bg)] font-bold text-[0.92rem] text-[color:var(--text)]">+91</span>
                          <Input value={mobile} onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="98765 43210" disabled={otpVerified}
                            className={FIELD_CLS} />
                          {!otpVerified && (
                            <button type="button" onClick={sendOtp} disabled={sendingOtp}
                              className="flex-none px-[1.1rem] rounded-[9px] bg-[color:var(--accent)] text-[#1a0e02] font-[family-name:var(--font-barlow-semi)] uppercase tracking-wide font-bold text-[0.84rem] hover:bg-[color:var(--accent-bright)] transition-colors disabled:opacity-50">
                              {sendingOtp ? 'Sending…' : otpRequestId ? 'Resend OTP' : 'Send OTP'}
                            </button>
                          )}
                        </div>
                      </div>

                      {otpVerified ? (
                        <div className="flex items-center gap-2 p-3 rounded-[9px] border border-[color:var(--ok)]/40 bg-[color:var(--ok)]/10 text-[color:var(--ok)] text-sm font-semibold mb-4">
                          <CheckCircle2 className="w-4 h-4" /> Mobile number verified
                        </div>
                      ) : otpRequestId && (
                        <div className="mb-4">
                          <div className="p-2.5 rounded-[9px] border border-[color:var(--card-border)] bg-[color:var(--ov08)] mb-3">
                            <p className="text-[11px] font-bold text-[color:var(--accent-bright)]">Dev mode — no SMS gateway connected</p>
                            <p className="text-xs text-[color:var(--text-dim)] mt-0.5">Your test code is <span className="font-mono font-bold text-[color:var(--text)]">{otpDevCode}</span></p>
                          </div>
                          <Label className={LABEL_CLS}>Enter OTP</Label>
                          <div className="flex gap-2.5 mt-1.5">
                            {otpDigits.map((d, i) => (
                              <input key={i} ref={(el) => { otpRefs.current[i] = el }} value={d} inputMode="numeric" maxLength={1}
                                onChange={(e) => setOtpDigit(i, e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Backspace' && !d && otpRefs.current[i - 1]) otpRefs.current[i - 1]?.focus() }}
                                className="w-[46px] h-[52px] text-center text-[1.2rem] font-bold rounded-[9px] border-[1.5px] border-[color:var(--card-border)] bg-[color:var(--field-bg)] text-[color:var(--text)] outline-none focus:border-[color:var(--accent)] focus:shadow-[0_0_0_3px_var(--ov22)] transition-all" />
                            ))}
                          </div>
                          <button type="button" onClick={verifyOtp} disabled={verifyingOtp}
                            className="mt-3 px-4 py-2 rounded-[9px] border-[1.5px] border-[color:var(--card-border)] text-[color:var(--text)] font-[family-name:var(--font-barlow-semi)] uppercase tracking-wide text-xs font-bold hover:border-white/50 transition-colors disabled:opacity-50">
                            {verifyingOtp ? 'Verifying…' : 'Verify'}
                          </button>
                        </div>
                      )}

                      {error && (
                        <div className="flex items-start gap-2 p-3 mb-4 rounded-[9px] border border-[color:var(--bad)]/30 bg-[color:var(--bad)]/[0.08]">
                          <ShieldAlert className="w-3.5 h-3.5 text-[color:var(--bad)] mt-0.5 shrink-0" />
                          <p className="text-xs text-[color:var(--bad)]">{error}</p>
                        </div>
                      )}

                      <div className="pt-4 border-t border-[color:var(--card-border)] space-y-4">
                        <div>
                          <Label className={LABEL_CLS}>Email<span className="text-[color:var(--accent)] ml-0.5">*</span></Label>
                          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@franchise.com" autoComplete="email"
                            className={cn(FIELD_CLS, 'mt-1.5')} />
                        </div>
                        <div>
                          <Label className={LABEL_CLS}>Password<span className="text-[color:var(--accent)] ml-0.5">*</span></Label>
                          <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Choose a password" autoComplete="new-password" minLength={10}
                            className={cn(FIELD_CLS, 'mt-1.5')} />
                        </div>
                        <p className="text-[11px] text-[color:var(--text-faint)]">At least 10 characters, with letters and numbers. Email + password sign you back in later — WhatsApp OTP only verifies this number belongs to you now.</p>
                      </div>
                    </>
                  )}

                  {step === 2 && (
                    <>
                      <p className="font-[family-name:var(--font-barlow-semi)] uppercase tracking-[0.18em] text-[11px] font-bold text-[color:var(--accent-bright)] mb-1.5">Step {step} of {TOTAL_STEPS}</p>
                      <h2 className="font-[family-name:var(--font-anton)] uppercase font-normal leading-[0.92] text-[40px] text-[color:var(--text)] mb-2">Your organization</h2>
                      <p className="text-sm leading-relaxed text-[color:var(--text-dim)] max-w-[32rem] mb-7">Tell us who you scout for. This is reviewed before your account is verified.</p>

                      <div className="mb-5">
                        <Label className={LABEL_CLS}>Organization Name<span className="text-[color:var(--accent)] ml-0.5">*</span></Label>
                        <Input value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="e.g. Mumbai Indians" className={cn(FIELD_CLS, 'mt-1.5')} />
                      </div>

                      <div className="mb-5">
                        <Label className={LABEL_CLS}>Organization Type<span className="text-[color:var(--accent)] ml-0.5">*</span></Label>
                        <div className="grid gap-2.5 mt-2">
                          {ORG_TYPES.map(t => (
                            <button key={t.v} type="button" onClick={() => setOrgType(t.v)}
                              className={cn('flex items-start gap-2.5 text-left px-3.5 py-3 rounded-[11px]', OPTCARD_CLS(orgType === t.v))}>
                              <span className={cn('w-8 h-8 flex-none rounded-[8px] grid place-items-center', orgType === t.v ? 'bg-[color:var(--accent)] text-[#1a0e02]' : 'bg-[rgba(255,138,30,0.16)] text-[color:var(--accent-bright)]')}>
                                <t.icon className="w-[17px] h-[17px]" />
                              </span>
                              <span>
                                <span className="block text-[0.94rem] font-bold text-[color:var(--text)]">{t.label}</span>
                                <span className="block text-[0.74rem] leading-snug text-[color:var(--text-dim)]">{t.s}</span>
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-5">
                        <div>
                          <Label className={LABEL_CLS}>Contact Name<span className="text-[color:var(--text-faint)] font-medium tracking-normal normal-case ml-1.5">optional</span></Label>
                          <Input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Full name" className={cn(FIELD_CLS, 'mt-1.5')} />
                        </div>
                        <div>
                          <Label className={LABEL_CLS}>Contact Phone<span className="text-[color:var(--text-faint)] font-medium tracking-normal normal-case ml-1.5">optional</span></Label>
                          <Input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="If different from above" className={cn(FIELD_CLS, 'mt-1.5')} />
                        </div>
                      </div>

                      <div className="flex gap-2.5 p-[0.85rem_1rem] rounded-[10px] bg-[color:var(--ov08)] border border-[color:var(--ov22)]">
                        <ShieldAlert className="w-[18px] h-[18px] text-[color:var(--accent-bright)] mt-0.5 flex-none" />
                        <p className="text-[0.84rem] leading-relaxed text-[color:var(--text)]">
                          You&apos;ll only ever see adult players who opted in to scout visibility — this is enforced platform-wide and cannot be changed from your account.
                        </p>
                      </div>
                      {error && (
                        <div className="flex items-start gap-2 p-3 mt-4 rounded-[9px] border border-[color:var(--bad)]/30 bg-[color:var(--bad)]/[0.08]">
                          <ShieldAlert className="w-3.5 h-3.5 text-[color:var(--bad)] mt-0.5 shrink-0" />
                          <p className="text-xs text-[color:var(--bad)]">{error}</p>
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <div className="relative z-20 flex items-center justify-between gap-4 px-6 sm:px-10 py-4 border-t border-[color:var(--card-border)] bg-[rgba(13,13,13,0.6)] backdrop-blur-md">
            <span className="text-[0.82rem] text-[color:var(--text-dim)]">Step {step} of {TOTAL_STEPS}</span>
            <div className="flex gap-2.5">
              {step > 1 && (
                <button onClick={() => {
                  if (locksRef.current.has('step-advance')) return
                  locksRef.current.add('step-advance')
                  setStep(s => s - 1)
                  setTransitioning(true)
                  setTimeout(() => { locksRef.current.delete('step-advance'); setTransitioning(false) }, 300)
                }}
                  disabled={transitioning}
                  className="px-6 py-[0.78rem] rounded-[9px] border-[1.5px] border-[color:var(--card-border)] text-[color:var(--text)] font-[family-name:var(--font-barlow-semi)] uppercase tracking-wide font-bold text-[0.92rem] hover:border-white/50 hover:bg-white/[0.06] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  Back
                </button>
              )}
              <button
                onClick={handleNext}
                disabled={!canProceed() || loading || transitioning}
                className={cn('flex items-center gap-2 px-6 py-[0.78rem] rounded-[9px] font-[family-name:var(--font-barlow-semi)] uppercase tracking-wide font-bold text-[0.92rem] transition-all',
                  canProceed() && !loading && !transitioning
                    ? 'bg-[color:var(--accent)] text-[#1a0e02] border-[1.5px] border-[color:var(--accent)] shadow-[0_8px_22px_-8px_rgba(255,138,30,0.7)] hover:bg-[color:var(--accent-bright)] hover:border-[color:var(--accent-bright)]'
                    : 'bg-white/[0.04] border-[1.5px] border-[color:var(--card-border)] text-[color:var(--text-faint)] cursor-not-allowed')}
              >
                {loading ? (<><Loader2 className="w-4 h-4 animate-spin" /> Setting up…</>)
                  : step === TOTAL_STEPS ? 'Finish →'
                  : <>Continue <ArrowRight className="w-4 h-4" /></>}
              </button>
            </div>
          </div>
        </main>
      </div>

      {done && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--bg)]/95 backdrop-blur-sm p-6">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="w-20 h-20 mx-auto rounded-full bg-[color:var(--ov14)] border-[1.5px] border-[color:var(--accent)] flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-[color:var(--accent)]" />
            </div>
            <h2 className="font-[family-name:var(--font-anton)] uppercase font-normal text-[clamp(30px,4vw,44px)] leading-[0.92] text-[color:var(--text)]">
              Account <b className="text-[color:var(--accent)] font-normal">created.</b>
            </h2>
            <p className="text-[0.95rem] text-[color:var(--text-dim)] leading-relaxed max-w-[28rem] mx-auto">Your scout account is set up and your organization details are on file for review. You can start browsing opted-in candidates now.</p>
            <button onClick={() => router.push('/')}
              className="mt-2 px-6 py-3 rounded-[9px] text-sm font-[family-name:var(--font-barlow-semi)] uppercase tracking-wide font-bold bg-[color:var(--accent)] text-[#1a0e02] shadow-[0_8px_22px_-8px_rgba(255,138,30,0.7)] hover:bg-[color:var(--accent-bright)] transition-colors">
              Go to Scout Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
