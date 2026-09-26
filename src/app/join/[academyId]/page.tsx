'use client'

import { useEffect, useState } from 'react'
import { Inter } from 'next/font/google'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isUnder18 } from '@/lib/age'

/**
 * Public guardian self-registration landing page — the destination of the
 * "QR/WhatsApp Invite" link generated on /academy/add-players, built from
 * design/import/AthlasX Player Self-Registration.html's light palette
 * (this page is meant to be opened by a parent on their own phone, not an
 * academy-admin dashboard screen, hence the light theme rather than the
 * navy academy-admin system).
 *
 * Fields collected beyond player_name/dob/guardian_phone (gender, playing
 * role, batting style, state) are UI-only for fidelity to the mockup —
 * AcademyJoinRequest has no columns for them (see the submit route's
 * header comment) — only what the pending-request model actually supports
 * reaches the database.
 */

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-inter' })

const JOIN_VARS = {
  '--bg': '#F5F7FA',
  '--card': '#FFFFFF',
  '--line': '#E4E8EC',
  '--ink': '#0D1B2A',
  '--ink-dim': '#5B6B7A',
  '--ink-faint': '#9AA7B2',
  '--accent': '#FF8A1E',
  '--accent-rgb': '255, 138, 30',
  '--accent-bright': '#E67812',
  '--wa': '#25D366',
  '--bad': '#FF4D4F',
} as React.CSSProperties

const CONTROL_CLS = 'w-full px-3.5 py-3 font-[family-name:var(--font-inter)] text-[15px] text-[color:var(--ink)] bg-[#FAFBFC] border-[1.5px] border-[color:var(--line)] rounded-[10px] outline-none placeholder:text-[color:var(--ink-faint)] focus:border-[color:var(--accent)] focus:shadow-[0_0_0_3px_rgba(255,138,30,0.18)] transition-all'
const LABEL_CLS = 'block text-[13px] font-bold text-[color:var(--ink)] mb-1.5'

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClick}
      className={cn('px-2 py-2.5 text-center rounded-[10px] border-[1.5px] text-sm font-bold cursor-pointer transition-all bg-[#FAFBFC]',
        active ? 'border-[color:var(--accent)] bg-[rgba(255,138,30,0.12)] text-[color:var(--accent-bright)]' : 'border-[color:var(--line)] text-[color:var(--ink-dim)]')}>
      {children}
    </div>
  )
}

