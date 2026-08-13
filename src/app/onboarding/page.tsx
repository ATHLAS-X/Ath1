'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { ArrowRight, ArrowLeft, Loader2, Zap, CheckCircle2, AlertCircle, Upload, Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { toast } from 'sonner'

/*
 * AthlasX Player Onboarding
 *
 * Collects: identity, playing role, footage links.
 * Does NOT collect self-reported stats — those come from ingested scorecard data only.
 * Does NOT collect fitness/behaviour ratings — those are coach-supervised evaluations only.
 * Under-18 players require a guardian phone number (DPDP Act compliance).
 */

const TOTAL_STEPS = 4

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

export default function OnboardingPage() {
  const [step, setStep]     = useState(1)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const [form, setForm] = useState({
    // Step 1 — Identity
    fullName: '', dob: '', district: '', state: '',
    guardianPhone: '',   // required if under-18
    cricheroes_handle: '',
    // Step 2 — Playing profile
    playingRole: '', battingStyle: '', bowlingStyle: '',
    selectedFormats: [] as string[],
    academy: '', yearsExperience: '',
    // Step 3 — Footage (optional but highly recommended)
    batting_url: '', bowling_url: '', keeping_url: '',
    youtube_channel: '',
    bio: '',
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

  function canProceed() {
    if (step === 1) {
      const base = form.fullName && form.dob && form.district && form.state
      return minor ? base && form.guardianPhone : base
    }
    if (step === 2) return Boolean(form.playingRole)
    return true
  }

  async function handleNext() {
    if (step < TOTAL_STEPS) { setStep(s => s + 1); return }

    setLoading(true)
    try {
      // In production: POST to /api/player/onboard → creates shadow or claimed PlayerProfile in Supabase
      await new Promise(r => setTimeout(r, 1000))
      toast.success('Profile created. Your match record will populate as data is ingested.')
      router.push('/dashboard')
    } catch (err) {
      console.error(err)
      toast.error('Failed to save profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const progress = (step / TOTAL_STEPS) * 100

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col">
      {/* Header */}
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
          <div className="text-xs text-zinc-500">Step {step} of {TOTAL_STEPS}</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-white/[0.05]">
        <motion.div
          className="h-full bg-gradient-to-r from-green-600 to-emerald-400"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >

              {/* ── Step 1: Identity ── */}
              {step === 1 && (
                <>
                  <div>
                    <h2 className="text-3xl font-black text-white mb-1">Your Identity</h2>
                    <p className="text-zinc-500 text-sm">Basic details to create your player profile</p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-zinc-400 text-sm">Full name *</Label>
                      <Input
                        value={form.fullName}
                        onChange={e => update('fullName', e.target.value)}
                        placeholder="Arjun Sharma"
                        className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-zinc-400 text-sm">Date of birth *</Label>
                      <Input
                        type="date"
                        value={form.dob}
                        onChange={e => update('dob', e.target.value)}
                        className="bg-white/[0.05] border-white/10 text-white h-10 rounded-xl focus:border-green-500/50 [color-scheme:dark]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-zinc-400 text-sm">District *</Label>
                        <Input
                          value={form.district}
                          onChange={e => update('district', e.target.value)}
                          placeholder="Kanpur"
                          className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-zinc-400 text-sm">State *</Label>
                        <select
                          value={form.state}
                          onChange={e => update('state', e.target.value)}
                          className="w-full h-10 px-3 rounded-xl bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-green-500/50"
                        >
                          <option value="" className="bg-zinc-900">Select state</option>
                          {indianStates.map(s => <option key={s} value={s} className="bg-zinc-900">{s}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Guardian phone — required for under-18 (DPDP Act) */}
                    <AnimatePresence>
                      {minor && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-1.5">
                            <Label className="text-zinc-400 text-sm">Guardian phone *</Label>
                            <Input
                              type="tel"
                              value={form.guardianPhone}
                              onChange={e => update('guardianPhone', e.target.value)}
                              placeholder="+91 98765 43210"
                              className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50"
                            />
                            <div className="flex items-start gap-2 p-3 rounded-xl border border-amber-500/15 bg-amber-500/8">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                              <p className="text-[11px] text-amber-300/80">
                                Required for players under 18 (DPDP Act compliance). Guardian consent will be requested before your data can be shared with selectors.
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="space-y-1.5">
                      <Label className="text-zinc-400 text-sm">CricHeroes handle</Label>
                      <Input
                        value={form.cricheroes_handle}
                        onChange={e => update('cricheroes_handle', e.target.value)}
                        placeholder="@arjun_sharma"
                        className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50"
                      />
                      <p className="text-[10px] text-zinc-700">Helps us match your existing match history when the association ingests CricHeroes data</p>
                    </div>
                  </div>
                </>
              )}

              {/* ── Step 2: Playing Profile ── */}
              {step === 2 && (
                <>
                  <div>
                    <h2 className="text-3xl font-black text-white mb-1">Playing Profile</h2>
                    <p className="text-zinc-500 text-sm">Your cricket identity for the dossier</p>
                  </div>

                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label className="text-zinc-400 text-sm">Playing role *</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {playingRoles.map(role => (
                          <button
                            key={role} type="button"
                            onClick={() => update('playingRole', role)}
                            className={cn(
                              'px-3 py-2.5 rounded-xl text-sm font-medium border transition-all',
                              form.playingRole === role
                                ? 'bg-green-500/15 border-green-500/40 text-green-400'
                                : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:bg-white/[0.06]'
                            )}
                          >
                            {role}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-zinc-400 text-sm">Batting style</Label>
                      <div className="flex gap-2">
                        {battingStyles.map(s => (
                          <button
                            key={s} type="button"
                            onClick={() => update('battingStyle', s)}
                            className={cn(
                              'flex-1 py-2 rounded-xl text-sm font-medium border transition-all',
                              form.battingStyle === s
                                ? 'bg-green-500/15 border-green-500/40 text-green-400'
                                : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:bg-white/[0.06]'
                            )}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-zinc-400 text-sm">Bowling style</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {bowlingStyles.map(s => (
                          <button
                            key={s} type="button"
                            onClick={() => update('bowlingStyle', s)}
                            className={cn(
                              'px-2 py-2 rounded-xl text-xs font-medium border transition-all text-left',
                              form.bowlingStyle === s
                                ? 'bg-green-500/15 border-green-500/40 text-green-400'
                                : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:bg-white/[0.06]'
                            )}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-zinc-400 text-sm">Preferred formats</Label>
                      <div className="flex gap-2">
                        {formats.map(f => (
                          <button
                            key={f} type="button"
                            onClick={() => toggleFormat(f)}
                            className={cn(
                              'flex-1 py-2 rounded-xl text-sm font-medium border transition-all',
                              form.selectedFormats.includes(f)
                                ? 'bg-green-500/15 border-green-500/40 text-green-400'
                                : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:bg-white/[0.06]'
                            )}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-zinc-400 text-sm">Academy</Label>
                        <Input
                          value={form.academy}
                          onChange={e => update('academy', e.target.value)}
                          placeholder="Tara Cricket Academy"
                          className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-zinc-400 text-sm">Years of cricket</Label>
                        <Input
                          type="number"
                          value={form.yearsExperience}
                          onChange={e => update('yearsExperience', e.target.value)}
                          placeholder="5"
                          min="0" max="25"
                          className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl focus:border-green-500/50"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ── Step 3: Footage & Bio ── */}
              {step === 3 && (
                <>
                  <div>
                    <h2 className="text-3xl font-black text-white mb-1">Footage & Bio</h2>
                    <p className="text-zinc-500 text-sm">Video clips help selectors assess what scorecard data cannot capture</p>
                  </div>

                  {/* Why footage matters */}
                  <div className="flex items-start gap-2.5 p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                    <Upload className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-zinc-300">Why add footage?</p>
                      <p className="text-xs text-zinc-600 mt-0.5">
                        Batting and bowling are scored from verified scorecard data. Fielding and wicket-keeping cannot be scored from scorecards — they record only successful attempts. Footage lets selectors assess these dimensions directly.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {[
                      { key: 'batting_url',  label: 'Batting clip URL',  placeholder: 'YouTube / Google Drive link' },
                      { key: 'bowling_url',  label: 'Bowling clip URL',  placeholder: 'YouTube / Google Drive link' },
                      { key: 'keeping_url',  label: 'Keeping clip URL',  placeholder: 'Optional · YouTube / Google Drive link' },
                      { key: 'youtube_channel', label: 'YouTube channel', placeholder: 'youtube.com/@handle (optional)' },
                    ].map(f => (
                      <div key={f.key} className="space-y-1.5">
                        <Label className="text-zinc-400 text-sm">{f.label}</Label>
                        <div className="relative">
                          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
                          <Input
                            value={(form as unknown as Record<string, string>)[f.key]}
                            onChange={e => update(f.key, e.target.value)}
                            placeholder={f.placeholder}
                            className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 h-10 rounded-xl pl-8 focus:border-green-500/50"
                          />
                        </div>
                      </div>
                    ))}

                    <div className="space-y-1.5">
                      <Label className="text-zinc-400 text-sm">Bio</Label>
                      <textarea
                        value={form.bio}
                        onChange={e => update('bio', e.target.value)}
                        placeholder="Your cricket journey, strengths, goals…"
                        maxLength={400}
                        rows={3}
                        className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-green-500/50 resize-none"
                      />
                      <p className="text-[10px] text-zinc-700 text-right">{form.bio.length}/400</p>
                    </div>
                  </div>
                </>
              )}

              {/* ── Step 4: Review ── */}
              {step === 4 && (
                <>
                  <div>
                    <h2 className="text-3xl font-black text-white mb-1">Review & Submit</h2>
                    <p className="text-zinc-500 text-sm">Your profile is ready. Match stats will populate as the association ingests data.</p>
                  </div>

                  <div className="space-y-3">
                    {[
                      { label: 'Name',         value: form.fullName || '—' },
                      { label: 'DOB',          value: form.dob || '—' },
                      { label: 'District',     value: form.district || '—' },
                      { label: 'State',        value: form.state || '—' },
                      { label: 'Role',         value: form.playingRole || '—' },
                      { label: 'Batting',      value: form.battingStyle || '—' },
                      { label: 'Academy',      value: form.academy || 'Not specified' },
                      { label: 'Footage',      value: [form.batting_url, form.bowling_url].filter(Boolean).length + ' clips added' },
                    ].map(row => (
                      <div key={row.label} className="flex justify-between text-sm py-2 border-b border-white/[0.05]">
                        <span className="text-zinc-500">{row.label}</span>
                        <span className="text-zinc-200 font-semibold truncate max-w-[220px] text-right">{row.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-start gap-2.5 p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                    <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-zinc-300">What happens next</p>
                      <ul className="text-xs text-zinc-600 mt-1 space-y-0.5">
                        <li>· Your profile is created as a shadow profile</li>
                        <li>· Match history populates from association-ingested scorecard data</li>
                        <li>· AthlasX score is calculated from verified match data only — no self-reported stats</li>
                        {minor && <li>· Guardian consent OTP will be sent to {form.guardianPhone}</li>}
                      </ul>
                    </div>
                  </div>
                </>
              )}

            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 gap-4">
            {step > 1 ? (
              <button
                onClick={() => setStep(s => s - 1)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-zinc-400 hover:text-white text-sm font-medium transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            ) : <div />}

            <button
              onClick={handleNext}
              disabled={!canProceed() || loading}
              className={cn(
                'flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all',
                canProceed() && !loading
                  ? 'bg-green-600 hover:bg-green-500 text-white'
                  : 'bg-white/[0.04] border border-white/[0.08] text-zinc-600 cursor-not-allowed'
              )}
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              ) : step === TOTAL_STEPS ? (
                <><CheckCircle2 className="w-4 h-4" /> Create Profile</>
              ) : (
                <>Continue <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
