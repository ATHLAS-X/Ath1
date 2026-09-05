'use client'

import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { ArrowRight, ArrowLeft, Loader2, Zap, CheckCircle2, AlertCircle, Upload, Link2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { toast } from 'sonner'

/*
 * AthlasX Player Onboarding — 3-stage flow (rebuilt from the 4-step wizard
 * per design/import/AthlasX Onboarding.html, treated as canonical over the
 * other two same-purpose mockups per design/import/MAPPING.md).
 *
 * Stage 1 — Basic player details (identity + playing profile, same fields
 *   as the old steps 1-2, laid out on one page).
 * Stage 2 — Aadhaar verification (stubbed — see src/lib/aadhaar-verification.ts).
 *   A second, independent verification for the guardian if isUnder18(dob).
 * Stage 3 — Footage/bio/review plus all four consent panels, each gated on
 *   having actually scrolled that panel to its end.
 *
 * Still does NOT collect self-reported stats or fitness/behaviour ratings —
 * those come from ingested scorecard data / coach-supervised evaluations only.
 */

const TOTAL_STAGES = 3

const battingStyles = ['Right-handed', 'Left-handed']
const bowlingStyles = [
  'Right-arm Fast', 'Right-arm Medium', 'Right-arm Off-spin', 'Right-arm Leg-spin',
  'Left-arm Fast', 'Left-arm Medium', 'Left-arm Orthodox', 'Left-arm Unorthodox', 'None',
]
const playingRoles = ['Batsman', 'Bowler', 'All-rounder', 'Wicket-keeper Batsman']
const formats = ['T20', 'ODI', 'Test', 'T10']
const indianStates = [
  'Andhra Pradesh', 'Assam', 'Bihar', 'Delhi', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana',
  'Uttar Pradesh', 'West Bengal',
]

function isUnder18(dob: string): boolean {
  if (!dob) return false
  const age = (Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000)
  return age < 18
}

type AadhaarStatus = 'unverified' | 'sent' | 'verified'
interface AadhaarState {
  number: string
  otp: string
  requestId: string
  devCode: string
  last4: string
  status: AadhaarStatus
  sending: boolean
  verifying: boolean
  error: string
}
const EMPTY_AADHAAR: AadhaarState = {
  number: '', otp: '', requestId: '', devCode: '', last4: '', status: 'unverified',
  sending: false, verifying: false, error: '',
}

// Consent copy — the four confirmed with the user directly (not the
// mockup's scout-oriented set, which references a role that doesn't exist
// in this codebase's role model).
const CONSENTS = [
  {
    key: 'dataUse' as const,
    title: 'Data collection & use',
    minorOnly: false,
    body: `AthlasX collects the information you provide in this form — your name, date of birth, district, state, playing role, physical details, and any footage links or bio text you add — to build your player profile.

Your match performance data (runs, wickets, and other scorecard statistics) is never self-reported. It is added only when an association you're affiliated with ingests verified tournament or trial records, and only after that association approves it.

Your AthlasX Score is computed exclusively from this association-verified match data — never from anything you type into this form. We use your profile data to: generate your player record and score, make your profile discoverable to selection panels per your visibility setting, and generate pre-camp dossiers when you register for a trial cycle.

We do not sell your data to third parties. We do not share your contact details (email, phone) with any association, coach, or selector — only your playing profile and verified performance history are visible, per your visibility tier setting, which you can change at any time from Settings.

Your data is retained for as long as your account is active. You can request account deletion at any time; deletion removes your personal identifying information but a district or state association's own verified tournament records (which exist independently of your account) are not retroactively altered.`,
  },
  {
    key: 'dpdpGuardian' as const,
    title: 'Guardian consent (Digital Personal Data Protection Act, 2023)',
    minorOnly: true,
    body: `Under India's Digital Personal Data Protection Act, 2023, a child (anyone under 18) cannot independently consent to the processing of their personal data — a parent or lawful guardian must provide verifiable consent on the child's behalf before that data is processed.

Because the date of birth entered in Stage 1 indicates this player is under 18, this consent must be given by the player's parent or legal guardian, not the player themselves. By continuing, the person completing this step confirms they are the parent or legal guardian of the player named in this form, and that they consent to AthlasX collecting and processing the player's personal data as described in the Data collection & use consent above.

The guardian's own identity has been independently verified via Aadhaar OTP in Stage 2, separately from the player's own verification — this is required specifically so that guardian consent under the DPDP Act is given by a real, verified adult, not merely asserted by checking a box.

The guardian may withdraw this consent at any time by contacting AthlasX. Withdrawing consent for a minor player will restrict that player's profile from being processed or shown to any selection panel or association until the player turns 18 and can independently re-consent, or a new guardian consent is given.

This consent is specific to this player's account and does not extend to any other child or account.`,
  },
  {
    key: 'visibility' as const,
    title: 'Visibility & sharing with associations',
    minorOnly: false,
    body: `Your player profile defaults to "association only" visibility — meaning only staff of the district or state cricket association you're affiliated with (and AthlasX's own operations team) can see your profile and verified match history.

You can opt into broader visibility — making your profile visible to any association's staff across the platform, not just your own — at any time from Settings. This is entirely optional and off by default.

Regardless of your visibility setting, if you register for a trial cycle run by an association, that association's selection panel will always be able to see your registration, your dossier, and your verified match history for the purpose of running that trial — this is a necessary part of participating in a trial you've chosen to register for, and is not affected by your general visibility tier.

Coach advisory notes and season-tracking flags, when they exist, are visible to selection panels and coaches within your own association as part of the normal selection and development workflow — they are never scored into your AthlasX Score itself.

Franchise or league scout access does not exist on this platform today — no scout role or scout-facing visibility is currently available to opt into, regardless of what this or any other screen might otherwise suggest.`,
  },
  {
    key: 'terms' as const,
    title: 'Terms of service',
    minorOnly: false,
    body: `By creating an AthlasX account, you agree to use the platform only for its intended purpose: building and maintaining a verified cricket player record, and participating in association-run trials and selection processes.

You agree not to submit false information — including a false date of birth, false identity details, or fabricated match statistics. AthlasX reserves the right to suspend or remove any account found to contain deliberately false information, particularly information that would misrepresent a player's age or identity to a selection panel.

Match statistics displayed on your profile and used in your AthlasX Score come exclusively from association-verified ingested data — you cannot add or edit match statistics directly, and any attempt to do so through means other than the normal application interface (such as a direct API call) is a violation of these terms.

AthlasX is provided as-is, without warranty of any kind regarding selection outcomes, scouting opportunities, or career results. AthlasX is a decision-support tool for selection panels and associations — it does not make selection decisions itself, and inclusion or exclusion from any squad remains entirely the decision of the relevant selection committee.

You may delete your account at any time. These terms may be updated from time to time; continued use of the platform after an update constitutes acceptance of the revised terms.`,
  },
]

export default function OnboardingPage() {
  const [stage, setStage] = useState(1)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const [form, setForm] = useState({
    fullName: '', dob: '', district: '', state: '',
    email: '', password: '',
    guardianPhone: '',
    cricheroes_handle: '',
    playingRole: '', battingStyle: '', bowlingStyle: '',
    selectedFormats: [] as string[],
    academy: '', yearsExperience: '',
    batting_url: '', bowling_url: '', keeping_url: '',
    youtube_channel: '',
    bio: '',
  })

  const [aadhaar, setAadhaar] = useState<AadhaarState>(EMPTY_AADHAAR)
  const [guardianAadhaar, setGuardianAadhaar] = useState<AadhaarState>(EMPTY_AADHAAR)

  const [consents, setConsents] = useState<Record<string, boolean>>({
    dataUse: false, dpdpGuardian: false, visibility: false, terms: false,
  })
  const [scrolledEnd, setScrolledEnd] = useState<Record<string, boolean>>({
    dataUse: false, dpdpGuardian: false, visibility: false, terms: false,
  })

  function update(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function toggleFormat(f: string) {
    setForm(prev => ({
      ...prev,
      selectedFormats: prev.selectedFormats.includes(f)
        ? prev.selectedFormats.filter(x => x !== f)
        : [...prev.selectedFormats, f],
    }))
  }

  const minor = isUnder18(form.dob)

  async function sendAadhaarOtp(subject: 'player' | 'guardian') {
    const [state, setState] = subject === 'player' ? [aadhaar, setAadhaar] : [guardianAadhaar, setGuardianAadhaar]
    const digits = state.number.replace(/\D/g, '')
    if (digits.length !== 12) {
      setState(s => ({ ...s, error: 'Enter all 12 digits.' }))
      return
    }
    setState(s => ({ ...s, sending: true, error: '' }))
    try {
      const res = await fetch('/api/onboarding/aadhaar/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aadhaarNumber: digits }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not send OTP')
      // Never keep the full number after this — only last4 comes back.
      setState(s => ({
        ...s, number: '', sending: false, status: 'sent',
        requestId: data.requestId, devCode: data.devCode ?? '', last4: data.last4,
      }))
    } catch (err) {
      setState(s => ({ ...s, sending: false, error: err instanceof Error ? err.message : 'Could not send OTP' }))
    }
  }

  async function verifyAadhaarOtp(subject: 'player' | 'guardian') {
    const [state, setState] = subject === 'player' ? [aadhaar, setAadhaar] : [guardianAadhaar, setGuardianAadhaar]
    if (state.otp.replace(/\D/g, '').length !== 6) {
      setState(s => ({ ...s, error: 'Enter the 6-digit code.' }))
      return
    }
    setState(s => ({ ...s, verifying: true, error: '' }))
    try {
      const res = await fetch('/api/onboarding/aadhaar/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: state.requestId, code: state.otp }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Incorrect or expired code')
      setState(s => ({ ...s, verifying: false, status: 'verified' }))
    } catch (err) {
      setState(s => ({ ...s, verifying: false, error: err instanceof Error ? err.message : 'Incorrect or expired code' }))
    }
  }

  function canProceedStage1() {
    const base = form.fullName && form.dob && form.district && form.state && form.email && form.password && form.playingRole
    return Boolean(minor ? base && form.guardianPhone : base)
  }

  function canProceedStage2() {
    return aadhaar.status === 'verified' && (!minor || guardianAadhaar.status === 'verified')
  }

  function canSubmit() {
    return (
      consents.dataUse && consents.visibility && consents.terms &&
      (!minor || consents.dpdpGuardian) && !loading
    )
  }

  function handleNextFromStage(current: number) {
    if (current < TOTAL_STAGES) { setStage(s => s + 1); return }
    void handleSubmit()
  }

  async function handleSubmit() {
    setLoading(true)
    try {
      const res = await fetch('/api/player/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          aadhaarRequestId: aadhaar.requestId,
          guardianAadhaarRequestId: minor ? guardianAadhaar.requestId : undefined,
          consentDataUse: consents.dataUse,
          consentDpdpGuardian: consents.dpdpGuardian,
          consentVisibility: consents.visibility,
          consentTerms: consents.terms,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save profile')
      toast.success('Profile created. Your match record will populate as data is ingested.')
      router.push('/record')
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Failed to save profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const progress = (stage / TOTAL_STAGES) * 100
  const canProceed = stage === 1 ? canProceedStage1() : stage === 2 ? canProceedStage2() : canSubmit()

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
        <div className="flex items-center gap-3">
          <Link href="/claim" className="text-xs text-zinc-500 hover:text-green-400 transition-colors">Already have match data? Claim your profile</Link>
          <div className="text-xs text-zinc-500">Stage {stage} of {TOTAL_STAGES}</div>
        </div>
      </div>

      <div className="h-0.5 bg-white/[0.05]">
        <motion.div
          className="h-full bg-gradient-to-r from-green-600 to-emerald-400"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className={cn('w-full', stage === 3 ? 'max-w-2xl' : 'max-w-lg')}>
          <AnimatePresence mode="wait">
            <motion.div
              key={stage}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* ── Stage 1: Basic player details ── */}
              {stage === 1 && (
                <>
                  <div>
                    <h2 className="text-3xl font-black text-white mb-1">Basic details</h2>
                    <p className="text-zinc-500 text-sm">Who you are and how you play</p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-zinc-400 text-sm">Full name *</Label>
                      <Input value={form.fullName} onChange={e => update('fullName', e.target.value)} placeholder="Arjun Sharma"
                        className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-zinc-400 text-sm">Email *</Label>
                        <Input type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="arjun@example.com" autoComplete="email"
                          className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-zinc-400 text-sm">Password *</Label>
                        <Input type="password" value={form.password} onChange={e => update('password', e.target.value)} placeholder="Choose a password" autoComplete="new-password"
                          className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-zinc-400 text-sm">Date of birth *</Label>
                      <Input type="date" value={form.dob} onChange={e => update('dob', e.target.value)}
                        className="bg-white/[0.05] border-white/10 text-white h-10 rounded-xl focus:border-green-500/50 [color-scheme:dark]" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-zinc-400 text-sm">District *</Label>
                        <Input value={form.district} onChange={e => update('district', e.target.value)} placeholder="Kanpur"
                          className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-zinc-400 text-sm">State *</Label>
                        <select value={form.state} onChange={e => update('state', e.target.value)}
                          className="w-full h-10 px-3 rounded-xl bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-green-500/50">
                          <option value="" className="bg-zinc-900">Select state</option>
                          {indianStates.map(s => <option key={s} value={s} className="bg-zinc-900">{s}</option>)}
                        </select>
                      </div>
                    </div>

                    <AnimatePresence>
                      {minor && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                          <div className="space-y-1.5">
                            <Label className="text-zinc-400 text-sm">Guardian phone *</Label>
                            <Input type="tel" value={form.guardianPhone} onChange={e => update('guardianPhone', e.target.value)} placeholder="+91 98765 43210"
                              className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50" />
                            <div className="flex items-start gap-2 p-3 rounded-xl border border-amber-500/15 bg-amber-500/8">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                              <p className="text-[11px] text-amber-300/80">
                                Required for players under 18 (DPDP Act compliance). Your guardian will also complete a separate Aadhaar verification and consent in the next stages.
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="space-y-1.5">
                      <Label className="text-zinc-400 text-sm">CricHeroes handle</Label>
                      <Input value={form.cricheroes_handle} onChange={e => update('cricheroes_handle', e.target.value)} placeholder="@arjun_sharma"
                        className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50" />
                    </div>

                    <div className="pt-2 border-t border-white/[0.05] space-y-2">
                      <Label className="text-zinc-400 text-sm">Playing role *</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {playingRoles.map(role => (
                          <button key={role} type="button" onClick={() => update('playingRole', role)}
                            className={cn('px-3 py-2.5 rounded-xl text-sm font-medium border transition-all',
                              form.playingRole === role ? 'bg-green-500/15 border-green-500/40 text-green-400' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:bg-white/[0.06]')}>
                            {role}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-zinc-400 text-sm">Batting style</Label>
                      <div className="flex gap-2">
                        {battingStyles.map(s => (
                          <button key={s} type="button" onClick={() => update('battingStyle', s)}
                            className={cn('flex-1 py-2 rounded-xl text-sm font-medium border transition-all',
                              form.battingStyle === s ? 'bg-green-500/15 border-green-500/40 text-green-400' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:bg-white/[0.06]')}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-zinc-400 text-sm">Bowling style</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {bowlingStyles.map(s => (
                          <button key={s} type="button" onClick={() => update('bowlingStyle', s)}
                            className={cn('px-2 py-2 rounded-xl text-xs font-medium border transition-all text-left',
                              form.bowlingStyle === s ? 'bg-green-500/15 border-green-500/40 text-green-400' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:bg-white/[0.06]')}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-zinc-400 text-sm">Preferred formats</Label>
                      <div className="flex gap-2">
                        {formats.map(f => (
                          <button key={f} type="button" onClick={() => toggleFormat(f)}
                            className={cn('flex-1 py-2 rounded-xl text-sm font-medium border transition-all',
                              form.selectedFormats.includes(f) ? 'bg-green-500/15 border-green-500/40 text-green-400' : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:bg-white/[0.06]')}>
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-zinc-400 text-sm">Academy</Label>
                        <Input value={form.academy} onChange={e => update('academy', e.target.value)} placeholder="Tara Cricket Academy"
                          className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-zinc-400 text-sm">Years of cricket</Label>
                        <Input type="number" value={form.yearsExperience} onChange={e => update('yearsExperience', e.target.value)} placeholder="5" min="0" max="25"
                          className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50" />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ── Stage 2: Aadhaar verification ── */}
              {stage === 2 && (
                <>
                  <div>
                    <h2 className="text-3xl font-black text-white mb-1">Verify your identity</h2>
                    <p className="text-zinc-500 text-sm">
                      Aadhaar OTP verification. We never store your raw Aadhaar number — only the last 4 digits and your verified status.
                    </p>
                  </div>
                  <AadhaarBlock label="Your Aadhaar" subject="player" state={aadhaar} setState={setAadhaar}
                    onSend={() => sendAadhaarOtp('player')} onVerify={() => verifyAadhaarOtp('player')} />

                  {minor && (
                    <div className="pt-4 border-t border-white/[0.06]">
                      <p className="text-sm font-bold text-white mb-1">Parent / guardian verification</p>
                      <p className="text-xs text-zinc-500 mb-3">Required in addition to the guardian phone number already provided — this independently verifies your guardian&apos;s own identity.</p>
                      <AadhaarBlock label="Guardian's Aadhaar" subject="guardian" state={guardianAadhaar} setState={setGuardianAadhaar}
                        onSend={() => sendAadhaarOtp('guardian')} onVerify={() => verifyAadhaarOtp('guardian')} />
                    </div>
                  )}
                </>
              )}

              {/* ── Stage 3: Footage, bio, review, consent ── */}
              {stage === 3 && (
                <>
                  <div>
                    <h2 className="text-3xl font-black text-white mb-1">Footage, review & consent</h2>
                    <p className="text-zinc-500 text-sm">Last step — add footage, review your details, and accept the required consents.</p>
                  </div>

                  <div className="flex items-start gap-2.5 p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                    <Upload className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-zinc-300">Why add footage?</p>
                      <p className="text-xs text-zinc-600 mt-0.5">
                        Batting and bowling are scored from verified scorecard data. Fielding and wicket-keeping cannot be — footage lets selectors assess those directly.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {[
                      { key: 'batting_url', label: 'Batting clip URL', placeholder: 'YouTube / Google Drive link' },
                      { key: 'bowling_url', label: 'Bowling clip URL', placeholder: 'YouTube / Google Drive link' },
                      { key: 'keeping_url', label: 'Keeping clip URL', placeholder: 'Optional · YouTube / Google Drive link' },
                      { key: 'youtube_channel', label: 'YouTube channel', placeholder: 'youtube.com/@handle (optional)' },
                    ].map(f => (
                      <div key={f.key} className="space-y-1.5">
                        <Label className="text-zinc-400 text-sm">{f.label}</Label>
                        <div className="relative">
                          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
                          <Input value={(form as unknown as Record<string, string>)[f.key]} onChange={e => update(f.key, e.target.value)} placeholder={f.placeholder}
                            className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl pl-8 focus:border-green-500/50" />
                        </div>
                      </div>
                    ))}

                    <div className="space-y-1.5">
                      <Label className="text-zinc-400 text-sm">Bio</Label>
                      <textarea value={form.bio} onChange={e => update('bio', e.target.value)} placeholder="Your cricket journey, strengths, goals…" maxLength={400} rows={3}
                        className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-green-500/50 resize-none" />
                      <p className="text-[10px] text-zinc-700 text-right">{form.bio.length}/400</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-lg font-bold text-white">Review</h3>
                    {[
                      { label: 'Name', value: form.fullName || '—' },
                      { label: 'Email', value: form.email || '—' },
                      { label: 'DOB', value: form.dob || '—' },
                      { label: 'District', value: form.district || '—' },
                      { label: 'State', value: form.state || '—' },
                      { label: 'Role', value: form.playingRole || '—' },
                      { label: 'Batting', value: form.battingStyle || '—' },
                      { label: 'Aadhaar', value: aadhaar.last4 ? `Verified · ••••${aadhaar.last4}` : 'Not verified' },
                      ...(minor ? [{ label: 'Guardian Aadhaar', value: guardianAadhaar.last4 ? `Verified · ••••${guardianAadhaar.last4}` : 'Not verified' }] : []),
                      { label: 'Footage', value: [form.batting_url, form.bowling_url].filter(Boolean).length + ' clips added' },
                    ].map(row => (
                      <div key={row.label} className="flex justify-between text-sm py-2 border-b border-white/[0.05]">
                        <span className="text-zinc-500">{row.label}</span>
                        <span className="text-zinc-200 font-semibold truncate max-w-[220px] text-right">{row.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-lg font-bold text-white">Required consents</h3>
                    {CONSENTS.filter(c => !c.minorOnly || minor).map(c => (
                      <ConsentPanel
                        key={c.key}
                        title={c.title}
                        body={c.body}
                        accepted={consents[c.key]}
                        reachedEnd={scrolledEnd[c.key]}
                        onReachEnd={() => setScrolledEnd(s => ({ ...s, [c.key]: true }))}
                        onAccept={(v) => setConsents(s => ({ ...s, [c.key]: v }))}
                      />
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between mt-8 gap-4">
            {stage > 1 ? (
              <button onClick={() => setStage(s => s - 1)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-zinc-400 hover:text-white text-sm font-medium transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            ) : <div />}

            <button
              onClick={() => handleNextFromStage(stage)}
              disabled={!canProceed || loading}
              className={cn('flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all',
                canProceed && !loading ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-white/[0.04] border border-white/[0.08] text-zinc-600 cursor-not-allowed')}
            >
              {loading ? (<><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>)
                : stage === TOTAL_STAGES ? (<><CheckCircle2 className="w-4 h-4" /> Create Profile</>)
                : (<>Continue <ArrowRight className="w-4 h-4" /></>)}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AadhaarBlock({ label, state, setState, onSend, onVerify }: {
  label: string
  subject: 'player' | 'guardian'
  state: AadhaarState
  setState: React.Dispatch<React.SetStateAction<AadhaarState>>
  onSend: () => void
  onVerify: () => void
}) {
  if (state.status === 'verified') {
    return (
      <div className="flex items-center gap-2.5 p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
        <ShieldCheck className="w-4 h-4 shrink-0" />
        <span className="text-sm font-semibold">{label} verified — ••••{state.last4}</span>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {state.status === 'unverified' && (
        <div className="space-y-1.5">
          <Label className="text-zinc-400 text-sm">{label} number *</Label>
          <Input
            value={state.number}
            onChange={e => setState(s => ({ ...s, number: e.target.value.replace(/\D/g, '').slice(0, 12), error: '' }))}
            placeholder="XXXX XXXX XXXX" inputMode="numeric" maxLength={12}
            className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50"
          />
          <p className="text-[10px] text-zinc-700">12 digits. Only the last 4 are ever stored — the full number is never saved or sent again after this step.</p>
          <button type="button" onClick={onSend} disabled={state.sending}
            className="text-xs font-bold px-4 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-white hover:bg-white/[0.1] disabled:opacity-50">
            {state.sending ? 'Sending…' : 'Send OTP'}
          </button>
        </div>
      )}

      {state.status === 'sent' && (
        <div className="space-y-2">
          <div className="p-2.5 rounded-lg border border-amber-500/25 bg-amber-500/[0.08]">
            <p className="text-[11px] font-bold text-amber-400">Dev mode — no eKYC vendor connected</p>
            <p className="text-xs text-amber-300/90 mt-0.5">Your test code is <span className="font-mono font-bold">{state.devCode}</span> (last 4 of number: ••••{state.last4})</p>
          </div>
          <Label className="text-zinc-400 text-sm">Enter OTP</Label>
          <div className="flex gap-2">
            <Input value={state.otp} onChange={e => setState(s => ({ ...s, otp: e.target.value.replace(/\D/g, '').slice(0, 6), error: '' }))}
              placeholder="6-digit code" inputMode="numeric" maxLength={6}
              className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50" />
            <button type="button" onClick={onVerify} disabled={state.verifying}
              className="shrink-0 text-xs font-bold px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white disabled:opacity-50">
              {state.verifying ? 'Verifying…' : 'Verify'}
            </button>
          </div>
        </div>
      )}

      {state.error && <p className="text-xs text-red-400">{state.error}</p>}
    </div>
  )
}

function ConsentPanel({ title, body, accepted, reachedEnd, onReachEnd, onAccept }: {
  title: string
  body: string
  accepted: boolean
  reachedEnd: boolean
  onReachEnd: () => void
  onAccept: (v: boolean) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 4) onReachEnd()
  }

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <p className="text-sm font-bold text-white">{title}</p>
      </div>
      <div ref={scrollRef} onScroll={handleScroll} className="px-4 py-3 max-h-40 overflow-y-auto text-xs text-zinc-400 leading-relaxed whitespace-pre-line">
        {body}
      </div>
      <label className={cn('flex items-center gap-2.5 px-4 py-3 border-t border-white/[0.06] cursor-pointer', !reachedEnd && 'cursor-not-allowed opacity-60')}>
        <input type="checkbox" checked={accepted} disabled={!reachedEnd} onChange={e => onAccept(e.target.checked)} className="w-4 h-4 accent-green-500" />
        <span className="text-xs font-semibold text-zinc-300">
          {reachedEnd ? 'I have read and accept this consent' : 'Scroll to the end to accept'}
        </span>
      </label>
    </div>
  )
}
