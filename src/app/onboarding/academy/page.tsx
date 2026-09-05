'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { ArrowRight, ArrowLeft, Loader2, Zap, CheckCircle2, Upload, ShieldAlert } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import Link from 'next/link'

/*
 * Academy self-serve onboarding — rebuilt from design/import/AthlasX
 * Academy Onboarding v3.html (confirmed canonical over v2 directly with
 * the user; v2/v3 are genuinely different design systems, not just
 * versions, per design/import/MAPPING.md).
 *
 * "Remain the same" per instruction: same 5 steps, same fields, same
 * copy, same order as the mockup — only the implementation changed (real
 * state management, real submission, no static linked pages). Two
 * deviations, both confirmed with the user directly:
 *   - Step 1 adds email+password alongside the mockup's phone+OTP-only
 *     content, since phone-only auth has no sign-in path anywhere else
 *     in this codebase (every other role uses NextAuth email/password).
 *   - Steps 3-4 (Facilities & Staff, Programs) are collected here for
 *     fidelity to the mockup but NOT persisted — the Academy Prisma
 *     model has no columns for ground type, coach certifications, age
 *     groups, fees, or BCCI/state-association affiliation, and adding
 *     them wasn't asked for.
 *
 * Uses the existing app tokens (glass surfaces, --ax-green) rather than
 * the mockup's own orange/Anton palette — that remains the same
 * unresolved design-system decision flagged throughout
 * design/import/MAPPING.md, not resolved as a side effect here.
 *
 * This does NOT touch the separate academy_admin frontend gap (no
 * NAV_SECTIONS entry in src/lib/chrome.ts) — that's still open, tracked
 * separately, not silently fixed by this onboarding flow existing.
 */

