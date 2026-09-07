'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Settings, Eye, Users, Loader2, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

/*
 * W6 — player-facing visibility control
 *
 * PlayerProfile.visibility_tier decides who beyond a player's own
 * association can see their profile (src/lib/player-visibility.ts).
 * franchise_scout is intentionally not offered here — it's hard-disabled
 * behind FRANCHISE_SCOUT_ENABLED and there's no scout role to receive it
 * yet (see src/lib/feature-flags.ts).
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

export default function SettingsPage() {
  const [tier, setTier] = useState<SelectableTier | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasProfile, setHasProfile] = useState(true)

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

  return (
    <div className="space-y-6 max-w-[700px]">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-black text-white">Settings</h1>
        <p className="text-xs text-zinc-600 mt-0.5">Account and profile preferences</p>
      </motion.div>

      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-zinc-500" />
          <h2 className="text-sm font-bold text-white">Who can see my profile?</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-zinc-600">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : !hasProfile ? (
          <p className="text-xs text-zinc-600">No player profile is linked to this account yet.</p>
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
                    'w-full flex items-start gap-3 text-left px-4 py-3 rounded-xl border transition-colors disabled:opacity-60',
                    active
                      ? 'border-green-500/30 bg-green-500/[0.06]'
                      : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]',
                  )}
                >
                  <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', active ? 'text-green-400' : 'text-zinc-500')} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white">{t.label}</p>
                      {active && <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />}
                    </div>
                    <p className="text-[11px] text-zinc-600 mt-0.5">{t.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
