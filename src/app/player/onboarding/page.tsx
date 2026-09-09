'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { ArrowRight, ArrowLeft, Loader2, CheckCircle2, AlertCircle, Upload, Link2, ShieldCheck } from 'lucide-react'
import { Anton, Barlow, Barlow_Semi_Condensed } from 'next/font/google'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StepRail } from '@/components/ui/step-rail'
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
 *
 * Presentation restyle to design/import/AthlasX Onboarding.html's
 * orange/Anton-Barlow palette, scoped exactly like commit 0d19f74 (/  and
 * /auth): fonts + tokens are local to this file (inline CSS vars on the
 * wrapper), nothing added to globals.css or tailwind.config.ts. Layout is
 * adapted from the mockup's two-column rail+form shell, but the rail lists
 * this flow's actual 3 stages, not the mockup's 9-step player spec.
 *
 * "Leave and resume anytime" (rail copy, taken literally): accumulated
 * form/Aadhaar/consent state is persisted to localStorage on every
 * successful stage advance and restored on mount, jumping straight to the
 * furthest-completed stage. This is single-browser, single-device resume
 * only — there is no backend draft model. A real cross-device draft would
 * need a new PlayerOnboardingDraft-style table and a schema migration,
 * which is out of scope for a presentation-layer prompt; localStorage was
 * the only mechanism authorized here.
 */

const anton = Anton({ subsets: ['latin'], weight: '400', variable: '--font-anton' })
const barlow = Barlow({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-barlow' })
const barlowSemi = Barlow_Semi_Condensed({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-barlow-semi' })

// Tokens lifted from design/import/AthlasX Onboarding.html's :root.
const ONBOARDING_VARS = {
  '--bg': '#0D0D0D',
  '--bg-soft': '#141312',
  '--accent': '#FF8A1E',
  '--accent-bright': '#FFA64D',
  '--accent-rgb': '255, 138, 30',
  '--ov08': 'rgba(255, 138, 30, 0.08)',
  '--ov14': 'rgba(255, 138, 30, 0.14)',
  '--ov22': 'rgba(255, 138, 30, 0.22)',
  '--ok': '#38d39f',
  '--bad': '#ff5a4d',
  '--card-bg': 'rgba(13, 13, 13, 0.55)',
  '--card-border': 'rgba(245, 245, 240, 0.14)',
  '--field-bg': 'rgba(245, 245, 240, 0.06)',
  '--ease': 'cubic-bezier(0.22, 1, 0.36, 1)',
} as React.CSSProperties

const TOTAL_STAGES = 3
const STORAGE_KEY = 'athlasx.onboarding.player.v1'

const STAGE_META = [
  { n: 1, label: 'Basic Info', sub: 'Identity & playing profile' },
  { n: 2, label: 'Aadhaar Verification', sub: 'OTP, + guardian if minor' },
  { n: 3, label: 'Footage, Bio & Consent', sub: 'Review & submit' },
]

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

const EMPTY_FORM = {
  fullName: '', dob: '', district: '', state: '',
  email: '', password: '',
  // docs/AthlasX_Master_Data_Points.docx — Player Phase 1 (HIGH).
  gender: '', city: '', guardianName: '', enrollmentDate: '',
  highestLevelRepresented: '', batchId: '', batchLabel: '',
  guardianPhone: '',
  cricheroes_handle: '',
  playingRole: '', battingStyle: '', bowlingStyle: '',
  selectedFormats: [] as string[],
  // yearsExperience removed — superseded by Phase 2's playing_since_year,
  // not replaced here; see docs/AthlasX_Master_Data_Points_Integration_Plan.md.
  academy: '',
  batting_url: '', bowling_url: '', keeping_url: '',
  youtube_channel: '',
  bio: '',
}

const COMPETITIVE_LEVELS = [
  { v: 'club_only', label: 'Academy/Club only' },
  { v: 'school_team', label: 'School team' },
  { v: 'zonal', label: 'Zonal' },
  { v: 'district_team', label: 'District team' },
  { v: 'state_trial', label: 'State trial' },
  { v: 'state_team', label: 'State team' },
  { v: 'ipl_trial', label: 'IPL trial' },
  { v: 'national', label: 'National' },
]

const EMPTY_CONSENTS = { dataUse: false, dpdpGuardian: false, visibility: false, terms: false }
const EMPTY_SCROLLED = { dataUse: false, dpdpGuardian: false, visibility: false, terms: false }

interface PersistedState {
  stage: number
  form: typeof EMPTY_FORM
  aadhaar: AadhaarState
  guardianAadhaar: AadhaarState
  consents: Record<string, boolean>
  scrolledEnd: Record<string, boolean>
}

function saveProgress(snapshot: PersistedState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // localStorage can throw (private browsing, quota, disabled) — resume
    // is a convenience, never a requirement to keep filling the form.
  }
}

function loadProgress(): PersistedState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || typeof parsed.stage !== 'number') return null
    return parsed as PersistedState
  } catch {
    return null
  }
}

