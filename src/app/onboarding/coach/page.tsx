'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { ArrowRight, ArrowLeft, Loader2, CheckCircle2, Upload, ShieldAlert, Info } from 'lucide-react'
import { Anton, Barlow, Barlow_Semi_Condensed } from 'next/font/google'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import Link from 'next/link'

/*
 * Coach self-serve onboarding — rebuilt from design/import/AthlasX Coach
 * Onboarding.html. Coach accounts were previously seed-only
 * (prisma/seed.ts) with no self-serve path.
 *
 * Findings reported to and confirmed with the user before building:
 *   - The mockup does NOT self-assign a squad anywhere, and does NOT gate
 *     the account behind approval — certification review (24-48h) is
 *     async and non-blocking; the account is fully usable immediately
 *     with a "pending" cert badge.
 *   - The mockup's real Step 4 ("Join an academy" — invite code / browse
 *     / independent) has no home in the schema: CoachProfile.association_id
 *     is required and non-nullable, with no academy relation on
 *     CoachProfile at all. squad-access.ts was checked directly and does
 *     NOT read CoachProfile (coach squad access comes from real
 *     SquadCoach membership rows instead) — CoachProfile itself is
 *     entirely unused elsewhere in src/. So this is a declarative
 *     affiliation field, not a membership grant, and Step 4 here is a
 *     required Association picker (no independent option), accepted
 *     instantly/self-serve rather than gated behind that association's
 *     approval.
 *   - Step 1 adds email+password alongside the mockup's optional-email,
 *     no-password content, same reasoning as the academy/association
 *     flows: nothing else in this codebase can sign a phone-only account
 *     back in.
 *   - Steps 2-3 (Experience, Certifications) are collected for fidelity
 *     to the mockup but not persisted — CoachProfile has no columns for
 *     coaching role, specialisations, years of experience, or
 *     certification level, and adding them wasn't asked for.
 *
 * Presentation-only restyle to design/import/AthlasX Coach Onboarding.html's
 * orange/Anton-Barlow palette, scoped exactly like the player onboarding
 * restyle (f45bf2a): fonts + tokens are inline CSS vars local to this
 * file's wrapper, nothing added to globals.css or tailwind.config.ts. The
 * Association-picker step (Step 4), the certification "pending" badge
 * copy/logic, the send-otp/associations calls, and POST /api/coach/onboard
 * are all untouched — no behavior, field, or copy change.
 */