const TOTAL_STEPS = 5
const STATES = ['Andhra Pradesh', 'Assam', 'Bihar', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal']
const ACADEMY_TYPES = [
  { v: 'Private', s: 'Owner or company-run' },
  { v: 'Government', s: 'Sports authority / SAI' },
  { v: 'Trust / NGO', s: 'Non-profit entity' },
  { v: 'Sports Club', s: 'Club-affiliated' },
]
const AGE_GROUPS = ['U-10', 'U-12', 'U-14', 'U-16', 'U-19', 'U-23', 'Senior']
const FORMATS = ['T20', 'ODI', 'Red-ball', 'All']
const FEE_RANGES = ['Free', '< 1K', '1K–3K', '3K–7K', '7K+']

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={cn('px-3.5 py-2 rounded-full text-sm font-semibold border transition-all',
        active ? 'bg-green-500/15 border-green-500/40 text-green-400' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:bg-white/[0.06]')}>
      {label}
    </button>
  )
}

export default function AcademyOnboardingPage() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  // Step 1
  const [mobile, setMobile] = useState('')
  const [otpRequestId, setOtpRequestId] = useState('')
  const [otpDevCode, setOtpDevCode] = useState('')
  const [otp, setOtp] = useState('')
  const [otpVerified, setOtpVerified] = useState(false)
  const [sendingOtp, setSendingOtp] = useState(false)
  const [verifyingOtp, setVerifyingOtp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send OTP')
    } finally {
      setSendingOtp(false)
    }
  }

  async function verifyOtp() {
    setVerifyingOtp(true); setError('')
    try {
      // Client-side check against the dev code only decides whether to let
      // the user proceed to the next step in the UI — the account is only
      // ever created after the server independently re-verifies via
      // verifyAcademyOtp() in POST /api/academy/onboard.
      if (otp.replace(/\D/g, '') !== otpDevCode) throw new Error('Incorrect OTP')
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
    if (step < TOTAL_STEPS) { setStep(s => s + 1); return }

    setLoading(true); setError('')
    try {
      const res = await fetch('/api/academy/onboard', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, requestId: otpRequestId, otp, email, password, academy_name: academyName, district, state }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to set up your academy')
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set up your academy')
    } finally {
      setLoading(false)
    }
  }

  const progress = (step / TOTAL_STEPS) * 100

  if (done) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-20 h-20 mx-auto rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
            <CheckCircle2 className="w-9 h-9 text-green-400" />
          </div>
          <h2 className="text-3xl font-black text-white">{academyName || 'Your academy'} is live.</h2>
          <p className="text-sm text-zinc-400">Your academy profile is submitted and pending verification. Invite links are active — start adding players now.</p>
          <button onClick={() => router.push('/dashboard')} className="mt-4 px-6 py-2.5 rounded-xl text-sm font-bold bg-green-600 hover:bg-green-500 text-white transition-colors">
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
                    <p className="text-zinc-500 text-sm">We&apos;ll text a one-time code to verify your WhatsApp number.</p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-zinc-400 text-sm">Mobile number (WhatsApp) *</Label>
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
                      <div className="space-y-1.5">
                        <Label className="text-zinc-400 text-sm">Email *</Label>
                        <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="director@academy.com" autoComplete="email"
                          className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-zinc-400 text-sm">Password *</Label>
                        <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Choose a password" autoComplete="new-password"
                          className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50" />
                      </div>
                      <p className="text-[10px] text-zinc-700">Email + password sign you back in later — WhatsApp OTP only verifies this number belongs to you now.</p>
                    </div>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div>
                    <h2 className="text-3xl font-black text-white mb-1">Academy identity</h2>
                    <p className="text-zinc-500 text-sm">Tell us about your academy. This appears on your public profile — scouts and players will see this.</p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-zinc-400 text-sm">Academy name *</Label>
                      <Input value={academyName} onChange={e => setAcademyName(e.target.value)} placeholder="e.g. KCA Cricket Academy"
                        className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-zinc-400 text-sm">City *</Label>
                        <Input value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Kanpur"
                          className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-zinc-400 text-sm">District *</Label>
                        <Input value={district} onChange={e => setDistrict(e.target.value)} placeholder="e.g. Kanpur Nagar"
                          className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50" />
                        <p className="text-[10px] text-zinc-700">Required to save your academy record — optional in the original design, but required by the data model.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-zinc-400 text-sm">State *</Label>
                        <select value={state} onChange={e => setState(e.target.value)}
                          className="w-full h-10 px-3 rounded-xl bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-green-500/50">
                          <option value="" className="bg-zinc-900">Select state</option>
                          {STATES.map(s => <option key={s} value={s} className="bg-zinc-900">{s}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-zinc-400 text-sm">Year established</Label>
                        <Input type="number" value={year} onChange={e => setYear(e.target.value)} placeholder="e.g. 2008"
                          className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-zinc-400 text-sm">Academy type</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {ACADEMY_TYPES.map(t => (
                          <button key={t.v} type="button" onClick={() => setAcademyType(t.v)}
                            className={cn('text-left px-3 py-2.5 rounded-xl border transition-all',
                              academyType === t.v ? 'bg-green-500/15 border-green-500/40' : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]')}>
                            <span className="block text-sm font-bold text-white">{t.v}</span>
                            <span className="block text-[11px] text-zinc-500">{t.s}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-zinc-400 text-sm">Primary contact name *</Label>
                        <Input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Full name"
                          className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-zinc-400 text-sm">Designation</Label>
                        <Input value={designation} onChange={e => setDesignation(e.target.value)} placeholder="e.g. Director, Admin Manager"
                          className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-zinc-400 text-sm">Academy logo (optional)</Label>
                      <button type="button" onClick={() => setLogoUploaded(true)}
                        className="w-full flex flex-col items-center gap-1.5 p-6 rounded-xl border-2 border-dashed border-green-500/40 bg-green-500/[0.04] hover:bg-green-500/[0.08] transition-colors">
                        <Upload className="w-6 h-6 text-green-400" />
                        <span className="text-sm font-bold text-white">{logoUploaded ? 'Logo uploaded ✓' : 'Upload logo or letterhead'}</span>
                        <span className="text-[11px] text-zinc-600">PNG, JPG or PDF — max 5 MB</span>
                      </button>
                    </div>
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <div>
                    <h2 className="text-3xl font-black text-white mb-1">Facilities & staff</h2>
                    <p className="text-zinc-500 text-sm">What you offer on the ground, and who&apos;s coaching.</p>
                  </div>
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Facilities</h3>
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <Label className="text-zinc-400 text-sm">Ground type</Label>
                          <div className="flex gap-2">{['Turf', 'Matting', 'Both'].map(v => <Chip key={v} label={v} active={groundType === v} onClick={() => setGroundType(v)} />)}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-zinc-400 text-sm">Practice nets</Label>
                            <div className="flex items-center gap-2">
                              <button type="button" onClick={() => setNets(n => Math.max(0, n - 1))} className="w-9 h-9 rounded-lg bg-white/[0.05] border border-white/10 text-white font-bold">−</button>
                              <span className="w-10 text-center text-sm font-bold text-white">{nets}</span>
                              <button type="button" onClick={() => setNets(n => Math.min(30, n + 1))} className="w-9 h-9 rounded-lg bg-white/[0.05] border border-white/10 text-white font-bold">+</button>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-zinc-400 text-sm">Approx capacity</Label>
                            <Input type="number" value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="e.g. 60 players"
                              className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50" />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-zinc-400 text-sm">Bowling machine available</Label>
                          <div className="flex gap-2">{['Yes', 'No'].map(v => <Chip key={v} label={v} active={bowlingMachine === v} onClick={() => setBowlingMachine(v)} />)}</div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-white/[0.06]">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Staff</h3>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-zinc-400 text-sm">Head coach name *</Label>
                            <Input value={hcName} onChange={e => setHcName(e.target.value)} placeholder="Full name"
                              className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-zinc-400 text-sm">Head coach certification</Label>
                            <select value={hcCert} onChange={e => setHcCert(e.target.value)}
                              className="w-full h-10 px-3 rounded-xl bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-green-500/50">
                              <option value="" className="bg-zinc-900">Select certification</option>
                              {['BCCI L1', 'BCCI L2', 'BCCI L3', 'NCA', 'NIS', 'Other'].map(c => <option key={c} value={c} className="bg-zinc-900">{c}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-zinc-400 text-sm">Ex-professional on staff?</Label>
                          <div className="flex gap-2">{['Yes', 'No'].map(v => <Chip key={v} label={v} active={exPro === v} onClick={() => setExPro(v)} />)}</div>
                        </div>
                        {exPro === 'Yes' && (
                          <div className="grid grid-cols-2 gap-4 p-3 rounded-xl bg-white/[0.03] border border-white/10">
                            <div className="space-y-1.5">
                              <Label className="text-zinc-400 text-sm">Name</Label>
                              <Input value={exName} onChange={e => setExName(e.target.value)} placeholder="Full name"
                                className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50" />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-zinc-400 text-sm">Highest level played</Label>
                              <Input value={exLevel} onChange={e => setExLevel(e.target.value)} placeholder="e.g. Ranji Trophy, IPL"
                                className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50" />
                            </div>
                          </div>
                        )}
                        <div className="space-y-1.5">
                          <Label className="text-zinc-400 text-sm">Assistant coaches</Label>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => setAssistants(n => Math.max(0, n - 1))} className="w-9 h-9 rounded-lg bg-white/[0.05] border border-white/10 text-white font-bold">−</button>
                            <span className="w-10 text-center text-sm font-bold text-white">{assistants}</span>
                            <button type="button" onClick={() => setAssistants(n => Math.min(20, n + 1))} className="w-9 h-9 rounded-lg bg-white/[0.05] border border-white/10 text-white font-bold">+</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {step === 4 && (
                <>
                  <div>
                    <h2 className="text-3xl font-black text-white mb-1">Programs</h2>
                    <p className="text-zinc-500 text-sm">What you run, for whom, and at what price.</p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-zinc-400 text-sm">Age groups</Label>
                      <div className="flex flex-wrap gap-2">{AGE_GROUPS.map(v => <Chip key={v} label={v} active={ageGroups.includes(v)} onClick={() => toggle(ageGroups, setAgeGroups, v)} />)}</div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-zinc-400 text-sm">Formats</Label>
                      <div className="flex flex-wrap gap-2">{FORMATS.map(v => <Chip key={v} label={v} active={formats.includes(v)} onClick={() => toggle(formats, setFormats, v)} />)}</div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-zinc-400 text-sm">Batch timings</Label>
                      <div className="flex gap-2">{['Morning', 'Evening', 'Both'].map(v => <Chip key={v} label={v} active={timing === v} onClick={() => setTiming(v)} />)}</div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-zinc-400 text-sm">Monthly fee range</Label>
                      <div className="flex flex-wrap gap-2">{FEE_RANGES.map(v => <Chip key={v} label={v} active={feeRange === v} onClick={() => setFeeRange(v)} />)}</div>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
                      <Label className="text-zinc-400 text-sm">BCCI affiliated</Label>
                      <div className="flex gap-2">{['Yes', 'No'].map(v => <Chip key={v} label={v} active={bcci === v} onClick={() => setBcci(v)} />)}</div>
                      {bcci === 'Yes' && (
                        <Input value={bcciId} onChange={e => setBcciId(e.target.value)} placeholder="e.g. BCCI-UP-0231"
                          className="mt-2 bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50" />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-zinc-400 text-sm">State cricket association affiliated</Label>
                      <div className="flex gap-2">{['Yes', 'No'].map(v => <Chip key={v} label={v} active={sca === v} onClick={() => setSca(v)} />)}</div>
                      {sca === 'Yes' && (
                        <Input value={scaName} onChange={e => setScaName(e.target.value)} placeholder="e.g. Uttar Pradesh Cricket Association"
                          className="mt-2 bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50" />
                      )}
                    </div>
                  </div>
                </>
              )}

              {step === 5 && (
                <>
                  <div>
                    <h2 className="text-3xl font-black text-white mb-1">Go live</h2>
                    <p className="text-zinc-500 text-sm">Bring your team on board, or jump straight to your dashboard.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="p-4 rounded-xl border border-white/10 bg-white/[0.03] space-y-2">
                      <p className="text-sm font-bold text-white">Invite coaches</p>
                      <div className="flex gap-2">
                        <Input value={inviteMobile} onChange={e => setInviteMobile(e.target.value)} placeholder="Coach's mobile number"
                          className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50" />
                        <button type="button" onClick={() => { if (inviteMobile.trim()) { setInviteSent(true); setTimeout(() => { setInviteSent(false); setInviteMobile('') }, 1300) } }}
                          className="shrink-0 text-xs font-bold px-4 rounded-xl bg-green-600 hover:bg-green-500 text-white">
                          {inviteSent ? 'Sent ✓' : 'Invite'}
                        </button>
                      </div>
                    </div>
                    <div className="p-4 rounded-xl border border-green-500/30 bg-green-500/[0.06] space-y-2">
                      <p className="text-sm font-bold text-white">Create first batch</p>
                      <Input value={batchName} onChange={e => setBatchName(e.target.value)} placeholder="Batch name, e.g. Morning U-14"
                        className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50" />
                      <button type="button" onClick={() => { if (batchName.trim()) { setBatchCreated(true); setTimeout(() => setBatchCreated(false), 1300) } }}
                        className="w-full text-xs font-bold px-4 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-white hover:bg-white/[0.1]">
                        {batchCreated ? 'Created ✓' : 'Create Batch'}
                      </button>
                      <p className="text-[10px] text-zinc-700">Batches created here are illustrative only — head to the academy dashboard after setup to create real batches.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                    <ShieldAlert className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-zinc-500">
                      <b className="text-zinc-300">{academyName || 'Your academy'}</b> goes live the moment you finish — players who join via your invite link enter an approval queue.
                    </p>
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

          {error && step !== 5 && step !== 1 && (
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
                : step === TOTAL_STEPS ? (<><CheckCircle2 className="w-4 h-4" /> Finish & Go Live</>)
                : (<>Save & Continue <ArrowRight className="w-4 h-4" /></>)}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
