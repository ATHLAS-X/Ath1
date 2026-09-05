'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { cn } from '@/lib/utils'

/*
 * New front door for sign-in and role-based sign-up. Does not replace
 * /claim (existing shadow-profile claim) or /onboarding (existing player
 * self-registration) — this page is what routes callers TO them, not a
 * replacement for either. Sign-in delegates entirely to the existing
 * NextAuth credentials provider (src/lib/auth.ts) — no auth logic here.
 *
 * Token note: design/import/AthlasX Auth.html's own palette (orange accent,
 * near-black background) is a still-open design-system decision per
 * design/import/MAPPING.md (§3, open decision #4) — this page intentionally
 * uses the existing --ax-bg/--ax-green + glass-card tokens instead of the
 * mockup's literal values, rather than silently introducing a second
 * accent color.
 */

type Mode = 'signin' | 'signup'
type Role = 'player' | 'association' | 'academy' | 'coach' | 'scout'

const ROLES: { value: Role; label: string; blurb: string }[] = [
  { value: 'player', label: 'Player', blurb: 'Athlete profile' },
  { value: 'association', label: 'Association', blurb: 'District or state cricket body' },
  { value: 'academy', label: 'Academy', blurb: 'Manage talent' },
  { value: 'coach', label: 'Coach', blurb: 'Train & track' },
  { value: 'scout', label: 'Scout', blurb: 'Discover players' },
]

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('signin')
  const [role, setRole] = useState<Role | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const result = await signIn('credentials', { email, password, redirect: false })
    setSubmitting(false)
    if (result?.error) {
      setError('Incorrect email or password.')
      return
    }
    // Root page's rootDestination() sends the now-signed-in session to its
    // own role's home page — no role branching needed here.
    router.push('/')
  }

  function handleRoleSelect(next: Role) {
    setRole(next)
    if (next === 'player') {
      router.push('/onboarding')
      return
    }
    if (next === 'academy') {
      // Target for Academy self-serve onboarding — that flow itself is not
      // yet built in this codebase (no page exists under this path today).
      // Routing here anyway rather than silently downgrading Academy to a
      // "not yet available" state, since a real Academy onboarding build
      // is expected to land at this path — but until it does, this link
      // 404s. Flagging rather than faking a working destination.
      router.push('/onboarding/academy')
      return
    }
    if (next === 'coach') {
      // Same caveat as Academy above — /onboarding/coach doesn't exist yet.
      router.push('/onboarding/coach')
      return
    }
    // association and scout: no working next step. Association is
    // deliberately NOT routed to a self-serve flow — the pivot document's
    // W1 workflow has AthlasX Ops approach associations directly (a
    // sales-led relationship, not a signup form), so a working
    // "sign up as an association" path would contradict the documented
    // product model, not just be a missing page. Scout has no account
    // path at all (no scout role exists in the pivot's phase-1 role
    // table). Both surface the same clearly-labeled unavailable state,
    // for different underlying reasons.
  }

  const roleUnavailable = role === 'association' || role === 'scout'

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md glass-card p-8 space-y-6">
        <div className="text-center">
          <div className="text-lg font-black tracking-tight mb-1">
            Athlas<span className="text-gradient-green">X</span>
          </div>
          <p className="text-xs text-zinc-500">Where India&apos;s next champions get found.</p>
        </div>

        <div role="tablist" aria-label="Sign in or sign up" className="flex rounded-lg border border-white/10 p-1 gap-1">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signin'}
            onClick={() => { setMode('signin'); setError(null) }}
            className={cn(
              'flex-1 text-sm font-bold py-2 rounded-md transition-colors',
              mode === 'signin' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300',
            )}
          >
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            onClick={() => { setMode('signup'); setError(null) }}
            className={cn(
              'flex-1 text-sm font-bold py-2 rounded-md transition-colors',
              mode === 'signup' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300',
            )}
          >
            Sign Up
          </button>
        </div>

        {mode === 'signin' ? (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-semibold text-zinc-400">Email</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white focus:outline-none focus:border-[--ax-green]"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-semibold text-zinc-400">Password</label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white focus:outline-none focus:border-[--ax-green]"
              />
            </div>
            {error && <p role="status" className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full text-sm font-bold px-4 py-2.5 rounded-lg bg-[--ax-green] text-black hover:brightness-110 transition disabled:opacity-50"
            >
              {submitting ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-xs font-semibold text-zinc-400">Select your role</p>
            <div className="grid grid-cols-1 gap-2" role="group" aria-label="Select your role">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  aria-pressed={role === r.value}
                  onClick={() => handleRoleSelect(r.value)}
                  className={cn(
                    'flex items-center justify-between text-left px-4 py-3 rounded-lg border transition-colors',
                    role === r.value
                      ? 'border-[--ax-green] bg-[--ax-green]/10'
                      : 'border-white/10 bg-white/[0.03] hover:border-white/20',
                  )}
                >
                  <span>
                    <span className="block text-sm font-bold text-white">{r.label}</span>
                    <span className="block text-[11px] text-zinc-500">{r.blurb}</span>
                  </span>
                </button>
              ))}
            </div>

            {roleUnavailable && (
              <div className="p-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.06]">
                <p className="text-xs font-bold text-amber-400">Not yet available</p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  {role === 'association'
                    ? 'Association accounts are set up directly by the AthlasX team as part of onboarding your association — there is no self-serve sign-up for this role yet.'
                    : 'Scout accounts are not yet supported on AthlasX — there is no scout-facing role or workflow in the current platform.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
