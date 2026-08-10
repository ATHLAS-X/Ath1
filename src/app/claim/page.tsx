'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Zap, Search, ArrowRight, ArrowLeft, Loader2, CheckCircle2,
  ShieldCheck, AlertCircle, User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/*
 * W2 — Player claim flow
 *
 * A player whose match data was ingested from an association source
 * (CricHeroes sync, scorecard OCR, manual upload) exists as a "shadow
 * profile" before they ever log in. This flow lets them find that profile
 * and take ownership of it via phone OTP.
 *
 * Under-18 players cannot self-verify: the OTP goes to a guardian's phone
 * instead, and guardian details are required before a code is issued
 * (DPDP Act — guardian consent is a legal precondition, not optional UX).
 */

interface Candidate {
  id: string
  full_name: string
  dob: string
  district: string
  state: string
  academy: string | null
  playing_role: string | null
}

type Step = 'search' | 'select' | 'details' | 'otp' | 'done'

export default function ClaimPage() {
  const [step, setStep] = useState<Step>('search')
  const [loading, setLoading] = useState(false)

  const [searchForm, setSearchForm] = useState({ fullName: '', district: '', dob: '' })
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [selected, setSelected] = useState<Candidate | null>(null)

  const [phone, setPhone] = useState('')
  const [isMinor, setIsMinor] = useState(false)
  const [guardianName, setGuardianName] = useState('')
  const [guardianPhone, setGuardianPhone] = useState('')
  const [guardianRelation, setGuardianRelation] = useState('')

  const [claimId, setClaimId] = useState<string | null>(null)
  const [otpSentTo, setOtpSentTo] = useState('')
  const [devOtp, setDevOtp] = useState('') // dev-only: no SMS gateway wired yet
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  function minorFromDob(dob: string) {
    const age = (Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000)
    return age < 18
  }

  async function handleSearch() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/claim/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCandidates(data.candidates)
      if (data.candidates.length === 0) setError('No matching profile found. Check the spelling of your name and district, or contact your association.')
      else setStep('select')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  function handleSelect(c: Candidate) {
    setSelected(c)
    setIsMinor(minorFromDob(c.dob))
    setStep('details')
  }

  async function handleStartClaim() {
    if (!selected) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/claim/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: selected.id, phone,
          guardianName: isMinor ? guardianName : undefined,
          guardianPhone: isMinor ? guardianPhone : undefined,
          guardianRelation: isMinor ? guardianRelation : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setClaimId(data.claimId)
      setOtpSentTo(data.otpSentTo)
      setDevOtp(data.devOtp)
      setStep('otp')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start claim')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify() {
    if (!claimId) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/claim/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimId, code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setStep('done')
      toast.success('Profile claimed. Consent recorded.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

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
        <div className="text-xs text-zinc-500">Claim your profile</div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait">

            {step === 'search' && (
              <motion.div key="search" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-6">
                <div>
                  <h2 className="text-3xl font-black text-white mb-1">Find Your Profile</h2>
                  <p className="text-zinc-500 text-sm">If your association has already uploaded your match data, your profile exists — claim it instead of creating a new one.</p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-zinc-400 text-sm">Full name *</Label>
                    <Input value={searchForm.fullName} onChange={e => setSearchForm(f => ({ ...f, fullName: e.target.value }))} placeholder="Arjun Sharma"
                      className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-zinc-400 text-sm">District *</Label>
                    <Input value={searchForm.district} onChange={e => setSearchForm(f => ({ ...f, district: e.target.value }))} placeholder="Kanpur"
                      className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-zinc-400 text-sm">Date of birth (optional, narrows results)</Label>
                    <Input type="date" value={searchForm.dob} onChange={e => setSearchForm(f => ({ ...f, dob: e.target.value }))}
                      className="bg-white/[0.05] border-white/10 text-white h-10 rounded-xl focus:border-green-500/50 [color-scheme:dark]" />
                  </div>
                </div>
                {error && <ErrorBox text={error} />}
                <Button onClick={handleSearch} disabled={!searchForm.fullName || !searchForm.district || loading} className="w-full">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Search
                </Button>
              </motion.div>
            )}

            {step === 'select' && (
              <motion.div key="select" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-6">
                <div>
                  <h2 className="text-3xl font-black text-white mb-1">Is This You?</h2>
                  <p className="text-zinc-500 text-sm">{candidates.length} matching profile{candidates.length === 1 ? '' : 's'} found</p>
                </div>
                <div className="space-y-2">
                  {candidates.map(c => (
                    <button key={c.id} onClick={() => handleSelect(c)}
                      className="w-full glass-card p-4 flex items-center gap-3 text-left hover:border-green-500/30 transition-colors">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-zinc-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white">{c.full_name}</p>
                        <p className="text-[11px] text-zinc-600">{c.district}, {c.state} · DOB {new Date(c.dob).toLocaleDateString('en-IN')}{c.academy ? ` · ${c.academy}` : ''}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-zinc-600 shrink-0" />
                    </button>
                  ))}
                </div>
                <button onClick={() => setStep('search')} className="flex items-center gap-2 text-sm text-zinc-500 hover:text-white transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to search
                </button>
              </motion.div>
            )}

            {step === 'details' && selected && (
              <motion.div key="details" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-6">
                <div>
                  <h2 className="text-3xl font-black text-white mb-1">Verify Your Identity</h2>
                  <p className="text-zinc-500 text-sm">Claiming: {selected.full_name} · {selected.district}</p>
                </div>

                {isMinor && (
                  <div className="flex items-start gap-2.5 p-4 rounded-2xl border border-amber-500/15 bg-amber-500/6">
                    <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-amber-300">Guardian consent required</p>
                      <p className="text-xs text-amber-300/70 mt-0.5">This player is under 18. The verification code will go to your guardian&apos;s phone, and their entering it is recorded as guardian consent (DPDP Act).</p>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-zinc-400 text-sm">Your phone number *</Label>
                    <Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210"
                      className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50" />
                  </div>

                  {isMinor && (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-zinc-400 text-sm">Guardian name *</Label>
                        <Input value={guardianName} onChange={e => setGuardianName(e.target.value)} placeholder="Guardian's full name"
                          className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-zinc-400 text-sm">Guardian phone *</Label>
                        <Input type="tel" value={guardianPhone} onChange={e => setGuardianPhone(e.target.value)} placeholder="+91 98765 43210"
                          className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50" />
                        <p className="text-[10px] text-zinc-700">The OTP is sent here, not to the player.</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-zinc-400 text-sm">Relation to player *</Label>
                        <Input value={guardianRelation} onChange={e => setGuardianRelation(e.target.value)} placeholder="Father / Mother / Legal guardian"
                          className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50" />
                      </div>
                    </>
                  )}
                </div>

                {error && <ErrorBox text={error} />}

                <div className="flex items-center gap-3">
                  <button onClick={() => setStep('select')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-zinc-400 hover:text-white text-sm font-medium transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <Button
                    onClick={handleStartClaim}
                    disabled={loading || !phone || (isMinor && (!guardianName || !guardianPhone || !guardianRelation))}
                    className="flex-1"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    Send verification code
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 'otp' && (
              <motion.div key="otp" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-6">
                <div>
                  <h2 className="text-3xl font-black text-white mb-1">Enter Verification Code</h2>
                  <p className="text-zinc-500 text-sm">Sent to {otpSentTo}</p>
                </div>

                {devOtp && (
                  <div className="flex items-start gap-2.5 p-4 rounded-2xl border border-blue-500/15 bg-blue-500/6">
                    <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-blue-300">Dev mode — no SMS gateway connected</p>
                      <p className="text-xs text-blue-300/70 mt-0.5">Code: <span className="font-mono font-bold">{devOtp}</span> (this box disappears once SMS_GATEWAY_API_KEY is set)</p>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-zinc-400 text-sm">6-digit code</Label>
                  <Input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456"
                    className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-12 rounded-xl text-center text-2xl tracking-[0.5em] font-mono focus:border-green-500/50" />
                </div>

                {error && <ErrorBox text={error} />}

                <Button onClick={handleVerify} disabled={code.length !== 6 || loading} className="w-full">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Verify & Claim
                </Button>
              </motion.div>
            )}

            {step === 'done' && (
              <motion.div key="done" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-white mb-1">Profile Claimed</h2>
                  <p className="text-zinc-500 text-sm">{isMinor ? 'Guardian consent recorded. ' : ''}Your match history is now linked to your account.</p>
                </div>
                <Link href="/dashboard">
                  <Button className="w-full">Go to dashboard <ArrowRight className="w-4 h-4" /></Button>
                </Link>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

function ErrorBox({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2.5 p-3 rounded-xl border border-red-500/15 bg-red-500/8">
      <AlertCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
      <p className="text-xs text-red-300/80">{text}</p>
    </div>
  )
}