const anton = Anton({ subsets: ['latin'], weight: '400', variable: '--font-anton' })
const barlow = Barlow({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-barlow' })
const barlowSemi = Barlow_Semi_Condensed({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-barlow-semi' })

// Tokens lifted from design/import/AthlasX Coach Onboarding.html's :root.
const COACH_VARS = {
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
const COACH_ROLES = [
  { v: 'Head Coach', s: 'Leads a squad or academy' },
  { v: 'Assistant Coach', s: 'Supports the head coach' },
  { v: 'Specialist', s: 'Batting / bowling / fielding focus' },
  { v: 'Freelance', s: 'Independent, multiple clients' },
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
      className={cn('px-3.5 py-2 rounded-full text-sm font-semibold border-[1.5px] transition-all',
        active
          ? 'bg-[rgba(255,138,30,0.14)] border-[color:var(--accent)] text-[color:var(--accent-bright)]'
          : 'bg-[color:var(--field-bg)] border-[color:var(--card-border)] text-white/60 hover:border-white/30')}>
      {label}
    </button>
  )
}

interface AssociationOption { id: string; name: string; state: string; type: string }

export default function CoachOnboardingPage() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const router = useRouter()

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
    fetch('/api/coach/onboard/associations').then(r => r.json()).then(d => setAssociations(d.associations ?? []))
  }, [step])

  function toggleSpec(v: string) {
    setSpecialisations(s => s.includes(v) ? s.filter(x => x !== v) : [...s, v])
  }

  async function sendOtp() {
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
    if (step < TOTAL_STEPS) { setStep(s => s + 1); return }

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
    }
  }

  const progress = (step / TOTAL_STEPS) * 100
  const filteredAssociations = associations.filter(a =>
    !associationQuery || a.name.toLowerCase().includes(associationQuery.toLowerCase()) || a.state.toLowerCase().includes(associationQuery.toLowerCase()))

  if (done) {
    return (
      <div className={cn(anton.variable, barlow.variable, barlowSemi.variable)} style={COACH_VARS}>
        <div className="min-h-screen bg-[color:var(--bg)] flex items-center justify-center p-6 font-[family-name:var(--font-barlow)]">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="w-20 h-20 mx-auto rounded-full bg-[color:var(--ok)]/10 border border-[color:var(--ok)]/40 flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 text-[color:var(--ok)]" />
            </div>
            <h2 className="font-[family-name:var(--font-anton)] uppercase font-normal text-3xl text-white">You&apos;re a coach on AthlasX.</h2>
            <p className="text-sm text-white/60">Your profile is submitted. Certifications are under review (24–48h) — you can start coaching now with a pending badge.</p>
            <button onClick={() => router.push('/coach')}
              className="font-[family-name:var(--font-barlow-semi)] mt-4 px-6 py-2.5 rounded-[9px] text-sm font-bold uppercase tracking-wide bg-[color:var(--accent)] text-[#1a0e02] shadow-[0_8px_22px_-8px_rgba(255,138,30,0.7)] hover:bg-[color:var(--accent-bright)] transition-colors">
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(anton.variable, barlow.variable, barlowSemi.variable)} style={COACH_VARS}>
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
                      <h2 className="font-[family-name:var(--font-anton)] uppercase font-normal text-3xl text-white mb-1">Create your account</h2>
                      <p className="text-white/50 text-sm">Your name and number become your coach profile. We verify by OTP.</p>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label className={LABEL_CLS}>Full name *</Label>
                        <Input value={coachName} onChange={e => setCoachName(e.target.value)} placeholder="e.g. Anil Kumble"
                          className={FIELD_CLS} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className={LABEL_CLS}>Mobile number *</Label>
                        <div className="flex gap-2">
                          <span className="flex items-center px-3 rounded-[9px] bg-[color:var(--field-bg)] border border-[color:var(--card-border)] text-white/80 text-sm font-bold">+91</span>
                          <Input value={mobile} onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="98765 43210" disabled={otpVerified}
                            className={FIELD_CLS} />
                          {!otpVerified && (
                            <button type="button" onClick={sendOtp} disabled={sendingOtp}
                              className="font-[family-name:var(--font-barlow-semi)] shrink-0 text-xs font-bold uppercase tracking-wide px-4 rounded-[9px] bg-[color:var(--accent)] text-[#1a0e02] hover:bg-[color:var(--accent-bright)] transition-colors disabled:opacity-50">
                              {sendingOtp ? 'Sending…' : otpRequestId ? 'Resend OTP' : 'Send OTP'}
                            </button>
                          )}
                        </div>
                      </div>

                      {otpVerified ? (
                        <div className="flex items-center gap-2 p-3 rounded-[9px] border border-[color:var(--ok)]/40 bg-[color:var(--ok)]/10 text-[color:var(--ok)] text-sm font-semibold">
                          <CheckCircle2 className="w-4 h-4" /> Mobile number verified
                        </div>
                      ) : otpRequestId && (
                        <div className="space-y-2">
                          <div className="p-2.5 rounded-[9px] border border-[color:var(--card-border)] bg-[rgba(255,138,30,0.08)]">
                            <p className="text-[11px] font-bold text-[color:var(--accent-bright)]">Dev mode — no SMS gateway connected</p>
                            <p className="text-xs text-white/70 mt-0.5">Your test code is <span className="font-mono font-bold text-white">{otpDevCode}</span></p>
                          </div>
                          <Label className={LABEL_CLS}>Enter OTP</Label>
                          <div className="flex gap-2">
                            <Input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code"
                              className={FIELD_CLS} />
                            <button type="button" onClick={verifyOtp} disabled={verifyingOtp}
                              className="font-[family-name:var(--font-barlow-semi)] shrink-0 text-xs font-bold uppercase tracking-wide px-4 rounded-[9px] border-[1.5px] border-[color:var(--card-border)] text-white hover:border-white/50 transition-colors disabled:opacity-50">
                              {verifyingOtp ? 'Verifying…' : 'Verify'}
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="pt-3 border-t border-[color:var(--card-border)] space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className={LABEL_CLS}>Email *</Label>
                            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email"
                              className={FIELD_CLS} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className={LABEL_CLS}>Password *</Label>
                            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Choose a password" autoComplete="new-password"
                              className={FIELD_CLS} />
                          </div>
                        </div>
                        <p className="text-[10px] text-white/40">Email + password sign you back in later — WhatsApp OTP only verifies this number belongs to you now.</p>
                        <div className="space-y-1.5">
                          <Label className={LABEL_CLS}>City</Label>
                          <Input value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Bengaluru"
                            className={FIELD_CLS} />
                        </div>
                        <button type="button" onClick={() => setPhotoUploaded(true)}
                          className="w-full flex flex-col items-center gap-1.5 p-5 rounded-[11px] border-2 border-dashed border-[color:var(--accent)] bg-[rgba(255,138,30,0.08)] hover:bg-[rgba(255,138,30,0.14)] transition-colors">
                          <Upload className="w-5 h-5 text-[color:var(--accent)]" />
                          <span className="text-sm font-bold text-white">{photoUploaded ? 'Photo uploaded ✓' : 'Upload a headshot'}</span>
                          <span className="text-[11px] text-white/40">PNG or JPG — max 5 MB</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {step === 2 && (
                  <>
                    <div>
                      <h2 className="font-[family-name:var(--font-anton)] uppercase font-normal text-3xl text-white mb-1">Experience</h2>
                      <p className="text-white/50 text-sm">Your coaching background helps us match you with the right academies and players.</p>
                    </div>
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <Label className={LABEL_CLS}>Primary coaching role</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {COACH_ROLES.map(r => (
                            <button key={r.v} type="button" onClick={() => setCoachRole(r.v)}
                              className={cn('text-left px-3 py-2.5', OPTCARD_CLS(coachRole === r.v))}>
                              <span className="block text-sm font-bold text-white">{r.v}</span>
                              <span className="block text-[11px] text-white/50">{r.s}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className={LABEL_CLS}>Coaching specialisation</Label>
                        <div className="flex flex-wrap gap-2">{SPECIALISATIONS.map(v => <Chip key={v} label={v} active={specialisations.includes(v)} onClick={() => toggleSpec(v)} />)}</div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className={LABEL_CLS}>Years of coaching experience</Label>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => setYears(n => Math.max(0, n - 1))} className="w-9 h-9 rounded-[9px] bg-[color:var(--field-bg)] border border-[color:var(--card-border)] text-white font-bold">−</button>
                          <span className="w-10 text-center text-sm font-bold text-white">{years}</span>
                          <button type="button" onClick={() => setYears(n => Math.min(50, n + 1))} className="w-9 h-9 rounded-[9px] bg-[color:var(--field-bg)] border border-[color:var(--card-border)] text-white font-bold">+</button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className={LABEL_CLS}>Played at state / higher level?</Label>
                        <div className="flex gap-2">{['Yes', 'No'].map(v => <Chip key={v} label={v} active={playedHigh === v} onClick={() => setPlayedHigh(v)} />)}</div>
                        {playedHigh === 'Yes' && (
                          <div className="grid grid-cols-2 gap-4 p-3 rounded-[11px] bg-white/[0.03] border border-[color:var(--card-border)] mt-2">
                            <div className="space-y-1.5">
                              <Label className={LABEL_CLS}>Highest level played</Label>
                              <select value={playedLevel} onChange={e => setPlayedLevel(e.target.value)}
                                className={cn('w-full px-3', FIELD_CLS)}>
                                <option value="" className="bg-[#141312]">Select level</option>
                                {['District', 'State', 'Ranji Trophy', 'India A', 'International', 'IPL / Franchise'].map(l => <option key={l} value={l} className="bg-[#141312]">{l}</option>)}
                              </select>
                            </div>
                            <div className="space-y-1.5">
                              <Label className={LABEL_CLS}>Playing role</Label>
                              <select value={playedRole} onChange={e => setPlayedRole(e.target.value)}
                                className={cn('w-full px-3', FIELD_CLS)}>
                                <option value="" className="bg-[#141312]">Select role</option>
                                {['Batsman', 'Bowler', 'All-Rounder', 'Wicket-Keeper'].map(r => <option key={r} value={r} className="bg-[#141312]">{r}</option>)}
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {step === 3 && (
                  <>
                    <div>
                      <h2 className="font-[family-name:var(--font-anton)] uppercase font-normal text-3xl text-white mb-1">Certifications</h2>
                      <p className="text-white/50 text-sm">Verified certifications build trust with academies and parents. Upload whatever you have — even a single cert helps.</p>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label className={LABEL_CLS}>Highest certification level</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {CERT_LEVELS.map(c => (
                            <button key={c.v} type="button" onClick={() => setCertLevel(c.v)}
                              className={cn('flex flex-col items-center gap-1.5 p-3 text-center', OPTCARD_CLS(certLevel === c.v))}>
                              <span className={cn('w-10 h-10 rounded-[8px] flex items-center justify-center text-xs font-bold',
                                certLevel === c.v ? 'bg-[color:var(--accent)] text-[#1a0e02]' : 'bg-white/[0.06] text-white')}>{c.v}</span>
                              <span className="text-xs font-bold text-white">{c.n}</span>
                              <span className="text-[10px] text-white/50">{c.s}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <button type="button" onClick={() => setCertUploaded(true)}
                        className="w-full flex flex-col items-center gap-1.5 p-6 rounded-[11px] border-2 border-dashed border-[color:var(--accent)] bg-[rgba(255,138,30,0.08)] hover:bg-[rgba(255,138,30,0.14)] transition-colors">
                        <Upload className="w-6 h-6 text-[color:var(--accent)]" />
                        <span className="text-sm font-bold text-white">{certUploaded ? 'Certificate uploaded ✓' : 'Upload certificate or ID proof'}</span>
                        <span className="text-[11px] text-white/40">PDF, PNG, JPG — max 5 MB per file</span>
                      </button>
                      <div className="flex items-start gap-2.5 p-4 rounded-[14px] border border-[color:var(--card-border)] bg-white/[0.02]">
                        <Info className="w-4 h-4 text-white/50 mt-0.5 shrink-0" />
                        <p className="text-xs text-white/50">Uploaded certs are reviewed within <b className="text-white/80">24–48 hours</b>. You can still join and coach while verification is pending — academies will see a &quot;pending&quot; badge.</p>
                      </div>
                    </div>
                  </>
                )}

                {step === 4 && (
                  <>
                    <div>
                      <h2 className="font-[family-name:var(--font-anton)] uppercase font-normal text-3xl text-white mb-1">Your association</h2>
                      <p className="text-white/50 text-sm">Which cricket association are you affiliated with?</p>
                    </div>
                    <div className="space-y-3">
                      <Input value={associationQuery} onChange={e => setAssociationQuery(e.target.value)} placeholder="Search associations by name or state"
                        className={FIELD_CLS} />
                      <div className="max-h-72 overflow-y-auto space-y-1.5">
                        {filteredAssociations.map(a => (
                          <button key={a.id} type="button" onClick={() => setAssociationId(a.id)}
                            className={cn('w-full flex items-center justify-between text-left px-4 py-3 rounded-[11px] border-[1.5px] transition-colors',
                              associationId === a.id
                                ? 'border-[color:var(--accent)] bg-[rgba(255,138,30,0.08)]'
                                : 'border-[color:var(--card-border)] bg-[color:var(--field-bg)] hover:border-white/30')}>
                            <span>
                              <span className="block text-sm font-bold text-white">{a.name}</span>
                              <span className="block text-[11px] text-white/50 capitalize">{a.type} · {a.state}</span>
                            </span>
                            {associationId === a.id && <CheckCircle2 className="w-4 h-4 text-[color:var(--accent-bright)] shrink-0" />}
                          </button>
                        ))}
                        {filteredAssociations.length === 0 && (
                          <p className="text-xs text-white/40 px-1 py-2">No associations found. Try a different search.</p>
                        )}
                      </div>
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

            {error && step !== 4 && step !== 1 && (
              <p className="mt-4 text-xs text-[color:var(--bad)]">{error}</p>
            )}

            <div className="flex items-center justify-between mt-8 gap-4">
              {step > 1 ? (
                <button onClick={() => setStep(s => s - 1)}
                  className="font-[family-name:var(--font-barlow-semi)] flex items-center gap-2 px-4 py-2.5 rounded-[9px] bg-transparent border-[1.5px] border-[color:var(--card-border)] text-white/70 hover:text-white hover:border-white/40 text-sm font-bold uppercase tracking-wide transition-colors">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
              ) : <div />}
              <button
                onClick={handleNext}
                disabled={!canProceed() || loading}
                className={cn(
                  'font-[family-name:var(--font-barlow-semi)] flex items-center gap-2 px-6 py-2.5 rounded-[9px] text-sm font-bold uppercase tracking-wide transition-all',
                  canProceed() && !loading
                    ? 'bg-[color:var(--accent)] text-[#1a0e02] shadow-[0_8px_22px_-8px_rgba(255,138,30,0.7)] hover:bg-[color:var(--accent-bright)]'
                    : 'bg-white/[0.04] border border-[color:var(--card-border)] text-white/40 cursor-not-allowed',
                )}
              >
                {loading ? (<><Loader2 className="w-4 h-4 animate-spin" /> Setting up…</>)
                  : step === TOTAL_STEPS ? (<><CheckCircle2 className="w-4 h-4" /> Finish</>)
                  : (<>Save & Continue <ArrowRight className="w-4 h-4" /></>)}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