export default function JoinPage({ params }: { params: { academyId: string } }) {
  const [academy, setAcademy] = useState<{ id: string; name: string } | null>(null)
  const [notFound, setNotFound] = useState(false)

  const [playerName, setPlayerName] = useState('')
  const [dob, setDob] = useState('')
  const [gender, setGender] = useState('Boy')
  const [role, setRole] = useState('BAT')
  const [battingStyle, setBattingStyle] = useState('Right-hand')
  const [state, setState] = useState('')

  const [guardianName, setGuardianName] = useState('')
  const [guardianPhone, setGuardianPhone] = useState('')
  const [otpRequestId, setOtpRequestId] = useState('')
  const [otpDevCode, setOtpDevCode] = useState('')
  const [otp, setOtp] = useState('')
  const [sendingOtp, setSendingOtp] = useState(false)
  const [consent, setConsent] = useState(false)

  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    fetch(`/api/academy/join/${params.academyId}`)
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) { setNotFound(true); return }
        setAcademy(d.academy)
      })
      .catch(() => setNotFound(true))
  }, [params.academyId])

  const isMinor = (() => {
    const d = new Date(dob)
    if (Number.isNaN(d.getTime())) return false
    return isUnder18(d)
  })()

  async function sendOtp() {
    const digits = guardianPhone.replace(/\D/g, '')
    if (digits.length !== 10) { setError('Enter a valid 10-digit guardian phone number.'); return }
    setSendingOtp(true); setError('')
    try {
      const res = await fetch(`/api/academy/join/${params.academyId}/send-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: digits }),
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

  async function submit() {
    setError('')
    if (!playerName.trim() || !dob) { setError("Please enter the player's full name and date of birth."); return }
    if (isMinor) {
      if (!guardianName.trim() || guardianPhone.replace(/\D/g, '').length !== 10) { setError('Guardian name and phone are required.'); return }
      if (!otpRequestId || otp.replace(/\D/g, '').length !== 6) { setError('Please verify the OTP sent to the guardian phone.'); return }
      if (!consent) { setError('Guardian consent is required to submit.'); return }
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/academy/join/${params.academyId}/submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_name: playerName, dob, guardian_name: guardianName, guardian_phone: guardianPhone,
          otp_request_id: otpRequestId, otp, consent,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not submit registration')
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit registration')
    } finally {
      setSubmitting(false)
    }
  }

  if (notFound) {
    return (
      <div className={cn(inter.variable, 'font-[family-name:var(--font-inter)] min-h-screen flex items-center justify-center p-6')} style={{ ...JOIN_VARS, background: 'var(--bg)', color: 'var(--ink)' }}>
        <p className="text-sm text-[color:var(--ink-dim)]">This invite link isn&apos;t valid — please ask your academy for a new one.</p>
      </div>
    )
  }

  return (
    <div className={cn(inter.variable, 'font-[family-name:var(--font-inter)] min-h-screen')} style={{ ...JOIN_VARS, background: 'var(--bg)', color: 'var(--ink)' }}>
      <div className="max-w-[480px] mx-auto px-4 pt-6 pb-12">
        <div className="flex items-center gap-2.5 mb-3">
          <span className="w-[38px] h-[38px] rounded-[9px] bg-[color:var(--accent)] text-white flex items-center justify-center font-extrabold text-sm shrink-0">AX</span>
          <span className="font-extrabold text-[16px]">{academy?.name ?? '…'}</span>
        </div>
        {!done && <p className="text-[14px] text-[color:var(--ink-dim)] leading-relaxed mb-5"><b className="text-[color:var(--ink)]">{academy?.name}</b> has invited you to register your child on AthlasX.</p>}

        <div className="bg-[color:var(--card)] rounded-2xl shadow-[0_12px_32px_-14px_rgba(13,27,42,0.16)] p-5">
          {done ? (
            <div className="text-center py-2">
              <div className="w-[70px] h-[70px] rounded-full bg-[rgba(255,138,30,0.14)] border-2 border-[color:var(--accent)] flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-[color:var(--accent)]" />
              </div>
              <h2 className="text-xl font-extrabold mb-1.5">Your registration is pending approval</h2>
              <p className="text-sm text-[color:var(--ink-dim)] leading-relaxed">
                The academy admin will review and add <b className="text-[color:var(--ink)]">{playerName}</b> to the roster. You&apos;ll receive a WhatsApp message when approved.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className={LABEL_CLS}>Player Full Name *</label>
                <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="e.g. Aarav Patel" className={CONTROL_CLS} />
              </div>
              <div>
                <label className={LABEL_CLS}>Date of Birth *</label>
                <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={CONTROL_CLS} />
              </div>
              <div>
                <label className={LABEL_CLS}>Gender</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Boy', 'Girl', 'Other'].map((g) => <Pill key={g} active={gender === g} onClick={() => setGender(g)}>{g}</Pill>)}
                </div>
              </div>
              <div>
                <label className={LABEL_CLS}>Playing Role</label>
                <div className="grid grid-cols-4 gap-2">
                  {['BAT', 'BOWL', 'ALL-ROUND', 'WK'].map((r) => <Pill key={r} active={role === r} onClick={() => setRole(r)}>{r}</Pill>)}
                </div>
              </div>
              <div>
                <label className={LABEL_CLS}>Batting Style</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Right-hand', 'Left-hand'].map((b) => <Pill key={b} active={battingStyle === b} onClick={() => setBattingStyle(b)}>{b}</Pill>)}
                </div>
              </div>
              <div>
                <label className={LABEL_CLS}>State</label>
                <select value={state} onChange={(e) => setState(e.target.value)} className={CONTROL_CLS}>
                  <option value="">Select state…</option>
                  {['Karnataka', 'Maharashtra', 'Tamil Nadu', 'Delhi', 'Punjab', 'Kerala', 'Gujarat', 'West Bengal'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {isMinor && (
                <div className="border-l-[3px] border-[color:var(--accent)] bg-[#FFF7EE] rounded-r-xl p-4 space-y-4">
                  <div className="space-y-2">
                    <p className="text-[14px] font-bold leading-relaxed">You are registering a minor. This section is asking for your consent, not the player&apos;s.</p>
                    <p className="text-[12.5px] leading-relaxed text-[color:var(--ink-dim)]">
                      Under India&apos;s Digital Personal Data Protection Act, 2023 (DPDP Rules, 2025 — Rule 10), a child cannot legally consent to their own data being processed — only a parent or legal guardian can. Below, you&apos;re confirming your own identity and relationship to the player, separately from the player&apos;s details above.
                    </p>
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Parent / Guardian Full Name *</label>
                    <input value={guardianName} onChange={(e) => setGuardianName(e.target.value)} placeholder="Full name" className={CONTROL_CLS} />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Guardian Mobile Number *</label>
                    <div className="flex gap-2">
                      <input value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit number" className={CONTROL_CLS} disabled={!!otpRequestId} />
                      <button type="button" onClick={sendOtp} disabled={sendingOtp}
                        className="shrink-0 px-4 rounded-[9px] bg-[color:var(--accent)] text-white font-bold text-sm hover:bg-[color:var(--accent-bright)] disabled:opacity-50">
                        {sendingOtp ? 'Sending…' : otpRequestId ? 'Resend' : 'Send OTP'}
                      </button>
                    </div>
                  </div>
                  {otpRequestId && (
                    <div className="space-y-1.5">
                      <div className="p-2.5 rounded-lg border border-[color:var(--line)] bg-[rgba(255,138,30,0.1)]">
                        <p className="text-[12px] font-bold text-[color:var(--accent-bright)]">Dev mode — no SMS gateway connected</p>
                        <p className="text-[12px] text-[color:var(--ink-dim)] mt-0.5">Your test code is <span className="font-mono font-bold text-[color:var(--ink)]">{otpDevCode}</span></p>
                      </div>
                      <label className={LABEL_CLS}>Enter OTP</label>
                      <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" className={CONTROL_CLS} />
                    </div>
                  )}
                  <label className="flex items-start gap-2 text-[13px] text-[color:var(--ink-dim)] leading-relaxed">
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 w-[17px] h-[17px] accent-[color:var(--accent)] shrink-0" />
                    I confirm I am this player&apos;s parent or legal guardian. I consent to AthlasX collecting the player&apos;s name, date of birth, and contact details now, and — once verified by an association — their match performance data, used only to build their player profile and score. This data will never be used for behavioral monitoring or targeted advertising, and I can withdraw this consent at any time by contacting AthlasX.
                  </label>
                </div>
              )}

              {error && <p className="text-sm text-[color:var(--bad)]">{error}</p>}

              <button type="button" onClick={submit} disabled={submitting}
                className="w-full py-3.5 rounded-[11px] bg-[color:var(--accent)] text-white font-extrabold text-[15px] hover:bg-[color:var(--accent-bright)] transition-colors shadow-[0_10px_24px_-10px_rgba(255,138,30,0.55)] disabled:opacity-75 flex items-center justify-center gap-2">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Registration'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
