'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Settings, Eye, Users, Loader2, CheckCircle2, KeyRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'

/*
 * Account settings.
 *
 * W6 — player-facing visibility control. PlayerProfile.visibility_tier
 * decides who beyond a player's own association can see their profile
 * (src/lib/player-visibility.ts). franchise_scout is intentionally not
 * offered here — it's hard-disabled behind FRANCHISE_SCOUT_ENABLED and
 * there's no scout role to receive it yet (see src/lib/feature-flags.ts).
 *
 * Password change — for every role, via POST /api/auth/change-password.
 *
 * Still not here: account/contact-info editing, or guardian details for
 * minors. Neither exists anywhere else in the codebase either.
 */

type SelectableTier = 'association_only' | 'cross_association'

const TIERS: { value: SelectableTier; label: string; description: string; icon: typeof Eye }[] = [
  {
    value: 'association_only',
    label: 'My association only',
    description: 'Only your own association’s staff (and AthlasX ops) can see your profile. This is the default.',
    icon: Eye,
  },
  {
    value: 'cross_association',
    label: 'Any association',
    description: 'Staff from any cricket association on the platform can see your profile — useful if you’re trying out for trials outside your home district.',
    icon: Users,
  },
]

const FIELD_CLS =
  'w-full h-10 px-3 rounded-ax-md bg-ax-fieldBg border border-ax-cardBorder text-ax-text text-sm placeholder:text-ax-textFaint focus:outline-none focus:border-ax-accent'

export default function SettingsPage() {
  const [tier, setTier] = useState<SelectableTier | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasProfile, setHasProfile] = useState(true)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changing, setChanging] = useState(false)

  useEffect(() => {
    fetch('/api/player/visibility')
      .then((r) => r.json())
      .then((d) => {
        if (!d.player) { setHasProfile(false); return }
        setTier(d.player.visibility_tier)
      })
      .finally(() => setLoading(false))
  }, [])

  async function save(next: SelectableTier) {
    if (next === tier) return
    setSaving(true)
    const prev = tier
    setTier(next)
    const res = await fetch('/api/player/visibility', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibility_tier: next }),
    })
    if (!res.ok) {
      setTier(prev)
      toast.error('Could not update visibility. Please try again.')
    } else {
      toast.success('Visibility updated')
    }
    setSaving(false)
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast.error('The new passwords don’t match.')
      return
    }
    setChanging(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error ?? 'Could not change your password. Please try again.')
        return
      }
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast.success('Password changed. You’ve been signed out everywhere else.')
    } catch {
      toast.error('Could not change your password. Please try again.')
    } finally {
      setChanging(false)
    }
  }

  return (
    <div className="space-y-6 max-w-[700px] font-barlow">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-anton uppercase text-xl text-ax-text">Settings</h1>
        <p className="text-xs text-ax-textFaint mt-0.5">Account and profile preferences</p>
      </motion.div>

      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-ax-textDim" />
          <h2 className="text-sm font-bold text-ax-text">Who can see my profile?</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-ax-textFaint">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : !hasProfile ? (
          <p className="text-xs text-ax-textFaint">No player profile is linked to this account yet.</p>
        ) : (
          <div className="space-y-2">
            {TIERS.map((t) => {
              const Icon = t.icon
              const active = tier === t.value
              return (
                <button
                  key={t.value}
                  onClick={() => save(t.value)}
                  disabled={saving}
                  className={cn(
                    'w-full flex items-start gap-3 text-left px-4 py-3 rounded-ax-md border transition-colors disabled:opacity-60',
                    active
                      ? 'border-ax-accent/40 bg-[rgba(255,138,30,0.06)]'
                      : 'border-ax-cardBorder bg-white/[0.02] hover:border-white/[0.24]',
                  )}
                >
                  <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', active ? 'text-ax-accentBright' : 'text-ax-textDim')} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-ax-text">{t.label}</p>
                      {active && <CheckCircle2 className="w-3.5 h-3.5 text-ax-accentBright shrink-0" />}
                    </div>
                    <p className="text-[11px] text-ax-textFaint mt-0.5">{t.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-ax-textDim" />
          <h2 className="text-sm font-bold text-ax-text">Change password</h2>
        </div>

        <form onSubmit={changePassword} className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="current-password" className="text-[11px] font-bold uppercase tracking-[0.08em] text-ax-textDim">
              Current password
            </label>
            <input
              id="current-password"
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={FIELD_CLS}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="new-password" className="text-[11px] font-bold uppercase tracking-[0.08em] text-ax-textDim">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              required
              minLength={10}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={FIELD_CLS}
            />
            <p className="text-[11px] text-ax-textFaint">At least 10 characters, with letters and numbers.</p>
          </div>
          <div className="space-y-1">
            <label htmlFor="confirm-password" className="text-[11px] font-bold uppercase tracking-[0.08em] text-ax-textDim">
              Confirm new password
            </label>
            <input
              id="confirm-password"
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={FIELD_CLS}
            />
          </div>
          <button
            type="submit"
            disabled={changing}
            className="inline-flex items-center gap-2 font-barlow-semi text-[12.5px] font-bold uppercase tracking-[0.06em] bg-ax-accent text-[#1a0e02] px-[18px] py-[11px] rounded-ax-md hover:bg-ax-accentBright transition-colors disabled:opacity-60"
          >
            {changing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {changing ? 'Changing…' : 'Change password'}
          </button>
        </form>
      </Card>
    </div>
  )
}