function clearProgress() {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // nothing to do — worst case a stale draft lingers until overwritten
  }
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

// Shared field styling — orange-token equivalent of the old green inputs.
const FIELD_CLS = 'bg-[color:var(--field-bg)] border-[color:var(--card-border)] text-white placeholder:text-white/40 h-10 rounded-[9px] focus:border-[color:var(--accent)] focus:bg-white/[0.09]'
const LABEL_CLS = 'font-[family-name:var(--font-barlow-semi)] text-[11px] font-bold uppercase tracking-[0.1em] text-white/70'
const OPTCARD_CLS = (active: boolean) => cn(
  'transition-all border-[1.5px] rounded-[11px]',
  active
    ? 'bg-[rgba(255,138,30,0.14)] border-[color:var(--accent)] text-[color:var(--accent-bright)]'
    : 'bg-[color:var(--field-bg)] border-[color:var(--card-border)] text-white/70 hover:border-white/30',
)

export default function OnboardingPage() {
  const [stage, setStage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [resumed, setResumed] = useState(false)
  // Mirrors the 'stage-advance' lock below for one purpose only: blocking
  // pointer events on the stage panel while a transition is in flight, so
  // the outgoing AnimatePresence panel can't be clicked a second time
  // during its exit animation (a ref alone can guard re-entry into JS
  // handlers, but can't disable the DOM's hit-testing — that needs a
  // style applied via a render, hence this being state, not a ref).
  const [transitioning, setTransitioning] = useState(false)
  const router = useRouter()

  // Re-entry locks for async/navigation actions — a Set checked and
  // mutated synchronously, not React state. Two click events dispatched
  // in the same tick (e.g. a rapid double-click, or the outgoing
  // AnimatePresence panel staying briefly clickable during its exit
  // animation) both read the SAME pre-render `sending`/`verifying`/
  // `loading` state value, since neither click's state update has
  // committed yet when the second one runs — so a state-only guard can't
  // stop the second invocation. A ref-backed Set closes that race: the
  // first call's synchronous `.add()` is visible to the second call
  // immediately, with no render in between.
  const locksRef = useRef<Set<string>>(new Set())
  function withLock(key: string, fn: () => void | Promise<void>) {
    if (locksRef.current.has(key)) return
    locksRef.current.add(key)
    const release = () => locksRef.current.delete(key)
    const result = fn()
    if (result instanceof Promise) result.finally(release)
    else release()
  }

  const [form, setForm] = useState(EMPTY_FORM)
  // Dual-mode Batch field (docs/AthlasX_Master_Data_Points.docx Phase 1) —
  // populated by a best-effort academy-name lookup on blur; empty means
  // "no matching academy with batches," which falls back to free-text
  // batchLabel rather than blocking on a real academy selection that
  // doesn't exist anywhere in this wizard today.
  const [academyBatches, setAcademyBatches] = useState<{ id: string; batch_name: string }[]>([])
  const [academyLookupDone, setAcademyLookupDone] = useState(false)
  const [aadhaar, setAadhaar] = useState<AadhaarState>(EMPTY_AADHAAR)
  const [guardianAadhaar, setGuardianAadhaar] = useState<AadhaarState>(EMPTY_AADHAAR)
  const [consents, setConsents] = useState<Record<string, boolean>>(EMPTY_CONSENTS)
  const [scrolledEnd, setScrolledEnd] = useState<Record<string, boolean>>(EMPTY_SCROLLED)

  // Restore on mount — client-only (localStorage isn't available during
  // SSR), so this deliberately runs after first paint rather than as a
  // useState initializer, to avoid a hydration mismatch.
  useEffect(() => {
    const saved = loadProgress()
    if (!saved) return
    setForm(f => ({ ...f, ...saved.form }))
    setAadhaar(a => ({ ...a, ...saved.aadhaar }))
    setGuardianAadhaar(a => ({ ...a, ...saved.guardianAadhaar }))
    setConsents(c => ({ ...c, ...saved.consents }))
    setScrolledEnd(s => ({ ...s, ...saved.scrolledEnd }))
    setStage(Math.min(Math.max(saved.stage, 1), TOTAL_STAGES))
    setResumed(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!resumed) return
    toast.info('Welcome back — picked up where you left off.')
  }, [resumed])

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
    const lockKey = `${subject}-send-otp`
    if (locksRef.current.has(lockKey)) return
    locksRef.current.add(lockKey)
    try {
      await sendAadhaarOtpImpl(subject)
    } finally {
      locksRef.current.delete(lockKey)
    }
  }

  async function sendAadhaarOtpImpl(subject: 'player' | 'guardian') {
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
    const lockKey = `${subject}-verify-otp`
    if (locksRef.current.has(lockKey)) return
    locksRef.current.add(lockKey)
    try {
      await verifyAadhaarOtpImpl(subject)
    } finally {
      locksRef.current.delete(lockKey)
    }
  }

  async function verifyAadhaarOtpImpl(subject: 'player' | 'guardian') {
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

  async function lookupAcademyBatches(academyName: string) {
    setAcademyLookupDone(false)
    if (!academyName.trim()) { setAcademyBatches([]); setAcademyLookupDone(true); return }
    try {
      const res = await fetch(`/api/academy/lookup?name=${encodeURIComponent(academyName.trim())}`)
      const data = await res.json()
      setAcademyBatches(data.found ? data.batches : [])
    } catch {
      setAcademyBatches([])
    } finally {
      setAcademyLookupDone(true)
    }
  }

  function canProceedStage1() {
    const base = form.fullName && form.dob && form.district && form.state && form.email && form.password && form.playingRole
      && form.gender && form.city && form.enrollmentDate && form.highestLevelRepresented
    // Guardian name joins guardian phone as mandatory the moment DOB
    // confirms a minor — same gating pattern, now covering both fields.
    return Boolean(minor ? base && form.guardianPhone && form.guardianName : base)
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
    const lockKey = 'stage-advance'
    if (locksRef.current.has(lockKey)) return
    locksRef.current.add(lockKey)
    if (current < TOTAL_STAGES) {
      const next = current + 1
      setStage(next)
      setTransitioning(true)
      saveProgress({ stage: next, form, aadhaar, guardianAadhaar, consents, scrolledEnd })
      // Held for the AnimatePresence exit/enter transition duration
      // (0.3s, matching this file's `transition={{ duration: 0.3 }}`)
      // rather than released immediately — a second click landing on the
      // outgoing panel mid-animation must not re-trigger this too.
      setTimeout(() => { locksRef.current.delete(lockKey); setTransitioning(false) }, 350)
      return
    }
    void handleSubmit().finally(() => locksRef.current.delete(lockKey))
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
      clearProgress()
      toast.success('Profile created. Your match record will populate as data is ingested.')
      router.push('/record')
    } catch (err) {
      console.error(err)
      const message = err instanceof Error ? err.message : 'Failed to save profile. Please try again.'
      // The server re-checks Aadhaar verification at submit time rather than
      // trusting client state (consumeVerifiedAadhaar is single-use and
      // TTL-bound) — if that recheck fails after the client already showed
      // "verified", stranding the user behind a generic toast would force a
      // full wizard restart. Instead, drop back to Stage 2 with a fresh
      // Send-OTP prompt for whichever party's verification didn't hold,
      // keeping every other field the user already filled in.
      const recoveryMessage = "We couldn't confirm your verification — please verify again to finish."
      if (/aadhaar verification is required/i.test(message)) {
        if (/guardian aadhaar/i.test(message)) {
          setGuardianAadhaar(a => ({ ...a, status: 'unverified', otp: '', requestId: '', devCode: '', error: recoveryMessage }))
        } else {
          setAadhaar(a => ({ ...a, status: 'unverified', otp: '', requestId: '', devCode: '', error: recoveryMessage }))
        }
        setStage(2)
        toast.error(recoveryMessage)
        return
      }
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const progress = (stage / TOTAL_STAGES) * 100
  const canProceed = stage === 1 ? canProceedStage1() : stage === 2 ? canProceedStage2() : canSubmit()

  return (
    <div className={cn(anton.variable, barlow.variable, barlowSemi.variable)} style={ONBOARDING_VARS}>
      <div className="h-screen grid lg:grid-cols-[1fr_2fr] bg-[color:var(--bg)] font-[family-name:var(--font-barlow)] text-white">
        {/* ── LEFT RAIL ── */}
        <aside className="relative overflow-hidden hidden lg:flex flex-col p-8 lg:p-[2.618rem] bg-[color:var(--bg-soft)]">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(120% 80% at 0% 0%, var(--ov14), transparent 55%), radial-gradient(110% 70% at 0% 100%, var(--ov08), transparent 55%), linear-gradient(180deg, rgba(16,26,20,0.5) 0%, rgba(26,14,10,0.55) 100%)',
            }}
          />
          <div className="relative z-10 flex flex-col flex-1">
            <Link href="/" className="font-[family-name:var(--font-barlow-semi)] uppercase tracking-[0.22em] font-bold text-[0.95rem] text-white">
              ATHLAS<span className="text-[color:var(--accent)]">X</span>
            </Link>

            <div className="mt-6">
              <p className="font-[family-name:var(--font-barlow-semi)] uppercase tracking-[0.2em] text-[11px] font-bold text-[color:var(--accent-bright)] mb-1.5">Player Onboarding</p>
              <h1 className="font-[family-name:var(--font-anton)] uppercase font-normal leading-[0.92] text-[42px] text-white">
                Build your <b className="text-[color:var(--accent)] font-normal">athlete</b> profile.
              </h1>
              <p className="mt-3.5 text-sm leading-relaxed text-white/60 max-w-[22rem]">Three steps, each auto-saved the moment you continue. Leave and resume anytime.</p>
            </div>

            <StepRail steps={STAGE_META.map(s => ({ key: String(s.n), label: s.label, sublabel: s.sub }))} currentIndex={stage - 1} className="mt-8" />
          </div>
        </aside>

        {/* ── RIGHT: FORM ── */}
        <div className="relative flex flex-col min-w-0 min-h-0">
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(110% 50% at 100% 0%, var(--ov08), transparent 55%)' }} />

          <div className="relative z-20 flex items-center justify-between px-6 lg:px-10 py-4 border-b border-[color:var(--card-border)]">
            <Link href="/" className="lg:hidden font-[family-name:var(--font-barlow-semi)] text-sm font-bold uppercase tracking-[0.1em] text-white">
              Athlas<span className="text-[color:var(--accent)]">X</span>
            </Link>
            <Link href="/claim" className="text-xs text-white/50 hover:text-[color:var(--accent-bright)] transition-colors">Already have match data? Claim your profile</Link>
            <div className="font-[family-name:var(--font-barlow-semi)] text-xs uppercase tracking-wide text-white/50">Stage {stage} of {TOTAL_STAGES}</div>
          </div>

          <div className="relative z-20 h-[3px] bg-[color:var(--card-border)]">
            <motion.div
              className="h-full"
              style={{ background: 'linear-gradient(90deg, var(--accent), var(--accent-bright))' }}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>

          <div className="relative z-10 flex-1 flex items-start justify-center p-6 lg:p-10 overflow-y-auto">
            <div className={cn('w-full', stage === 3 ? 'max-w-2xl' : 'max-w-lg')}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={stage}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  style={{ pointerEvents: transitioning ? 'none' : 'auto' }}
                  className="space-y-6"
                >
                  {/* ── Stage 1: Basic player details ── */}
                  {stage === 1 && (
                    <>
                      <div>
                        <h2 className="font-[family-name:var(--font-anton)] uppercase font-normal text-3xl text-white mb-1">Basic details</h2>
                        <p className="text-white/50 text-sm">Who you are and how you play</p>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <Label className={LABEL_CLS}>Full name *</Label>
                          <Input value={form.fullName} onChange={e => update('fullName', e.target.value)} placeholder="Arjun Sharma"
                            className={FIELD_CLS} />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className={LABEL_CLS}>Email *</Label>
                            <Input type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="arjun@example.com" autoComplete="email"
                              className={FIELD_CLS} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className={LABEL_CLS}>Password *</Label>
                            <Input type="password" value={form.password} onChange={e => update('password', e.target.value)} placeholder="Choose a password" autoComplete="new-password"
                              className={FIELD_CLS} />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className={LABEL_CLS}>Date of birth *</Label>
                            <Input type="date" value={form.dob} onChange={e => update('dob', e.target.value)}
                              className={cn(FIELD_CLS, '[color-scheme:dark]')} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className={LABEL_CLS}>Gender *</Label>
                            <select value={form.gender} onChange={e => update('gender', e.target.value)}
                              className={cn('w-full px-3', FIELD_CLS, 'bg-[color:var(--field-bg)]')}>
                              {/* No pre-selected option — never default to Male, per docs/AthlasX_Master_Data_Points.docx. */}
                              <option value="" className="bg-[#141312]">Select gender</option>
                              <option value="male" className="bg-[#141312]">Male</option>
                              <option value="female" className="bg-[#141312]">Female</option>
                              <option value="other" className="bg-[#141312]">Other / Prefer not to say</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className={LABEL_CLS}>City *</Label>
                            <Input value={form.city} onChange={e => update('city', e.target.value)} placeholder="Kanpur"
                              className={FIELD_CLS} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className={LABEL_CLS}>District *</Label>
                            <Input value={form.district} onChange={e => update('district', e.target.value)} placeholder="Kanpur Nagar"
                              className={FIELD_CLS} />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label className={LABEL_CLS}>State *</Label>
                          <select value={form.state} onChange={e => update('state', e.target.value)}
                            className={cn('w-full px-3', FIELD_CLS, 'bg-[color:var(--field-bg)]')}>
                            <option value="" className="bg-[#141312]">Select state</option>
                            {indianStates.map(s => <option key={s} value={s} className="bg-[#141312]">{s}</option>)}
                          </select>
                        </div>

                        <AnimatePresence>
                          {minor && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                              <div className="space-y-3">
                                <div className="space-y-1.5">
                                  <Label className={LABEL_CLS}>Guardian name *</Label>
                                  <Input value={form.guardianName} onChange={e => update('guardianName', e.target.value)} placeholder="Full name"
                                    className={FIELD_CLS} />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className={LABEL_CLS}>Guardian phone *</Label>
                                  <Input type="tel" value={form.guardianPhone} onChange={e => update('guardianPhone', e.target.value)} placeholder="+91 98765 43210"
                                    className={FIELD_CLS} />
                                </div>
                                <div className="flex items-start gap-2 p-3 rounded-[10px] border-[color:var(--card-border)] border bg-[rgba(255,138,30,0.08)]">
                                  <AlertCircle className="w-3.5 h-3.5 text-[color:var(--accent-bright)] mt-0.5 shrink-0" />
                                  <p className="text-[11px] text-white/70">
                                    Required for players under 18 (DPDP Act compliance). Your guardian will also complete a separate Aadhaar verification and consent in the next stages.
                                  </p>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div className="space-y-1.5">
                          <Label className={LABEL_CLS}>Enrollment date at academy *</Label>
                          <Input type="date" value={form.enrollmentDate} onChange={e => update('enrollmentDate', e.target.value)}
                            className={cn(FIELD_CLS, '[color-scheme:dark]')} />
                        </div>

                        <div className="space-y-1.5">
                          <Label className={LABEL_CLS}>Highest level represented *</Label>
                          <select value={form.highestLevelRepresented} onChange={e => update('highestLevelRepresented', e.target.value)}
                            className={cn('w-full px-3', FIELD_CLS, 'bg-[color:var(--field-bg)]')}>
                            <option value="" className="bg-[#141312]">Select level</option>
                            {COMPETITIVE_LEVELS.map(l => <option key={l.v} value={l.v} className="bg-[#141312]">{l.label}</option>)}
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className={LABEL_CLS}>CricHeroes handle</Label>
                          <Input value={form.cricheroes_handle} onChange={e => update('cricheroes_handle', e.target.value)} placeholder="@arjun_sharma"
                            className={FIELD_CLS} />
                        </div>

                        <div className="pt-2 border-t border-[color:var(--card-border)] space-y-2">
                          <Label className={LABEL_CLS}>Playing role *</Label>
                          <div className="grid grid-cols-2 gap-2">
                            {playingRoles.map(role => (
                              <button key={role} type="button" onClick={() => update('playingRole', role)}
                                className={cn('px-3 py-2.5 text-sm font-medium', OPTCARD_CLS(form.playingRole === role))}>
                                {role}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className={LABEL_CLS}>Batting style</Label>
                          <div className="flex gap-2">
                            {battingStyles.map(s => (
                              <button key={s} type="button" onClick={() => update('battingStyle', s)}
                                className={cn('flex-1 py-2 text-sm font-medium', OPTCARD_CLS(form.battingStyle === s))}>
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className={LABEL_CLS}>Bowling style</Label>
                          <div className="grid grid-cols-2 gap-2">
                            {bowlingStyles.map(s => (
                              <button key={s} type="button" onClick={() => update('bowlingStyle', s)}
                                className={cn('px-2 py-2 text-xs font-medium text-left', OPTCARD_CLS(form.bowlingStyle === s))}>
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className={LABEL_CLS}>Preferred formats</Label>
                          <div className="flex gap-2">
                            {formats.map(f => (
                              <button key={f} type="button" onClick={() => toggleFormat(f)}
                                className={cn('flex-1 py-2 text-sm font-medium', OPTCARD_CLS(form.selectedFormats.includes(f)))}>
                                {f}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label className={LABEL_CLS}>Academy</Label>
                          <Input value={form.academy} onChange={e => update('academy', e.target.value)}
                            onBlur={e => lookupAcademyBatches(e.target.value)} placeholder="Tara Cricket Academy"
                            className={FIELD_CLS} />
                        </div>

                        {academyLookupDone && (
                          <div className="space-y-1.5">
                            <Label className={LABEL_CLS}>Batch / Group</Label>
                            {academyBatches.length > 0 ? (
                              <select value={form.batchId} onChange={e => update('batchId', e.target.value)}
                                className={cn('w-full px-3', FIELD_CLS, 'bg-[color:var(--field-bg)]')}>
                                <option value="" className="bg-[#141312]">Select batch</option>
                                {academyBatches.map(b => <option key={b.id} value={b.id} className="bg-[#141312]">{b.batch_name}</option>)}
                              </select>
                            ) : (
                              <Input value={form.batchLabel} onChange={e => update('batchLabel', e.target.value)} placeholder="e.g. Morning U-14 Batch"
                                className={FIELD_CLS} />
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* ── Stage 2: Aadhaar verification ── */}
                  {stage === 2 && (
                    <>
                      <div>
                        <h2 className="font-[family-name:var(--font-anton)] uppercase font-normal text-3xl text-white mb-1">Verify your identity</h2>
                        <p className="text-white/50 text-sm">
                          Aadhaar OTP verification. We never store your raw Aadhaar number — only the last 4 digits and your verified status.
                        </p>
                      </div>
                      <AadhaarBlock label="Your Aadhaar" subject="player" state={aadhaar} setState={setAadhaar}
                        onSend={() => sendAadhaarOtp('player')} onVerify={() => verifyAadhaarOtp('player')} />

                      {minor && (
                        <div className="pt-4 border-t border-[color:var(--card-border)]">
                          <p className="text-sm font-bold text-white mb-1">Parent / guardian verification</p>
                          <p className="text-xs text-white/50 mb-3">Required in addition to the guardian phone number already provided — this independently verifies your guardian&apos;s own identity.</p>
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
                        <h2 className="font-[family-name:var(--font-anton)] uppercase font-normal text-3xl text-white mb-1">Footage, review & consent</h2>
                        <p className="text-white/50 text-sm">Last step — add footage, review your details, and accept the required consents.</p>
                      </div>

                      <div className="flex items-start gap-2.5 p-4 rounded-[14px] border border-[color:var(--card-border)] bg-white/[0.02]">
                        <Upload className="w-4 h-4 text-white/50 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-white/80">Why add footage?</p>
                          <p className="text-xs text-white/50 mt-0.5">
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
                            <Label className={LABEL_CLS}>{f.label}</Label>
                            <div className="relative">
                              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
                              <Input value={(form as unknown as Record<string, string>)[f.key]} onChange={e => update(f.key, e.target.value)} placeholder={f.placeholder}
                                className={cn(FIELD_CLS, 'pl-8')} />
                            </div>
                          </div>
                        ))}

                        <div className="space-y-1.5">
                          <Label className={LABEL_CLS}>Bio</Label>
                          <textarea value={form.bio} onChange={e => update('bio', e.target.value)} placeholder="Your cricket journey, strengths, goals…" maxLength={400} rows={3}
                            className="w-full bg-[color:var(--field-bg)] border border-[color:var(--card-border)] rounded-[9px] px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-[color:var(--accent)] resize-none" />
                          <p className="text-[10px] text-white/40 text-right">{form.bio.length}/400</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h3 className="font-[family-name:var(--font-barlow-semi)] text-base font-bold uppercase tracking-wide text-white">Review</h3>
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
                          <div key={row.label} className="flex justify-between text-sm py-2 border-b border-[color:var(--card-border)]">
                            <span className="text-white/50">{row.label}</span>
                            <span className="text-white font-semibold truncate max-w-[220px] text-right">{row.value}</span>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-3">
                        <h3 className="font-[family-name:var(--font-barlow-semi)] text-base font-bold uppercase tracking-wide text-white">Required consents</h3>
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
                  <button onClick={() => {
                    if (locksRef.current.has('stage-advance')) return
                    locksRef.current.add('stage-advance')
                    setStage(s => s - 1)
                    setTransitioning(true)
                    setTimeout(() => { locksRef.current.delete('stage-advance'); setTransitioning(false) }, 350)
                  }}
                    disabled={transitioning}
                    className="font-[family-name:var(--font-barlow-semi)] flex items-center gap-2 px-4 py-2.5 rounded-[9px] bg-transparent border-[1.5px] border-[color:var(--card-border)] text-white/70 hover:text-white hover:border-white/40 text-sm font-bold uppercase tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                ) : <div />}

                <button
                  onClick={() => handleNextFromStage(stage)}
                  disabled={!canProceed || loading || transitioning}
                  className={cn(
                    'font-[family-name:var(--font-barlow-semi)] flex items-center gap-2 px-6 py-2.5 rounded-[9px] text-sm font-bold uppercase tracking-wide transition-all',
                    canProceed && !loading && !transitioning
                      ? 'bg-[color:var(--accent)] text-[#1a0e02] shadow-[0_8px_22px_-8px_rgba(255,138,30,0.7)] hover:bg-[color:var(--accent-bright)]'
                      : 'bg-white/[0.04] border border-[color:var(--card-border)] text-white/40 cursor-not-allowed',
                  )}
                >
                  {loading ? (<><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>)
                    : stage === TOTAL_STAGES ? (<><CheckCircle2 className="w-4 h-4" /> Create Profile</>)
                    : (<>Continue <ArrowRight className="w-4 h-4" /></>)}
                </button>
              </div>
            </div>
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
      <div className="flex items-center gap-2.5 p-3.5 rounded-[9px] border border-[color:var(--ok)]/40 bg-[color:var(--ok)]/10 text-[color:var(--ok)]">
        <ShieldCheck className="w-4 h-4 shrink-0" />
        <span className="text-sm font-semibold">{label} verified — ••••{state.last4}</span>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {state.status === 'unverified' && (
        <div className="space-y-1.5">
          <Label className={LABEL_CLS}>{label} number *</Label>
          <Input
            value={state.number}
            onChange={e => setState(s => ({ ...s, number: e.target.value.replace(/\D/g, '').slice(0, 12), error: '' }))}
            placeholder="XXXX XXXX XXXX" inputMode="numeric" maxLength={12}
            className={FIELD_CLS}
          />
          <p className="text-[10px] text-white/40">12 digits. Only the last 4 are ever stored — the full number is never saved or sent again after this step.</p>
          <button type="button" onClick={onSend} disabled={state.sending}
            className="font-[family-name:var(--font-barlow-semi)] text-xs font-bold uppercase tracking-wide px-4 py-2 rounded-[9px] border-[1.5px] border-[color:var(--card-border)] text-white hover:border-white/50 transition-colors disabled:opacity-50">
            {state.sending ? 'Sending…' : 'Send OTP'}
          </button>
        </div>
      )}

      {state.status === 'sent' && (
        <div className="space-y-2">
          <div className="p-2.5 rounded-[9px] border border-[color:var(--card-border)] bg-[rgba(255,138,30,0.08)]">
            <p className="text-[11px] font-bold text-[color:var(--accent-bright)]">Dev mode — no eKYC vendor connected</p>
            <p className="text-xs text-white/70 mt-0.5">Your test code is <span className="font-mono font-bold text-white">{state.devCode}</span> (last 4 of number: ••••{state.last4})</p>
          </div>
          <Label className={LABEL_CLS}>Enter OTP</Label>
          <div className="flex gap-2">
            <Input value={state.otp} onChange={e => setState(s => ({ ...s, otp: e.target.value.replace(/\D/g, '').slice(0, 6), error: '' }))}
              placeholder="6-digit code" inputMode="numeric" maxLength={6}
              className={FIELD_CLS} />
            <button type="button" onClick={onVerify} disabled={state.verifying}
              className="font-[family-name:var(--font-barlow-semi)] shrink-0 text-xs font-bold uppercase tracking-wide px-4 py-2 rounded-[9px] bg-[color:var(--accent)] text-[#1a0e02] hover:bg-[color:var(--accent-bright)] transition-colors disabled:opacity-50">
              {state.verifying ? 'Verifying…' : 'Verify'}
            </button>
          </div>
        </div>
      )}

      {state.error && <p className="text-xs text-[color:var(--bad)]">{state.error}</p>}
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
    <div className="rounded-[14px] border border-[color:var(--card-border)] bg-white/[0.02] overflow-hidden">
      <div className="px-4 py-3 border-b border-[color:var(--card-border)]">
        <p className="font-[family-name:var(--font-barlow-semi)] text-sm font-bold uppercase tracking-wide text-white">{title}</p>
      </div>
      <div ref={scrollRef} onScroll={handleScroll} className="px-4 py-3 max-h-40 overflow-y-auto text-xs text-white/60 leading-relaxed whitespace-pre-line">
        {body}
      </div>
      <label className={cn('flex items-center gap-2.5 px-4 py-3 border-t border-[color:var(--card-border)] cursor-pointer', !reachedEnd && 'cursor-not-allowed opacity-60')}>
        <input type="checkbox" checked={accepted} disabled={!reachedEnd} onChange={e => onAccept(e.target.checked)} className="w-4 h-4 accent-[color:var(--accent)]" />
        <span className="text-xs font-semibold text-white/80">
          {reachedEnd ? 'I have read and accept this consent' : 'Scroll to the end to accept'}
        </span>
      </label>
    </div>
  )
}
