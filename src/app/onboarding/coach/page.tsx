'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { ArrowRight, ArrowLeft, Loader2, Zap, CheckCircle2, Upload, ShieldAlert, Info } from 'lucide-react'
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
 * Uses the app's existing tokens rather than the mockup's orange/Anton
 * palette, same unresolved design-system decision noted throughout
 * design/import/MAPPING.md.
 */

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
      className={cn('px-3.5 py-2 rounded-full text-sm font-semibold border transition-all',
        active ? 'bg-green-500/15 border-green-500/40 text-green-400' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:bg-white/[0.06]')}>
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
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-20 h-20 mx-auto rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
            <CheckCircle2 className="w-9 h-9 text-green-400" />
          </div>
          <h2 className="text-3xl font-black text-white">You&apos;re a coach on AthlasX.</h2>
          <p className="text-sm text-zinc-400">Your profile is submitted. Certifications are under review (24–48h) — you can start coaching now with a pending badge.</p>
          <button onClick={() => router.push('/coach')} className="mt-4 px-6 py-2.5 rounded-xl text-sm font-bold bg-green-600 hover:bg-green-500 text-white transition-colors">
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col">
      <div className="border-b border-white/[0.05] px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-400 to-emerald-700 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white fill-white" />
          </div>
          <span className="text-xl font-black tracking-tight">Athlas<span className="text-gradient-green">X</span></span>
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
                    <h2 className="text-3xl font-black text-white mb-1">Create your account</h2>
                    <p className="text-zinc-500 text-sm">Your name and number become your coach profile. We verify by OTP.</p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-zinc-400 text-sm">Full name *</Label>
                      <Input value={coachName} onChange={e => setCoachName(e.target.value)} placeholder="e.g. Anil Kumble"
                        className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-zinc-400 text-sm">Mobile number *</Label>
                      <div className="flex gap-2">
                        <span className="flex items-center px-3 rounded-xl bg-white/[0.05] border border-white/10 text-zinc-300 text-sm font-bold">+91</span>
                        <Input value={mobile} onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="98765 43210" disabled={otpVerified}
                          className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50" />
                        {!otpVerified && (
                          <button type="button" onClick={sendOtp} disabled={sendingOtp}
                            className="shrink-0 text-xs font-bold px-4 rounded-xl bg-green-600 hover:bg-green-500 text-white disabled:opacity-50">
                            {sendingOtp ? 'Sending…' : otpRequestId ? 'Resend OTP' : 'Send OTP'}
                          </button>
                        )}
                      </div>
                    </div>

                    {otpVerified ? (
                      <div className="flex items-center gap-2 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm font-semibold">
                        <CheckCircle2 className="w-4 h-4" /> Mobile number verified
                      </div>
                    ) : otpRequestId && (
                      <div className="space-y-2">
                        <div className="p-2.5 rounded-lg border border-amber-500/25 bg-amber-500/[0.08]">
                          <p className="text-[11px] font-bold text-amber-400">Dev mode — no SMS gateway connected</p>
                          <p className="text-xs text-amber-300/90 mt-0.5">Your test code is <span className="font-mono font-bold">{otpDevCode}</span></p>
                        </div>
                        <Label className="text-zinc-400 text-sm">Enter OTP</Label>
                        <div className="flex gap-2">
                          <Input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code"
                            className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50" />
                          <button type="button" onClick={verifyOtp} disabled={verifyingOtp}
                            className="shrink-0 text-xs font-bold px-4 rounded-xl bg-white/[0.06] border border-white/10 text-white hover:bg-white/[0.1] disabled:opacity-50">
                            {verifyingOtp ? 'Verifying…' : 'Verify'}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="pt-3 border-t border-white/[0.06] space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-zinc-400 text-sm">Email *</Label>
                          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email"
                            className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-zinc-400 text-sm">Password *</Label>
                          <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Choose a password" autoComplete="new-password"
                            className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50" />
                        </div>
                      </div>
                      <p className="text-[10px] text-zinc-700">Email + password sign you back in later — WhatsApp OTP only verifies this number belongs to you now.</p>
                      <div className="space-y-1.5">
                        <Label className="text-zinc-400 text-sm">City</Label>
                        <Input value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Bengaluru"
                          className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50" />
                      </div>
                      <button type="button" onClick={() => setPhotoUploaded(true)}
                        className="w-full flex flex-col items-center gap-1.5 p-5 rounded-xl border-2 border-dashed border-green-500/40 bg-green-500/[0.04] hover:bg-green-500/[0.08] transition-colors">
                        <Upload className="w-5 h-5 text-green-400" />
                        <span className="text-sm font-bold text-white">{photoUploaded ? 'Photo uploaded ✓' : 'Upload a headshot'}</span>
                        <span className="text-[11px] text-zinc-600">PNG or JPG — max 5 MB</span>
                      </button>
                    </div>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div>
                    <h2 className="text-3xl font-black text-white mb-1">Experience</h2>
                    <p className="text-zinc-500 text-sm">Your coaching background helps us match you with the right academies and players.</p>
                  </div>
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label className="text-zinc-400 text-sm">Primary coaching role</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {COACH_ROLES.map(r => (
                          <button key={r.v} type="button" onClick={() => setCoachRole(r.v)}
                            className={cn('text-left px-3 py-2.5 rounded-xl border transition-all',
                              coachRole === r.v ? 'bg-green-500/15 border-green-500/40' : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]')}>
                            <span className="block text-sm font-bold text-white">{r.v}</span>
                            <span className="block text-[11px] text-zinc-500">{r.s}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-zinc-400 text-sm">Coaching specialisation</Label>
                      <div className="flex flex-wrap gap-2">{SPECIALISATIONS.map(v => <Chip key={v} label={v} active={specialisations.includes(v)} onClick={() => toggleSpec(v)} />)}</div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-zinc-400 text-sm">Years of coaching experience</Label>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setYears(n => Math.max(0, n - 1))} className="w-9 h-9 rounded-lg bg-white/[0.05] border border-white/10 text-white font-bold">−</button>
                        <span className="w-10 text-center text-sm font-bold text-white">{years}</span>
                        <button type="button" onClick={() => setYears(n => Math.min(50, n + 1))} className="w-9 h-9 rounded-lg bg-white/[0.05] border border-white/10 text-white font-bold">+</button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-zinc-400 text-sm">Played at state / higher level?</Label>
                      <div className="flex gap-2">{['Yes', 'No'].map(v => <Chip key={v} label={v} active={playedHigh === v} onClick={() => setPlayedHigh(v)} />)}</div>
                      {playedHigh === 'Yes' && (
                        <div className="grid grid-cols-2 gap-4 p-3 rounded-xl bg-white/[0.03] border border-white/10 mt-2">
                          <div className="space-y-1.5">
                            <Label className="text-zinc-400 text-sm">Highest level played</Label>
                            <select value={playedLevel} onChange={e => setPlayedLevel(e.target.value)}
                              className="w-full h-10 px-3 rounded-xl bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-green-500/50">
                              <option value="" className="bg-zinc-900">Select level</option>
                              {['District', 'State', 'Ranji Trophy', 'India A', 'International', 'IPL / Franchise'].map(l => <option key={l} value={l} className="bg-zinc-900">{l}</option>)}
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-zinc-400 text-sm">Playing role</Label>
                            <select value={playedRole} onChange={e => setPlayedRole(e.target.value)}
                              className="w-full h-10 px-3 rounded-xl bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-green-500/50">
                              <option value="" className="bg-zinc-900">Select role</option>
                              {['Batsman', 'Bowler', 'All-Rounder', 'Wicket-Keeper'].map(r => <option key={r} value={r} className="bg-zinc-900">{r}</option>)}
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
                    <h2 className="text-3xl font-black text-white mb-1">Certifications</h2>
                    <p className="text-zinc-500 text-sm">Verified certifications build trust with academies and parents. Upload whatever you have — even a single cert helps.</p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-zinc-400 text-sm">Highest certification level</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {CERT_LEVELS.map(c => (
                          <button key={c.v} type="button" onClick={() => setCertLevel(c.v)}
                            className={cn('flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all',
                              certLevel === c.v ? 'bg-green-500/15 border-green-500/40' : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]')}>
                            <span className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center text-xs font-bold text-white">{c.v}</span>
                            <span className="text-xs font-bold text-white">{c.n}</span>
                            <span className="text-[10px] text-zinc-500">{c.s}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <button type="button" onClick={() => setCertUploaded(true)}
                      className="w-full flex flex-col items-center gap-1.5 p-6 rounded-xl border-2 border-dashed border-green-500/40 bg-green-500/[0.04] hover:bg-green-500/[0.08] transition-colors">
                      <Upload className="w-6 h-6 text-green-400" />
                      <span className="text-sm font-bold text-white">{certUploaded ? 'Certificate uploaded ✓' : 'Upload certificate or ID proof'}</span>
                      <span className="text-[11px] text-zinc-600">PDF, PNG, JPG — max 5 MB per file</span>
                    </button>
                    <div className="flex items-start gap-2.5 p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                      <Info className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-zinc-500">Uploaded certs are reviewed within <b className="text-zinc-300">24–48 hours</b>. You can still join and coach while verification is pending — academies will see a &quot;pending&quot; badge.</p>
                    </div>
                  </div>
                </>
              )}

              {step === 4 && (
                <>
                  <div>
                    <h2 className="text-3xl font-black text-white mb-1">Your association</h2>
                    <p className="text-zinc-500 text-sm">Which cricket association are you affiliated with?</p>
                  </div>
                  <div className="space-y-3">
                    <Input value={associationQuery} onChange={e => setAssociationQuery(e.target.value)} placeholder="Search associations by name or state"
                      className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50" />
                    <div className="max-h-72 overflow-y-auto space-y-1.5">
                      {filteredAssociations.map(a => (
                        <button key={a.id} type="button" onClick={() => setAssociationId(a.id)}
                          className={cn('w-full flex items-center justify-between text-left px-4 py-3 rounded-xl border transition-colors',
                            associationId === a.id ? 'border-green-500/40 bg-green-500/[0.08]' : 'border-white/10 bg-white/[0.03] hover:border-white/20')}>
                          <span>
                            <span className="block text-sm font-bold text-white">{a.name}</span>
                            <span className="block text-[11px] text-zinc-500 capitalize">{a.type} · {a.state}</span>
                          </span>
                          {associationId === a.id && <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />}
                        </button>
                      ))}
                      {filteredAssociations.length === 0 && (
                        <p className="text-xs text-zinc-600 px-1 py-2">No associations found. Try a different search.</p>
                      )}
                    </div>
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

          {error && step !== 4 && step !== 1 && (
            <p className="mt-4 text-xs text-red-400">{error}</p>
          )}

          <div className="flex items-center justify-between mt-8 gap-4">
            {step > 1 ? (
              <button onClick={() => setStep(s => s - 1)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-zinc-400 hover:text-white text-sm font-medium transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            ) : <div />}
            <button
              onClick={handleNext}
              disabled={!canProceed() || loading}
              className={cn('flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all',
                canProceed() && !loading ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-white/[0.04] border border-white/[0.08] text-zinc-600 cursor-not-allowed')}
            >
              {loading ? (<><Loader2 className="w-4 h-4 animate-spin" /> Setting up…</>)
                : step === TOTAL_STEPS ? (<><CheckCircle2 className="w-4 h-4" /> Finish</>)
                : (<>Save & Continue <ArrowRight className="w-4 h-4" /></>)}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
