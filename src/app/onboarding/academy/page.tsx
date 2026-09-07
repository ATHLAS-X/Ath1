'use client'

import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Anton, Barlow, Barlow_Semi_Condensed } from 'next/font/google'
import { ArrowRight, Loader2, CheckCircle2, Upload, ShieldAlert, Briefcase, Home, Shield, Globe, Phone, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StepRail } from '@/components/ui/step-rail'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { ACADEMY_SELF_SERVE_ENABLED } from '@/lib/feature-flags'

/*
 * Academy self-serve onboarding — restyled to match the authoritative
 * export design/import/export_v2/export/academy-onboarding-v3.html/.css
 * (2026-09-06 zip), which supersedes the earlier v3 mockup's inline-only
 * spec with a real rail : form two-column layout, section-headers for
 * Step 3, and a 6-box OTP grid. Field set, step order, and copy match that
 * export exactly, with the two deviations already confirmed with the user
 * for this flow, both still true:
 *   - Step 1 adds email+password alongside the export's phone+OTP-only
 *     content, since phone-only auth has no sign-in path anywhere else in
 *     this codebase.
 *   - Steps 3-4 (Facilities & Staff, Programs) are collected here for
 *     fidelity to the mockup but NOT persisted — the Academy Prisma model
 *     has no columns for ground type, coach certifications, age groups,
 *     fees, or BCCI/state-association affiliation.
 *
 * Per the design-rollout convention used by the other three onboarding
 * flows, the top PLAYER/COACH/ACADEMY/SCOUT pill-row switcher visible in
 * the export's screenshots is NOT built — that's the mockup file's own
 * internal preview switcher for its ROLE_FLOWS engine, not a feature for
 * signed-up users.
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
  '--accent-rgb': '255, 138, 30',
  '--ov08': 'rgba(255, 138, 30, 0.08)',
  '--ov14': 'rgba(255, 138, 30, 0.14)',
  '--ov22': 'rgba(255, 138, 30, 0.22)',
  '--card-border': 'rgba(245, 245, 240, 0.14)',
  '--field-bg': 'rgba(245, 245, 240, 0.06)',
  '--ok': '#38d39f',
  '--bad': '#ff5a4d',
  '--ease': 'cubic-bezier(0.22, 1, 0.36, 1)',
} as React.CSSProperties

const FIELD_CLS = 'bg-[color:var(--field-bg)] border-[color:var(--card-border)] text-[color:var(--text)] placeholder:text-[color:var(--text-faint)] h-[42px] rounded-[9px] focus:border-[color:var(--accent)] focus:bg-white/[0.09]'
const LABEL_CLS = 'font-[family-name:var(--font-barlow-semi)] text-[10.5px] font-bold uppercase tracking-[0.12em] text-[color:var(--text-dim)]'
const OPTCARD_CLS = (active: boolean) => cn(
  'transition-all border-[1.5px] rounded-[11px]',
  active
    ? 'bg-[color:var(--ov14)] border-[color:var(--accent)]'
    : 'bg-[color:var(--field-bg)] border-[color:var(--card-border)] hover:border-white/30',
)
const SECTION_H_CLS = 'font-[family-name:var(--font-barlow-semi)] uppercase tracking-[0.08em] text-[1.02rem] font-bold text-[color:var(--text)]'

const TOTAL_STEPS = 5
const STEPS = [
  { key: 'account', label: 'Account', sublabel: 'Phone + OTP' },
  { key: 'identity', label: 'Academy Identity', sublabel: 'Name, location, type' },
  { key: 'facilities', label: 'Facilities & Staff', sublabel: 'Ground, coaches' },
  { key: 'programs', label: 'Programs', sublabel: 'Ages, formats, fees' },
  { key: 'golive', label: 'Go Live', sublabel: 'Invite & launch' },
]
const STATES = ['Andhra Pradesh', 'Assam', 'Bihar', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal']
const ACADEMY_TYPES = [
  { v: 'Private', s: 'Owner or company-run', icon: Briefcase },
  { v: 'Government', s: 'Sports authority / SAI', icon: Home },
  { v: 'Trust / NGO', s: 'Non-profit entity', icon: Shield },
  { v: 'Sports Club', s: 'Club-affiliated', icon: Globe },
]
const AGE_GROUPS = ['U-10', 'U-12', 'U-14', 'U-16', 'U-19', 'U-23', 'Senior']
const FORMATS = ['T20', 'ODI', 'Red-ball', 'All']
const FEE_RANGES = ['Free', '< 1K', '1K–3K', '3K–7K', '7K+']

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={cn('px-3.5 py-2 rounded-full text-[0.86rem] font-semibold border-[1.5px] transition-all',
        active ? 'bg-[color:var(--ov14)] border-[color:var(--accent)] text-[color:var(--accent-bright)]' : 'bg-[color:var(--field-bg)] border-[color:var(--card-border)] text-[color:var(--text-dim)] hover:border-white/30 hover:text-[color:var(--text)]')}>
      {label}
    </button>
  )
}

function NumStep({ value, onChange, min, max }: { value: number; onChange: (v: number) => void; min: number; max: number }) {
  return (
    <div className="inline-flex items-center border border-[color:var(--card-border)] rounded-[9px] overflow-hidden bg-[color:var(--field-bg)]">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} className="w-[38px] h-[42px] font-bold text-[color:var(--text)] hover:bg-[color:var(--ov14)] hover:text-[color:var(--accent-bright)] transition-colors">−</button>
      <span className="w-14 text-center text-[0.98rem] font-bold text-[color:var(--text)] border-x border-[color:var(--card-border)] h-[42px] leading-[42px]">{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} className="w-[38px] h-[42px] font-bold text-[color:var(--text)] hover:bg-[color:var(--ov14)] hover:text-[color:var(--accent-bright)] transition-colors">+</button>
    </div>
  )
}

export default function AcademyOnboardingPage() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [transitioning, setTransitioning] = useState(false)
  const router = useRouter()

  // Re-entry locks — see src/app/onboarding/page.tsx's identical
  // `locksRef` for why this needs to be a ref (checked/mutated
  // synchronously) rather than relying on state flags alone: two click
  // events fired in the same tick both read the same pre-render state
  // value, since neither click's state update has committed when the
  // second one runs.
  const locksRef = useRef<Set<string>>(new Set())

  // Step 1
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

  // Step 2 — Academy identity
  const [academyName, setAcademyName] = useState('')
  const [city, setCity] = useState('')
  const [district, setDistrict] = useState('')
  const [state, setState] = useState('')
  const [year, setYear] = useState('')
  const [academyType, setAcademyType] = useState('Private')
  const [contactName, setContactName] = useState('')
  const [designation, setDesignation] = useState('')
  const [logoUploaded, setLogoUploaded] = useState(false)

  // Step 3 — Facilities & staff (UI only, not persisted)
  const [groundType, setGroundType] = useState('Turf')
  const [nets, setNets] = useState(4)
  const [capacity, setCapacity] = useState('')
  const [bowlingMachine, setBowlingMachine] = useState('No')
  const [hcName, setHcName] = useState('')
  const [hcCert, setHcCert] = useState('')
  const [exPro, setExPro] = useState('No')
  const [exName, setExName] = useState('')
  const [exLevel, setExLevel] = useState('')
  const [assistants, setAssistants] = useState(1)

  // Step 4 — Programs (UI only, not persisted)
  const [ageGroups, setAgeGroups] = useState<string[]>([])
  const [formats, setFormats] = useState<string[]>([])
  const [timing, setTiming] = useState('')
  const [feeRange, setFeeRange] = useState('')
  const [bcci, setBcci] = useState('No')
  const [bcciId, setBcciId] = useState('')
  const [sca, setSca] = useState('No')
  const [scaName, setScaName] = useState('')

  // Step 5 — Go Live (invite/batch are dev-only affordances, not wired to
  // a real invite or batch-creation call here — same "collect, don't
  // persist" scope as steps 3-4)
  const [inviteMobile, setInviteMobile] = useState('')
  const [inviteSent, setInviteSent] = useState(false)
  const [batchName, setBatchName] = useState('')
  const [batchCreated, setBatchCreated] = useState(false)

  const [done, setDone] = useState(false)

  function toggle(arr: string[], set: (v: string[]) => void, v: string) {
    set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v])
  }

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
      const res = await fetch('/api/academy/onboard/send-otp', {
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
      // the user proceed to the next step in the UI — the account is only
      // ever created after the server independently re-verifies via
      // verifyAcademyOtp() in POST /api/academy/onboard.
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
    if (step === 2) return Boolean(academyName && city && district && state && contactName)
    if (step === 3) return Boolean(hcName)
    return true
  }

  async function handleNext() {
    if (!canProceed()) return
    if (locksRef.current.has('step-advance')) return
    locksRef.current.add('step-advance')

    if (step < TOTAL_STEPS) {
      setStep(s => s + 1)
      setTransitioning(true)
      // Held for the AnimatePresence exit/enter transition duration
      // (0.25s, matching this file's `transition={{ duration: 0.25 }}`).
      setTimeout(() => { locksRef.current.delete('step-advance'); setTransitioning(false) }, 300)
      return
    }

    setLoading(true); setError('')
    try {
      const res = await fetch('/api/academy/onboard', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, requestId: otpRequestId, otp: otpDigits.join(''), email, password, academy_name: academyName, district, state }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to set up your academy')
      setDone(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to set up your academy'
      // The server re-verifies the OTP at submit time (verifyAcademyOtp)
      // rather than trusting client state — if that recheck fails after the
      // client already showed "verified" (stale/expired/already-used
      // requestId), don't strand the user behind a generic error on Step 5.
      // Drop back to Step 1 with a fresh Send-OTP prompt, keeping every
      // other step's fields intact so they only redo the OTP, not the wizard.
      if (/incorrect or expired otp|phone verification is required/i.test(message)) {
        const recoveryMessage = "We couldn't confirm your verification — please verify again to finish."
        setOtpVerified(false)
        setOtpRequestId('')
        setOtpDevCode('')
        setOtpDigits(['', '', '', '', '', ''])
        setStep(1)
        setError(recoveryMessage)
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
      locksRef.current.delete('step-advance')
    }
  }

  const progress = (step / TOTAL_STEPS) * 100

  // Self-serve academy signup is flagged off by default — see
  // src/lib/feature-flags.ts's ACADEMY_SELF_SERVE_ENABLED comment for why
  // (it wasn't a deliberate pivot-doc scope change). Checked after all
  // hooks are declared, before any other early return, so this doesn't
  // change hook call order.
  if (!ACADEMY_SELF_SERVE_ENABLED) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-3">
          <ShieldAlert className="w-8 h-8 text-zinc-600 mx-auto" />
          <h1 className="text-xl font-bold text-white">Academy sign-up isn&apos;t available yet</h1>
          <p className="text-sm text-zinc-500">AthlasX doesn&apos;t currently offer self-serve academy accounts. If your academy&apos;s data is already being tracked through a district or state association, it will show up automatically as match data comes in.</p>
          <Link href="/" className="inline-block mt-2 text-sm font-bold text-[#FFA64D] hover:text-[#FF8A1E]">Back to AthlasX</Link>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(anton.variable, barlow.variable, barlowSemi.variable)} style={OB_VARS}>
      <div className="min-h-screen grid lg:grid-cols-[1fr_2fr] bg-[color:var(--bg)] font-[family-name:var(--font-barlow)] text-[color:var(--text)]">
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
              <p className="font-[family-name:var(--font-barlow-semi)] uppercase tracking-[0.2em] text-[11px] font-bold text-[color:var(--accent-bright)] mb-1.5">Academy Onboarding</p>
              <h1 className="font-[family-name:var(--font-anton)] uppercase font-normal leading-[0.92] text-[42px] text-[color:var(--text)]">
                Set up your <b className="text-[color:var(--accent)] font-normal">academy.</b>
              </h1>
              <p className="mt-3.5 text-sm leading-relaxed text-[color:var(--text-dim)] max-w-[22rem]">Five steps. Roster-ready in under 10 minutes. Everything auto-saves.</p>
            </div>

            <StepRail steps={STEPS} currentIndex={step - 1} className="mt-8" />
          </div>
        </aside>

        {/* ── RIGHT PANEL ── */}
        <main className="relative flex flex-col min-w-0">
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
                      <p className="font-[family-name:var(--font-barlow-semi)] uppercase tracking-[0.18em] text-[11px] font-bold text-[color:var(--accent-bright)] mb-1.5">Step 1 of 5</p>
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
                          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="director@academy.com" autoComplete="email"
                            className={cn(FIELD_CLS, 'mt-1.5')} />
                        </div>
                        <div>
                          <Label className={LABEL_CLS}>Password<span className="text-[color:var(--accent)] ml-0.5">*</span></Label>
                          <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Choose a password" autoComplete="new-password"
                            className={cn(FIELD_CLS, 'mt-1.5')} />
                        </div>
                        <p className="text-[11px] text-[color:var(--text-faint)]">Email + password sign you back in later — WhatsApp OTP only verifies this number belongs to you now.</p>
                      </div>
                    </>
                  )}

                  {step === 2 && (
                    <>
                      <p className="font-[family-name:var(--font-barlow-semi)] uppercase tracking-[0.18em] text-[11px] font-bold text-[color:var(--accent-bright)] mb-1.5">Step 2 of 5</p>
                      <h2 className="font-[family-name:var(--font-anton)] uppercase font-normal leading-[0.92] text-[40px] text-[color:var(--text)] mb-2">Academy identity</h2>
                      <p className="text-sm leading-relaxed text-[color:var(--text-dim)] max-w-[32rem] mb-7">Tell us about your academy. This appears on your public profile — scouts and players will see this.</p>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-1">
                        <div className="col-span-2">
                          <Label className={LABEL_CLS}>Academy Name<span className="text-[color:var(--accent)] ml-0.5">*</span></Label>
                          <Input value={academyName} onChange={e => setAcademyName(e.target.value)} placeholder="e.g. KCA Cricket Academy" className={cn(FIELD_CLS, 'mt-1.5 mb-4')} />
                        </div>
                        <div>
                          <Label className={LABEL_CLS}>City<span className="text-[color:var(--accent)] ml-0.5">*</span></Label>
                          <Input value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Kanpur" className={cn(FIELD_CLS, 'mt-1.5 mb-4')} />
                        </div>
                        <div>
                          <Label className={LABEL_CLS}>District<span className="text-[color:var(--accent)] ml-0.5">*</span></Label>
                          <Input value={district} onChange={e => setDistrict(e.target.value)} placeholder="e.g. Kanpur Nagar" className={cn(FIELD_CLS, 'mt-1.5')} />
                          <p className="text-[10px] text-[color:var(--text-faint)] mt-1">Required to save your academy record.</p>
                        </div>
                        <div>
                          <Label className={LABEL_CLS}>State<span className="text-[color:var(--accent)] ml-0.5">*</span></Label>
                          <select value={state} onChange={e => setState(e.target.value)}
                            className={cn(FIELD_CLS, 'mt-1.5 w-full px-3.5 appearance-none cursor-pointer')}>
                            <option value="" className="bg-[#141312]">Select state</option>
                            {STATES.map(s => <option key={s} value={s} className="bg-[#141312]">{s}</option>)}
                          </select>
                        </div>
                        <div>
                          <Label className={LABEL_CLS}>Year Established</Label>
                          <Input type="number" value={year} onChange={e => setYear(e.target.value)} placeholder="e.g. 2008" className={cn(FIELD_CLS, 'mt-1.5')} />
                        </div>
                      </div>

                      <div className="mt-4 mb-5">
                        <Label className={LABEL_CLS}>Academy Type</Label>
                        <div className="grid grid-cols-2 gap-2.5 mt-2">
                          {ACADEMY_TYPES.map(t => (
                            <button key={t.v} type="button" onClick={() => setAcademyType(t.v)}
                              className={cn('flex items-start gap-2.5 text-left px-3.5 py-3 rounded-[11px]', OPTCARD_CLS(academyType === t.v))}>
                              <span className={cn('w-8 h-8 flex-none rounded-[8px] grid place-items-center', academyType === t.v ? 'bg-[color:var(--accent)] text-[#1a0e02]' : 'bg-[rgba(255,138,30,0.16)] text-[color:var(--accent-bright)]')}>
                                <t.icon className="w-[17px] h-[17px]" />
                              </span>
                              <span>
                                <span className="block text-[0.94rem] font-bold text-[color:var(--text)]">{t.v}</span>
                                <span className="block text-[0.74rem] leading-snug text-[color:var(--text-dim)]">{t.s}</span>
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-5">
                        <div>
                          <Label className={LABEL_CLS}>Primary Contact Name<span className="text-[color:var(--accent)] ml-0.5">*</span></Label>
                          <Input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Full name" className={cn(FIELD_CLS, 'mt-1.5')} />
                        </div>
                        <div>
                          <Label className={LABEL_CLS}>Designation</Label>
                          <Input value={designation} onChange={e => setDesignation(e.target.value)} placeholder="e.g. Director, Admin Manager" className={cn(FIELD_CLS, 'mt-1.5')} />
                        </div>
                      </div>

                      <div>
                        <Label className={LABEL_CLS}>Academy Logo<span className="text-[color:var(--text-faint)] font-medium tracking-normal normal-case ml-1.5">optional</span></Label>
                        <button type="button" onClick={() => setLogoUploaded(true)}
                          className="w-full mt-1.5 flex flex-col items-center gap-1.5 p-7 rounded-[11px] border-2 border-dashed border-[color:var(--accent)] bg-[color:var(--ov08)] hover:bg-[color:var(--ov14)] transition-colors">
                          <Upload className="w-[30px] h-[30px] text-[color:var(--accent)]" />
                          <span className="text-[0.9rem] font-bold text-[color:var(--text)]">{logoUploaded ? 'Logo uploaded ✓' : 'Upload logo or letterhead'}</span>
                          <span className="text-[0.74rem] text-[color:var(--text-faint)]">PNG, JPG or PDF — max 5 MB</span>
                        </button>
                      </div>
                    </>
                  )}

                  {step === 3 && (
                    <>
                      <p className="font-[family-name:var(--font-barlow-semi)] uppercase tracking-[0.18em] text-[11px] font-bold text-[color:var(--accent-bright)] mb-1.5">Step 3 of 5</p>
                      <h2 className="font-[family-name:var(--font-anton)] uppercase font-normal leading-[0.92] text-[40px] text-[color:var(--text)] mb-2">Facilities & staff</h2>
                      <p className="text-sm leading-relaxed text-[color:var(--text-dim)] max-w-[32rem] mb-2">What you offer on the ground, and who&apos;s coaching.</p>

                      <div className="flex items-baseline gap-2.5 mt-1 mb-4">
                        <h3 className={SECTION_H_CLS}>Facilities</h3>
                        <span className="text-[0.76rem] text-[color:var(--text-faint)]">Ground & equipment</span>
                      </div>

                      <div className="mb-4">
                        <Label className={LABEL_CLS}>Ground Type</Label>
                        <div className="flex gap-2 mt-1.5">{['Turf', 'Matting', 'Both'].map(v => <Chip key={v} label={v} active={groundType === v} onClick={() => setGroundType(v)} />)}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <Label className={LABEL_CLS}>Practice Nets</Label>
                          <div className="mt-1.5"><NumStep value={nets} onChange={setNets} min={0} max={30} /></div>
                        </div>
                        <div>
                          <Label className={LABEL_CLS}>Approx Capacity<span className="text-[color:var(--text-faint)] font-medium tracking-normal normal-case ml-1.5">optional</span></Label>
                          <Input type="number" value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="e.g. 60 players" className={cn(FIELD_CLS, 'mt-1.5')} />
                        </div>
                      </div>
                      <div className="mb-6">
                        <Label className={LABEL_CLS}>Bowling Machine Available</Label>
                        <div className="flex gap-2 mt-1.5">{['Yes', 'No'].map(v => <Chip key={v} label={v} active={bowlingMachine === v} onClick={() => setBowlingMachine(v)} />)}</div>
                      </div>

                      <div className="flex items-baseline gap-2.5 pt-5 mt-1 mb-4 border-t border-[color:var(--card-border)]">
                        <h3 className={SECTION_H_CLS}>Staff</h3>
                        <span className="text-[0.76rem] text-[color:var(--text-faint)]">Head coach & team</span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <Label className={LABEL_CLS}>Head Coach Name<span className="text-[color:var(--accent)] ml-0.5">*</span></Label>
                          <Input value={hcName} onChange={e => setHcName(e.target.value)} placeholder="Full name" className={cn(FIELD_CLS, 'mt-1.5')} />
                        </div>
                        <div>
                          <Label className={LABEL_CLS}>Head Coach Certification</Label>
                          <select value={hcCert} onChange={e => setHcCert(e.target.value)}
                            className={cn(FIELD_CLS, 'mt-1.5 w-full px-3.5 appearance-none cursor-pointer')}>
                            <option value="" className="bg-[#141312]">Select certification</option>
                            {['BCCI L1', 'BCCI L2', 'BCCI L3', 'NCA', 'NIS', 'Other'].map(c => <option key={c} value={c} className="bg-[#141312]">{c}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="mb-1">
                        <Label className={LABEL_CLS}>Ex-Professional on Staff?</Label>
                        <div className="flex gap-2 mt-1.5">{['Yes', 'No'].map(v => <Chip key={v} label={v} active={exPro === v} onClick={() => setExPro(v)} />)}</div>
                        {exPro === 'Yes' && (
                          <div className="grid grid-cols-2 gap-4 p-[0.9rem] mt-[0.7rem] rounded-[10px] bg-[color:var(--field-bg)] border border-[color:var(--card-border)]">
                            <div>
                              <Label className={LABEL_CLS}>Name</Label>
                              <Input value={exName} onChange={e => setExName(e.target.value)} placeholder="Full name" className={cn(FIELD_CLS, 'mt-1.5')} />
                            </div>
                            <div>
                              <Label className={LABEL_CLS}>Highest Level Played</Label>
                              <Input value={exLevel} onChange={e => setExLevel(e.target.value)} placeholder="e.g. Ranji Trophy, IPL" className={cn(FIELD_CLS, 'mt-1.5')} />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="mt-5">
                        <Label className={LABEL_CLS}>Assistant Coaches</Label>
                        <div className="mt-1.5"><NumStep value={assistants} onChange={setAssistants} min={0} max={20} /></div>
                      </div>
                    </>
                  )}

                  {step === 4 && (
                    <>
                      <p className="font-[family-name:var(--font-barlow-semi)] uppercase tracking-[0.18em] text-[11px] font-bold text-[color:var(--accent-bright)] mb-1.5">Step 4 of 5</p>
                      <h2 className="font-[family-name:var(--font-anton)] uppercase font-normal leading-[0.92] text-[40px] text-[color:var(--text)] mb-2">Programs</h2>
                      <p className="text-sm leading-relaxed text-[color:var(--text-dim)] max-w-[32rem] mb-7">What you run, for whom, and at what price.</p>

                      <div className="mb-4">
                        <Label className={LABEL_CLS}>Age Groups</Label>
                        <div className="flex flex-wrap gap-2 mt-1.5">{AGE_GROUPS.map(v => <Chip key={v} label={v} active={ageGroups.includes(v)} onClick={() => toggle(ageGroups, setAgeGroups, v)} />)}</div>
                      </div>
                      <div className="mb-4">
                        <Label className={LABEL_CLS}>Formats</Label>
                        <div className="flex flex-wrap gap-2 mt-1.5">{FORMATS.map(v => <Chip key={v} label={v} active={formats.includes(v)} onClick={() => toggle(formats, setFormats, v)} />)}</div>
                      </div>
                      <div className="mb-4">
                        <Label className={LABEL_CLS}>Batch Timings</Label>
                        <div className="flex gap-2 mt-1.5">{['Morning', 'Evening', 'Both'].map(v => <Chip key={v} label={v} active={timing === v} onClick={() => setTiming(v)} />)}</div>
                      </div>
                      <div className="mb-4">
                        <Label className={LABEL_CLS}>Monthly Fee Range</Label>
                        <div className="flex flex-wrap gap-2 mt-1.5">{FEE_RANGES.map(v => <Chip key={v} label={v} active={feeRange === v} onClick={() => setFeeRange(v)} />)}</div>
                      </div>

                      <div className="mb-4">
                        <Label className={LABEL_CLS}>BCCI Affiliated</Label>
                        <div className="flex gap-2 mt-1.5">{['Yes', 'No'].map(v => <Chip key={v} label={v} active={bcci === v} onClick={() => setBcci(v)} />)}</div>
                        {bcci === 'Yes' && (
                          <div className="p-[0.9rem] mt-[0.7rem] rounded-[10px] bg-[color:var(--field-bg)] border border-[color:var(--card-border)]">
                            <Label className={LABEL_CLS}>Affiliation ID</Label>
                            <Input value={bcciId} onChange={e => setBcciId(e.target.value)} placeholder="e.g. BCCI-UP-0231" className={cn(FIELD_CLS, 'mt-1.5')} />
                          </div>
                        )}
                      </div>
                      <div>
                        <Label className={LABEL_CLS}>State Cricket Association Affiliated</Label>
                        <div className="flex gap-2 mt-1.5">{['Yes', 'No'].map(v => <Chip key={v} label={v} active={sca === v} onClick={() => setSca(v)} />)}</div>
                        {sca === 'Yes' && (
                          <div className="p-[0.9rem] mt-[0.7rem] rounded-[10px] bg-[color:var(--field-bg)] border border-[color:var(--card-border)]">
                            <Label className={LABEL_CLS}>Which association?</Label>
                            <Input value={scaName} onChange={e => setScaName(e.target.value)} placeholder="e.g. Uttar Pradesh Cricket Association" className={cn(FIELD_CLS, 'mt-1.5')} />
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {step === 5 && (
                    <>
                      <p className="font-[family-name:var(--font-barlow-semi)] uppercase tracking-[0.18em] text-[11px] font-bold text-[color:var(--accent-bright)] mb-1.5">Step 5 of 5</p>
                      <h2 className="font-[family-name:var(--font-anton)] uppercase font-normal leading-[0.92] text-[40px] text-[color:var(--text)] mb-2">Go live</h2>
                      <p className="text-sm leading-relaxed text-[color:var(--text-dim)] max-w-[32rem] mb-7">Bring your team on board, or jump straight to your dashboard.</p>

                      <div className="grid sm:grid-cols-2 gap-[0.9rem]">
                        <div className="rounded-[11px] p-[1.15rem] flex flex-col gap-3 border-[1.5px] border-[color:var(--card-border)] bg-[color:var(--field-bg)]">
                          <h4 className="font-[family-name:var(--font-barlow-semi)] uppercase tracking-[0.06em] text-[0.92rem] font-bold flex items-center gap-2 text-[color:var(--text)]">
                            <Phone className="w-[17px] h-[17px] text-[color:var(--accent)]" /> Invite Coaches
                          </h4>
                          <div className="flex gap-2">
                            <Input value={inviteMobile} onChange={e => setInviteMobile(e.target.value)} placeholder="Coach's mobile number"
                              className="bg-white/[0.05] border-[color:var(--card-border)] text-[color:var(--text)] placeholder:text-[color:var(--text-faint)] h-10 rounded-[8px] text-[0.9rem]" />
                            <button type="button" onClick={() => { if (inviteMobile.trim()) { setInviteSent(true); setTimeout(() => { setInviteSent(false); setInviteMobile('') }, 1300) } }}
                              className="flex-none px-4 rounded-[9px] bg-[color:var(--accent)] text-[#1a0e02] font-[family-name:var(--font-barlow-semi)] uppercase tracking-wide font-bold text-[0.84rem] hover:bg-[color:var(--accent-bright)] transition-colors">
                              {inviteSent ? 'Sent ✓' : 'Invite'}
                            </button>
                          </div>
                        </div>
                        <div className="rounded-[11px] p-[1.15rem] flex flex-col gap-3 border-[1.5px] border-[color:var(--accent)] bg-[color:var(--ov14)]">
                          <h4 className="font-[family-name:var(--font-barlow-semi)] uppercase tracking-[0.06em] text-[0.92rem] font-bold flex items-center gap-2 text-[color:var(--text)]">
                            <Plus className="w-[17px] h-[17px] text-[color:var(--accent)]" /> Create First Batch
                          </h4>
                          <Input value={batchName} onChange={e => setBatchName(e.target.value)} placeholder="Batch name, e.g. Morning U-14"
                            className="bg-white/[0.05] border-[color:var(--card-border)] text-[color:var(--text)] placeholder:text-[color:var(--text-faint)] h-10 rounded-[8px] text-[0.9rem]" />
                          <button type="button" onClick={() => { if (batchName.trim()) { setBatchCreated(true); setTimeout(() => setBatchCreated(false), 1300) } }}
                            className="w-full px-4 py-2 rounded-[9px] bg-[color:var(--accent)] text-[#1a0e02] font-[family-name:var(--font-barlow-semi)] uppercase tracking-wide font-bold text-[0.84rem] hover:bg-[color:var(--accent-bright)] transition-colors">
                            {batchCreated ? 'Created ✓' : 'Create Batch'}
                          </button>
                          <p className="text-[10px] text-[color:var(--text-faint)]">Batches created here are illustrative only — head to the academy dashboard after setup to create real batches.</p>
                        </div>
                      </div>

                      <div className="flex gap-2.5 p-[0.85rem_1rem] mt-[1.4rem] rounded-[10px] bg-[color:var(--ov08)] border border-[color:var(--ov22)]">
                        <ShieldAlert className="w-[18px] h-[18px] text-[color:var(--accent-bright)] mt-0.5 flex-none" />
                        <p className="text-[0.84rem] leading-relaxed text-[color:var(--text)]">
                          <b className="text-[color:var(--accent-bright)]">{academyName || 'Your academy'}</b> goes live the moment you finish — players who join via your invite link enter an approval queue.
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

              {error && step !== 5 && step !== 1 && (
                <p className="mt-4 text-xs text-[color:var(--bad)]">{error}</p>
              )}
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
                  : step === TOTAL_STEPS ? 'Finish & Go Live →'
                  : done ? 'Go to Dashboard'
                  : <>Save & Continue <ArrowRight className="w-4 h-4" /></>}
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
              {academyName || 'Your academy'} is <b className="text-[color:var(--accent)] font-normal">live.</b>
            </h2>
            <p className="text-[0.95rem] text-[color:var(--text-dim)] leading-relaxed max-w-[28rem] mx-auto">Your academy profile is submitted and pending verification. Invite links are active — start adding players now.</p>
            <button onClick={() => router.push('/dashboard')}
              className="mt-2 px-6 py-3 rounded-[9px] text-sm font-[family-name:var(--font-barlow-semi)] uppercase tracking-wide font-bold bg-[color:var(--accent)] text-[#1a0e02] shadow-[0_8px_22px_-8px_rgba(255,138,30,0.7)] hover:bg-[color:var(--accent-bright)] transition-colors">
              Go to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
