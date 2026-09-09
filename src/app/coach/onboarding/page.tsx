'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Anton, Barlow, Barlow_Semi_Condensed } from 'next/font/google'
import { ArrowRight, Loader2, CheckCircle2, Upload, ShieldAlert, Info, Megaphone, User, Target, Star, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StepRail } from '@/components/ui/step-rail'
import { cn } from '@/lib/utils'

/*
 * Coach self-serve onboarding — restyled to match the authoritative export
 * design/import/export_v2/export/coach-onboarding.html/.css (2026-09-06
 * zip): rail : form two-column layout, cert-grid badges, reveal panels.
 * Field set/step order/copy match that export, with the deviations already
 * confirmed with the user for this flow, all still true:
 *   - The mockup's real Step 4 ("Join an academy" — invite code / browse /
 *     independent) has no home in the schema (CoachProfile.association_id
 *     is required, no academy relation) — Step 4 here stays the real,
 *     required Association picker built earlier, not the mockup's academy
 *     UI. Copy/header for this step is this app's own, not the export's.
 *   - Step 1 adds email+password alongside the export's optional-email,
 *     no-password content.
 *   - Steps 2-3 (Experience, Certifications) are collected for fidelity to
 *     the mockup but not persisted — CoachProfile has no columns for them.
 *
 * Per the design-rollout convention, the top PLAYER/COACH/ACADEMY/SCOUT
 * pill-row switcher visible in the export's screenshots is NOT built.
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
  active ? 'bg-[color:var(--ov14)] border-[color:var(--accent)]' : 'bg-[color:var(--field-bg)] border-[color:var(--card-border)] hover:border-white/30',
)

const TOTAL_STEPS = 4
const STEPS = [
  { key: 'account', label: 'Account', sublabel: 'Phone + profile' },
  { key: 'experience', label: 'Experience', sublabel: 'Role, skills, history' },
  { key: 'certifications', label: 'Certifications', sublabel: 'BCCI levels, NCA' },
  { key: 'association', label: 'Your Association', sublabel: 'Who you coach for' },
]
const COACH_ROLES = [
  { v: 'Head Coach', s: 'Leads a squad or academy', icon: Megaphone },
  { v: 'Assistant Coach', s: 'Supports the head coach', icon: User },
  { v: 'Specialist', s: 'Batting / bowling / fielding focus', icon: Target },
  { v: 'Freelance', s: 'Independent, multiple clients', icon: Star },
]
const SPECIALISATIONS = ['Batting', 'Bowling (Pace)', 'Bowling (Spin)', 'Wicket-keeping', 'Fielding', 'Fitness & Conditioning', 'Mental Skills', 'All-round']
const CERT_LEVELS = [
  { v: 'L1', n: 'BCCI Level 1', s: 'Foundation' },
  { v: 'L2', n: 'BCCI Level 2', s: 'Intermediate' },
  { v: 'L3', n: 'BCCI Level 3', s: 'Advanced' },
  { v: 'NCA', n: 'NCA', s: 'National' },
  { v: 'NIS', n: 'NIS', s: 'Sports Institute' },
  { v: 'None', n: 'No Cert', s: 'Informal experience' },
]

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

interface AssociationOption { id: string; name: string; state: string; type: string }

export default function CoachOnboardingPage() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const router = useRouter()

  // Re-entry locks — see src/app/onboarding/page.tsx's identical
  // `locksRef` for why this needs to be a ref (checked/mutated
  // synchronously) rather than relying on the `sendingOtp`/`verifyingOtp`
  // state flags alone: two click events fired in the same tick both read
  // the same pre-render state value, since neither click's state update
  // has committed when the second one runs.
  const locksRef = useRef<Set<string>>(new Set())

  // Step 1
  const [coachName, setCoachName] = useState('')
  const [mobile, setMobile] = useState('')
  const [otpRequestId, setOtpRequestId] = useState('')
  const [otpDevCode, setOtpDevCode] = useState('')
  const [otp, setOtp] = useState('')
  const [otpVerified, setOtpVerified] = useState(false)
  const [sendingOtp, setSendingOtp] = useState(false)
  const [verifyingOtp, setVerifyingOtp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [city, setCity] = useState('')
  const [photoUploaded, setPhotoUploaded] = useState(false)

  // Step 2 — Experience (UI only, not persisted)
  const [coachRole, setCoachRole] = useState('Head Coach')
  const [specialisations, setSpecialisations] = useState<string[]>([])
  const [years, setYears] = useState(0)
  const [playedHigh, setPlayedHigh] = useState('No')
  const [playedLevel, setPlayedLevel] = useState('')
  const [playedRole, setPlayedRole] = useState('')

  // Step 3 — Certifications (UI only, not persisted)
  const [certLevel, setCertLevel] = useState('')
  const [certUploaded, setCertUploaded] = useState(false)

  // Step 4 — Association (real, required — replaces the mockup's academy UI)
  const [associations, setAssociations] = useState<AssociationOption[]>([])
  const [associationQuery, setAssociationQuery] = useState('')
  const [associationId, setAssociationId] = useState('')

  useEffect(() => {
    if (step !== 4) return
    fetch('/api/coach/onboard/associations')
      .then((r) => r.json())
      .then((d) => setAssociations(d.associations ?? []))
      .catch(() => setAssociations([]))
  }, [step])

  function toggleSpec(v: string) {
    setSpecialisations(s => s.includes(v) ? s.filter(x => x !== v) : [...s, v])
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
      const res = await fetch('/api/coach/onboard/send-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not send OTP')
      setOtpRequestId(data.requestId)
      setOtpDevCode(data.devCode)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send OTP')
    } finally {
      setSendingOtp(false)
    }
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
      if (otp.replace(/\D/g, '') !== otpDevCode) throw new Error('Incorrect OTP')
      setOtpVerified(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Incorrect OTP')
    } finally {
      setVerifyingOtp(false)
    }
  }

  function canProceed() {
    if (step === 1) return otpVerified && Boolean(coachName && email && password)
    if (step === 4) return Boolean(associationId)
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
      const res = await fetch('/api/coach/onboard', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, requestId: otpRequestId, otp, email, password, coach_name: coachName, associationId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to set up your coach profile')
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set up your coach profile')
    } finally {
      setLoading(false)
      locksRef.current.delete('step-advance')
    }
  }

  const progress = (step / TOTAL_STEPS) * 100
  const filteredAssociations = associations.filter(a =>
    !associationQuery || a.name.toLowerCase().includes(associationQuery.toLowerCase()) || a.state.toLowerCase().includes(associationQuery.toLowerCase()))

  return (
    <div className={cn(anton.variable, barlow.variable, barlowSemi.variable)} style={OB_VARS}>
      <div className="h-screen grid lg:grid-cols-[1fr_2fr] bg-[color:var(--bg)] font-[family-name:var(--font-barlow)] text-[color:var(--text)]">
        {/* ── LEFT RAIL ── */}
        <aside className="relative overflow-hidden flex flex-col p-8 lg:p-[2.618rem] bg-[color:var(--bg-soft)]">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(110% 75% at 0% 0%, var(--ov14), transparent 55%), linear-gradient(160deg, #1a0c04 0%, #0d0d0d 52%, #050505 100%)' }}
          />
          <div className="relative z-10 flex flex-col flex-1">
            <div className="font-[family-name:var(--font-barlow-semi)] uppercase tracking-[0.22em] font-bold text-[0.95rem] text-[color:var(--text)]">
              ATHLAS<span className="text-[color:var(--accent)]">X</span>
            </div>
            <div className="mt-6">
              <p className="font-[family-name:var(--font-barlow-semi)] uppercase tracking-[0.2em] text-[11px] font-bold text-[color:var(--accent-bright)] mb-1.5">Coach Onboarding</p>
              <h1 className="font-[family-name:var(--font-anton)] uppercase font-normal leading-[0.92] text-[42px] text-[color:var(--text)]">
                Join as a <b className="text-[color:var(--accent)] font-normal">coach.</b>
              </h1>
              <p className="mt-3.5 text-sm leading-relaxed text-[color:var(--text-dim)] max-w-[22rem]">Four steps. Share your experience, get verified, and start coaching on AthlasX.</p>
            </div>

            <StepRail steps={STEPS} currentIndex={done ? STEPS.length : step - 1} completedIndices={done ? STEPS.map((_, i) => i) : undefined} className="mt-8" />
          </div>
        </aside>

        {/* ── RIGHT PANEL ── */}
        <main className="relative flex flex-col min-w-0 min-h-0">
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(110% 50% at 100% 0%, var(--ov08), transparent 55%)' }} />

          <div className="relative z-20 h-[3px] bg-[color:var(--card-border)]">
            <motion.div className="h-full" style={{ background: 'linear-gradient(90deg, var(--accent), var(--accent-bright))' }}
              initial={{ width: 0 }} animate={{ width: done ? '100%' : `${progress}%` }} transition={{ duration: 0.5 }} />
          </div>

          <div className="relative z-10 flex-1 overflow-y-auto">
            <div className="w-full max-w-[40rem] mx-auto px-6 sm:px-10 py-8 sm:py-10">
              {done ? (
                <div className="text-center py-10">
                  <div className="w-20 h-20 mx-auto rounded-full bg-[color:var(--ov14)] border-[1.5px] border-[color:var(--accent)] flex items-center justify-center mb-6">
                    <CheckCircle2 className="w-10 h-10 text-[color:var(--accent)]" />
                  </div>
                  <h2 className="font-[family-name:var(--font-anton)] uppercase font-normal text-[clamp(30px,4vw,44px)] leading-[0.92] text-[color:var(--text)] mb-3">
                    You&apos;re a <b className="text-[color:var(--accent)] font-normal">coach</b> on AthlasX.
                  </h2>
                  <p className="text-[0.95rem] text-[color:var(--text-dim)] leading-relaxed max-w-[28rem] mx-auto">Your profile is submitted. Certifications are under review (24–48h) — you can start coaching now with a pending badge.</p>
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div key={step} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.25 }} style={{ pointerEvents: transitioning ? 'none' : 'auto' }}>

                    {step === 1 && (
                      <>
                        <p className="font-[family-name:var(--font-barlow-semi)] uppercase tracking-[0.18em] text-[11px] font-bold text-[color:var(--accent-bright)] mb-1.5">Step 1 of 4</p>
                        <h2 className="font-[family-name:var(--font-anton)] uppercase font-normal leading-[0.92] text-[40px] text-[color:var(--text)] mb-2">Create your account</h2>
                        <p className="text-sm leading-relaxed text-[color:var(--text-dim)] max-w-[32rem] mb-7">Your name and number become your coach profile. We verify by OTP.</p>

                        <div className="grid grid-cols-2 gap-x-4 mb-4">
                          <div className="col-span-2">
                            <Label className={LABEL_CLS}>Full Name<span className="text-[color:var(--accent)] ml-0.5">*</span></Label>
                            <Input value={coachName} onChange={e => setCoachName(e.target.value)} placeholder="e.g. Anil Kumble" className={cn(FIELD_CLS, 'mt-1.5 mb-4')} />
                          </div>
                        </div>

                        <div className="mb-4">
                          <Label className={LABEL_CLS}>Mobile Number<span className="text-[color:var(--accent)] ml-0.5">*</span></Label>
                          <div className="flex gap-2 mt-1.5">
                            <span className="flex-none flex items-center px-3.5 border border-[color:var(--card-border)] rounded-[9px] bg-[color:var(--field-bg)] font-bold text-[0.92rem] text-[color:var(--text)]">+91</span>
                            <Input value={mobile} onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="98765 43210" disabled={otpVerified} className={FIELD_CLS} />
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
                            <div className="flex gap-2 mt-1.5">
                              <Input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" className={FIELD_CLS} />
                              <button type="button" onClick={verifyOtp} disabled={verifyingOtp}
                                className="flex-none px-4 rounded-[9px] border-[1.5px] border-[color:var(--card-border)] text-[color:var(--text)] font-[family-name:var(--font-barlow-semi)] uppercase tracking-wide font-bold text-xs hover:border-white/50 transition-colors disabled:opacity-50">
                                {verifyingOtp ? 'Verifying…' : 'Verify'}
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <Label className={LABEL_CLS}>Email<span className="text-[color:var(--accent)] ml-0.5">*</span></Label>
                            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" className={cn(FIELD_CLS, 'mt-1.5')} />
                          </div>
                          <div>
                            <Label className={LABEL_CLS}>Password<span className="text-[color:var(--accent)] ml-0.5">*</span></Label>
                            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Choose a password" autoComplete="new-password" className={cn(FIELD_CLS, 'mt-1.5')} />
                          </div>
                        </div>
                        <p className="text-[11px] text-[color:var(--text-faint)] mb-4">Email + password sign you back in later — WhatsApp OTP only verifies this number belongs to you now.</p>

                        <div className="grid grid-cols-2 gap-4 mb-5">
                          <div>
                            <Label className={LABEL_CLS}>City</Label>
                            <Input value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Bengaluru" className={cn(FIELD_CLS, 'mt-1.5')} />
                          </div>
                          <div>
                            <Label className={LABEL_CLS}>Display Photo<span className="text-[color:var(--text-faint)] font-medium tracking-normal normal-case ml-1.5">optional</span></Label>
                            <button type="button" onClick={() => setPhotoUploaded(true)}
                              className="w-full mt-1.5 h-[42px] flex items-center justify-center gap-2 rounded-[9px] border-2 border-dashed border-[color:var(--accent)] bg-[color:var(--ov08)] hover:bg-[color:var(--ov14)] transition-colors">
                              <Upload className="w-4 h-4 text-[color:var(--accent)]" />
                              <span className="text-[0.82rem] font-bold text-[color:var(--text)]">{photoUploaded ? 'Uploaded ✓' : 'Upload a headshot'}</span>
                            </button>
                          </div>
                        </div>
                      </>
                    )}

                    {step === 2 && (
                      <>
                        <p className="font-[family-name:var(--font-barlow-semi)] uppercase tracking-[0.18em] text-[11px] font-bold text-[color:var(--accent-bright)] mb-1.5">Step 2 of 4</p>
                        <h2 className="font-[family-name:var(--font-anton)] uppercase font-normal leading-[0.92] text-[40px] text-[color:var(--text)] mb-2">Experience</h2>
                        <p className="text-sm leading-relaxed text-[color:var(--text-dim)] max-w-[32rem] mb-7">Your coaching background helps us match you with the right academies and players.</p>

                        <div className="mb-5">
                          <Label className={LABEL_CLS}>Primary Coaching Role</Label>
                          <div className="grid grid-cols-2 gap-2.5 mt-2">
                            {COACH_ROLES.map(r => (
                              <button key={r.v} type="button" onClick={() => setCoachRole(r.v)}
                                className={cn('flex items-start gap-2.5 text-left px-3.5 py-3 rounded-[11px]', OPTCARD_CLS(coachRole === r.v))}>
                                <span className={cn('w-8 h-8 flex-none rounded-[8px] grid place-items-center', coachRole === r.v ? 'bg-[color:var(--accent)] text-[#1a0e02]' : 'bg-[rgba(255,138,30,0.16)] text-[color:var(--accent-bright)]')}>
                                  <r.icon className="w-[17px] h-[17px]" />
                                </span>
                                <span>
                                  <span className="block text-[0.94rem] font-bold text-[color:var(--text)]">{r.v}</span>
                                  <span className="block text-[0.74rem] leading-snug text-[color:var(--text-dim)]">{r.s}</span>
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="mb-5">
                          <Label className={LABEL_CLS}>Coaching Specialisation</Label>
                          <div className="flex flex-wrap gap-2 mt-1.5">{SPECIALISATIONS.map(v => <Chip key={v} label={v} active={specialisations.includes(v)} onClick={() => toggleSpec(v)} />)}</div>
                        </div>

                        <div className="mb-5">
                          <Label className={LABEL_CLS}>Years of Coaching Experience</Label>
                          <div className="mt-1.5"><NumStep value={years} onChange={setYears} min={0} max={50} /></div>
                        </div>

                        <div>
                          <Label className={LABEL_CLS}>Played at State / Higher Level?</Label>
                          <div className="flex gap-2 mt-1.5">{['Yes', 'No'].map(v => <Chip key={v} label={v} active={playedHigh === v} onClick={() => setPlayedHigh(v)} />)}</div>
                          {playedHigh === 'Yes' && (
                            <div className="grid grid-cols-2 gap-4 p-[0.9rem] mt-[0.7rem] rounded-[10px] bg-[color:var(--field-bg)] border border-[color:var(--card-border)]">
                              <div>
                                <Label className={LABEL_CLS}>Highest Level Played</Label>
                                <select value={playedLevel} onChange={e => setPlayedLevel(e.target.value)} className={cn(FIELD_CLS, 'mt-1.5 w-full px-3.5 appearance-none cursor-pointer')}>
                                  <option value="" className="bg-[#141312]">Select level</option>
                                  {['District', 'State', 'Ranji Trophy', 'India A', 'International', 'IPL / Franchise'].map(l => <option key={l} value={l} className="bg-[#141312]">{l}</option>)}
                                </select>
                              </div>
                              <div>
                                <Label className={LABEL_CLS}>Playing Role</Label>
                                <select value={playedRole} onChange={e => setPlayedRole(e.target.value)} className={cn(FIELD_CLS, 'mt-1.5 w-full px-3.5 appearance-none cursor-pointer')}>
                                  <option value="" className="bg-[#141312]">Select role</option>
                                  {['Batsman', 'Bowler', 'All-Rounder', 'Wicket-Keeper'].map(r => <option key={r} value={r} className="bg-[#141312]">{r}</option>)}
                                </select>
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {step === 3 && (
                      <>
                        <p className="font-[family-name:var(--font-barlow-semi)] uppercase tracking-[0.18em] text-[11px] font-bold text-[color:var(--accent-bright)] mb-1.5">Step 3 of 4</p>
                        <h2 className="font-[family-name:var(--font-anton)] uppercase font-normal leading-[0.92] text-[40px] text-[color:var(--text)] mb-2">Certifications</h2>
                        <p className="text-sm leading-relaxed text-[color:var(--text-dim)] max-w-[32rem] mb-7">Verified certifications build trust with academies and parents. Upload whatever you have — even a single cert helps.</p>

                        <div className="mb-5">
                          <Label className={LABEL_CLS}>Highest Certification Level</Label>
                          <div className="grid grid-cols-3 gap-2 mt-2">
                            {CERT_LEVELS.map(c => (
                              <button key={c.v} type="button" onClick={() => setCertLevel(c.v)}
                                className={cn('flex flex-col items-center gap-1.5 p-3 text-center', OPTCARD_CLS(certLevel === c.v))}>
                                <span className={cn('w-9 h-9 rounded-[8px] flex items-center justify-center text-[0.7rem] font-bold',
                                  certLevel === c.v ? 'bg-[color:var(--accent)] text-[#1a0e02]' : 'bg-white/[0.06] text-[color:var(--text)]')}>
                                  {c.v === 'None' ? <X className="w-4 h-4" /> : c.v}
                                </span>
                                <span className="text-[0.78rem] font-bold text-[color:var(--text)]">{c.n}</span>
                                <span className="text-[0.68rem] text-[color:var(--text-dim)]">{c.s}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <button type="button" onClick={() => setCertUploaded(true)}
                          className="w-full flex flex-col items-center gap-1.5 p-7 rounded-[11px] border-2 border-dashed border-[color:var(--accent)] bg-[color:var(--ov08)] hover:bg-[color:var(--ov14)] transition-colors mb-4">
                          <Upload className="w-[30px] h-[30px] text-[color:var(--accent)]" />
                          <span className="text-[0.9rem] font-bold text-[color:var(--text)]">{certUploaded ? 'Certificate uploaded ✓' : 'Upload certificate or ID proof'}</span>
                          <span className="text-[0.74rem] text-[color:var(--text-faint)]">PDF, PNG, JPG — max 5 MB per file</span>
                        </button>

                        <div className="flex gap-2.5 p-[0.85rem_1rem] rounded-[10px] bg-[color:var(--ov08)] border border-[color:var(--ov22)]">
                          <Info className="w-[18px] h-[18px] text-[color:var(--accent-bright)] mt-0.5 flex-none" />
                          <p className="text-[0.84rem] leading-relaxed text-[color:var(--text)]">Uploaded certs are reviewed within <b className="text-[color:var(--accent-bright)]">24–48 hours</b>. You can still join and coach while verification is pending — academies will see a &quot;pending&quot; badge.</p>
                        </div>
                      </>
                    )}

                    {step === 4 && (
                      <>
                        <p className="font-[family-name:var(--font-barlow-semi)] uppercase tracking-[0.18em] text-[11px] font-bold text-[color:var(--accent-bright)] mb-1.5">Step 4 of 4</p>
                        <h2 className="font-[family-name:var(--font-anton)] uppercase font-normal leading-[0.92] text-[40px] text-[color:var(--text)] mb-2">Your association</h2>
                        <p className="text-sm leading-relaxed text-[color:var(--text-dim)] max-w-[32rem] mb-7">Which cricket association are you affiliated with?</p>

                        <Input value={associationQuery} onChange={e => setAssociationQuery(e.target.value)} placeholder="Search associations by name or state" className={cn(FIELD_CLS, 'mb-3')} />
                        <div className="max-h-72 overflow-y-auto space-y-1.5">
                          {filteredAssociations.map(a => (
                            <button key={a.id} type="button" onClick={() => setAssociationId(a.id)}
                              className={cn('w-full flex items-center justify-between text-left px-4 py-3 rounded-[11px] border-[1.5px] transition-colors',
                                associationId === a.id ? 'border-[color:var(--accent)] bg-[color:var(--ov08)]' : 'border-[color:var(--card-border)] bg-[color:var(--field-bg)] hover:border-white/30')}>
                              <span>
                                <span className="block text-sm font-bold text-[color:var(--text)]">{a.name}</span>
                                <span className="block text-[11px] text-[color:var(--text-dim)] capitalize">{a.type} · {a.state}</span>
                              </span>
                              {associationId === a.id && <CheckCircle2 className="w-4 h-4 text-[color:var(--accent-bright)] shrink-0" />}
                            </button>
                          ))}
                          {filteredAssociations.length === 0 && (
                            <p className="text-xs text-[color:var(--text-faint)] px-1 py-2">No associations found. Try a different search.</p>
                          )}
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
              )}

              {error && step !== 4 && step !== 1 && !done && (
                <p className="mt-4 text-xs text-[color:var(--bad)]">{error}</p>
              )}
            </div>
          </div>

          <div className="relative z-20 flex items-center justify-between gap-4 px-6 sm:px-10 py-4 border-t border-[color:var(--card-border)] bg-[rgba(13,13,13,0.6)] backdrop-blur-md">
            <span className="text-[0.82rem] text-[color:var(--text-dim)]">{done ? 'Done' : `Step ${step} of ${TOTAL_STEPS}`}</span>
            <div className="flex gap-2.5">
              {!done && step > 1 && (
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
                onClick={() => done ? router.push('/coach') : handleNext()}
                disabled={!done && (!canProceed() || loading || transitioning)}
                className={cn('flex items-center gap-2 px-6 py-[0.78rem] rounded-[9px] font-[family-name:var(--font-barlow-semi)] uppercase tracking-wide font-bold text-[0.92rem] transition-all',
                  done || (canProceed() && !loading && !transitioning)
                    ? 'bg-[color:var(--accent)] text-[#1a0e02] border-[1.5px] border-[color:var(--accent)] shadow-[0_8px_22px_-8px_rgba(255,138,30,0.7)] hover:bg-[color:var(--accent-bright)] hover:border-[color:var(--accent-bright)]'
                    : 'bg-white/[0.04] border-[1.5px] border-[color:var(--card-border)] text-[color:var(--text-faint)] cursor-not-allowed')}
              >
                {loading ? (<><Loader2 className="w-4 h-4 animate-spin" /> Setting up…</>)
                  : done ? 'Go to Dashboard'
                  : step === TOTAL_STEPS ? 'Finish →'
                  : <>Save & Continue <ArrowRight className="w-4 h-4" /></>}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
