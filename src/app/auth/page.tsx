'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import Image from 'next/image'
import { Anton, Barlow, Barlow_Semi_Condensed } from 'next/font/google'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

/*
 * New front door for sign-in and role-based sign-up. Does not replace
 * /claim (existing shadow-profile claim) or /onboarding (existing player
 * self-registration) — this page is what routes callers TO them, not a
 * replacement for either. Sign-in delegates entirely to the existing
 * NextAuth credentials provider (src/lib/auth.ts) — no auth logic here.
 *
 * Visual language matches design/import/AthlasX Auth.html on direct
 * instruction — resolves design/import/MAPPING.md's open decision #4
 * (orange/Anton palette) for the landing + auth pages specifically, not
 * site-wide. Two deliberate deviations from the mockup's markup:
 *   - Sign-up stays a role picker into the real onboarding wizards built
 *     this session, not a generic name/email/password form — those wizards
 *     each collect name/etc. themselves, so duplicating those fields here
 *     would just be discarded input.
 *   - "Continue with Google" is disabled with a toast, not wired to a demo
 *     "signed in!" state — no Google OAuth provider is configured in
 *     src/lib/auth.ts, and faking a working button would be worse than
 *     admitting it isn't there yet.
 */

const anton = Anton({ subsets: ['latin'], weight: '400', variable: '--font-anton' })
const barlow = Barlow({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-barlow' })
const barlowSemi = Barlow_Semi_Condensed({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-barlow-semi' })

const AUTH_VARS = {
  '--accent': '#FF8A1E',
  '--accent-bright': '#FFA64D',
  '--bg': '#0D0D0D',
} as React.CSSProperties

type Mode = 'signin' | 'signup'
type Role = 'player' | 'association' | 'academy' | 'coach' | 'scout'

const ROLES: { value: Role; label: string; blurb: string }[] = [
  { value: 'player', label: 'Player', blurb: 'Athlete profile' },
  { value: 'association', label: 'Association', blurb: 'District or state cricket body' },
  { value: 'academy', label: 'Academy', blurb: 'Manage talent' },
  { value: 'coach', label: 'Coach', blurb: 'Train & track' },
  { value: 'scout', label: 'Scout', blurb: 'Discover players' },
]

const TILES = [
  { src: '/images/hero/motorsport.jpg', alt: 'Motorsport driver on a single-seater under a vast sky', className: 'row-span-2' },
  { src: '/images/hero/badminton.jpg', alt: 'Badminton player roaring in triumph, flag behind' },
  { src: '/images/hero/tennis-sunburst.jpg', alt: 'Stylised tennis player against a warm sunburst', className: 'row-span-2' },
  { src: '/images/hero/cricket.jpg', alt: 'Cricketer in national kit against a smoke-coloured sky' },
]

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('signin')
  const [role, setRole] = useState<Role | null>('player')
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
    router.push('/')
  }

  const ROLE_WIZARD_PATH: Record<'player' | 'coach' | 'academy' | 'scout' | 'association', string> = {
    player: '/player/onboarding',
    coach: '/coach/onboarding',
    academy: '/academy/onboarding',
    scout: '/scout/onboarding',
    association: '/onboarding/association',
  }

  // Temporary: association/academy/scout used to stop here with a flag-
  // gated "not yet available" notice and no way past it. Per explicit
  // instruction, that gating is removed at THIS picker level for now —
  // selecting any of the three navigates straight to its own onboarding
  // page, full stop. Each destination page still independently checks its
  // own feature flag (ASSOCIATION_SELF_SERVE_ENABLED / ACADEMY_SELF_SERVE_ENABLED
  // / SCOUT_SELF_SERVE_ENABLED) and will show its own not-available state
  // if that flag is still off — this change only removes the auth page's
  // own redundant pre-check, not those pages' real gates.
  function handleRoleSelect(next: Role) {
    setRole(next)
    setError(null)
    if (next === 'association' || next === 'academy' || next === 'scout') {
      router.push(ROLE_WIZARD_PATH[next])
    }
  }

  const roleAvailable = role === 'player' || role === 'coach'
  const roleUnavailable = false

  // Creates the bare account (email+password+role, no profile yet) and
  // signs the caller in, then hands off to that role's existing onboarding
  // wizard — which now runs authenticated and only attaches a profile to
  // the user_id already on the session, instead of collecting email+
  // password itself and creating the account at the very end.
  async function handleRoleSignUp(e: React.FormEvent) {
    e.preventDefault()
    if (!roleAvailable) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, email, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error ?? 'Could not create your account. Please try again.')
        setSubmitting(false)
        return
      }
      router.push(ROLE_WIZARD_PATH[role as 'player' | 'coach' | 'academy' | 'scout'])
    } catch {
      setError('Could not create your account. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className={cn(anton.variable, barlow.variable, barlowSemi.variable)} style={AUTH_VARS}>
      <div className="grid lg:grid-cols-[1fr_2fr] min-h-screen bg-[color:var(--bg)]">
        {/* ── LEFT: collage showcase ── */}
        <div className="relative hidden lg:block overflow-hidden">
          <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-[3px]">
            {TILES.map((t) => (
              <div key={t.src} className={cn('relative overflow-hidden', t.className)}>
                <Image src={t.src} alt={t.alt} fill sizes="33vw" style={{ objectFit: 'cover' }} />
              </div>
            ))}
          </div>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(120% 100% at 40% 42%, rgba(13,13,13,0) 0%, rgba(13,13,13,0.15) 40%, rgba(13,13,13,0.6) 74%, rgba(13,13,13,0.94) 100%), linear-gradient(90deg, rgba(13,13,13,0) 55%, rgba(13,13,13,0.75) 100%)',
            }}
          />
          <div className="absolute top-8 left-8 font-[family-name:var(--font-barlow-semi)] text-sm font-bold uppercase tracking-[0.22em] text-white">
            Athlas<span className="text-[color:var(--accent)]">X</span>
          </div>
          <div className="absolute left-8 right-8 bottom-8 max-w-md">
            <p className="font-[family-name:var(--font-barlow-semi)] text-[11px] font-bold uppercase tracking-[0.3em] text-[color:var(--accent-bright)] mb-2.5">
              Grassroots to Global
            </p>
            <h2 className="font-[family-name:var(--font-anton)] uppercase font-normal leading-[0.92] text-white text-4xl">
              Where India&apos;s next <b className="text-[color:var(--accent)] font-normal">champions</b> get found.
            </h2>
            <p className="font-[family-name:var(--font-barlow)] mt-3 text-sm text-white/80">
              One profile. Every sport. Seen by the coaches, academies and scouts who matter.
            </p>
          </div>
        </div>

        {/* ── RIGHT: form ── */}
        <div className="relative flex flex-col justify-center px-6 sm:px-14 py-16">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(120% 60% at 100% 0%, rgba(255,138,30,0.08), transparent 60%)' }}
          />
          <div className="relative w-full max-w-md lg:max-w-none mx-auto lg:mx-0">
            <p className="font-[family-name:var(--font-barlow-semi)] text-[11px] font-bold uppercase tracking-[0.2em] text-[color:var(--accent-bright)] mb-1.5">
              {mode === 'signup' ? 'Join AthlasX' : 'Welcome back'}
            </p>
            <h1 className="font-[family-name:var(--font-anton)] uppercase font-normal text-4xl sm:text-5xl text-white mb-1.5">
              {mode === 'signup' ? 'Create account' : 'Sign in'}
            </h1>
            <p className="font-[family-name:var(--font-barlow)] text-sm text-white/60 mb-6">
              {mode === 'signup' ? 'Set up your profile in under a minute.' : 'Pick up right where you left off.'}
            </p>

            <div role="tablist" aria-label="Sign in or sign up" className="grid grid-cols-2 gap-1 p-1 mb-6 rounded-[11px] bg-white/[0.06] border border-white/[0.14]">
              <button
                type="button" role="tab" aria-selected={mode === 'signin'}
                onClick={() => { setMode('signin'); setError(null) }}
                className={cn(
                  'font-[family-name:var(--font-barlow-semi)] text-sm font-bold uppercase tracking-wide py-2.5 rounded-lg transition-colors',
                  mode === 'signin' ? 'bg-[color:var(--accent)] text-[#1a0e02]' : 'text-white/60 hover:text-white',
                )}
              >
                Sign In
              </button>
              <button
                type="button" role="tab" aria-selected={mode === 'signup'}
                onClick={() => { setMode('signup'); setError(null) }}
                className={cn(
                  'font-[family-name:var(--font-barlow-semi)] text-sm font-bold uppercase tracking-wide py-2.5 rounded-lg transition-colors',
                  mode === 'signup' ? 'bg-[color:var(--accent)] text-[#1a0e02]' : 'text-white/60 hover:text-white',
                )}
              >
                Sign Up
              </button>
            </div>

            {mode === 'signin' ? (
              <form onSubmit={handleSignIn} className="space-y-3">
                <input
                  type="email" required value={email} placeholder="Email address"
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-[9px] bg-white/[0.06] border border-white/[0.14] text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-[color:var(--accent)] focus:bg-white/[0.09] transition-colors"
                />
                <input
                  type="password" required value={password} placeholder="Password"
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-[9px] bg-white/[0.06] border border-white/[0.14] text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-[color:var(--accent)] focus:bg-white/[0.09] transition-colors"
                />
                {error && <p role="status" className="text-xs text-[#ff8a7e]">{error}</p>}

                <div className="flex items-center justify-between text-sm text-white/60 pt-1 pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-[15px] h-[15px] accent-[color:var(--accent)]" />
                    Remember me
                  </label>
                  <button
                    type="button"
                    onClick={() => toast.info('Password reset isn’t wired up yet.')}
                    className="text-[color:var(--accent-bright)] hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit" disabled={submitting}
                  className="font-[family-name:var(--font-barlow-semi)] w-full py-3.5 rounded-[10px] text-base font-bold uppercase tracking-wide bg-[color:var(--accent)] text-[#1a0e02] shadow-[0_10px_26px_-10px_rgba(255,138,30,0.8)] hover:bg-[color:var(--accent-bright)] transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Signing in…' : 'Sign In'}
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <div>
                  <label htmlFor="signup-role" className="font-[family-name:var(--font-barlow-semi)] text-[11px] font-bold uppercase tracking-[0.14em] text-white/60">
                    I am a&hellip;
                  </label>
                  <select
                    id="signup-role"
                    value={role ?? 'player'}
                    onChange={(e) => handleRoleSelect(e.target.value as Role)}
                    className="mt-1.5 w-full px-3.5 py-3 rounded-[9px] bg-white/[0.06] border border-white/[0.14] text-sm text-white focus:outline-none focus:border-[color:var(--accent)] focus:bg-white/[0.09] transition-colors appearance-none"
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value} className="bg-[#1a1a1a] text-white">
                        {r.label} — {r.blurb}
                      </option>
                    ))}
                  </select>
                </div>
                {roleUnavailable && (
                  <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.08]">
                    <p className="text-xs font-bold text-amber-400">Not yet available</p>
                    <p className="text-[11px] text-white/60 mt-1">
                      {role === 'scout' && 'Scout sign-up is built but not yet turned on — check back soon.'}
                      {role === 'association' && 'Association accounts aren’t self-serve. AthlasX Ops sets these up directly after your data-sharing agreement is verified — reach out to get started.'}
                      {role === 'academy' && 'Academy sign-up isn’t available yet. If your academy’s data is already tracked through a district or state association, it will show up automatically.'}
                    </p>
                  </div>
                )}
                {roleAvailable && (
                  <form onSubmit={handleRoleSignUp} className="space-y-3 pt-1">
                    <input
                      type="email" required value={email} placeholder="Email address"
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3.5 py-3 rounded-[9px] bg-white/[0.06] border border-white/[0.14] text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-[color:var(--accent)] focus:bg-white/[0.09] transition-colors"
                    />
                    <div className="space-y-1">
                      <input
                        type="password" required minLength={10} value={password} placeholder="Choose a password" autoComplete="new-password"
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-3.5 py-3 rounded-[9px] bg-white/[0.06] border border-white/[0.14] text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-[color:var(--accent)] focus:bg-white/[0.09] transition-colors"
                      />
                      <p className="text-[11px] text-white/40">At least 10 characters, with letters and numbers.</p>
                    </div>
                    {error && <p role="status" className="text-xs text-[#ff8a7e]">{error}</p>}
                    <button
                      type="submit" disabled={submitting}
                      className="font-[family-name:var(--font-barlow-semi)] w-full py-3.5 rounded-[10px] text-base font-bold uppercase tracking-wide bg-[color:var(--accent)] text-[#1a0e02] shadow-[0_10px_26px_-10px_rgba(255,138,30,0.8)] hover:bg-[color:var(--accent-bright)] transition-colors disabled:opacity-50"
                    >
                      {submitting ? 'Creating account…' : 'Continue'}
                    </button>
                  </form>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 my-5 text-[11px] font-[family-name:var(--font-barlow-semi)] uppercase tracking-[0.14em] text-white/40">
              <span className="flex-1 h-px bg-white/[0.14]" />
              or
              <span className="flex-1 h-px bg-white/[0.14]" />
            </div>
            <button
              type="button"
              onClick={() => toast.info('Google sign-in isn’t connected yet.')}
              className="w-full py-3 rounded-[10px] text-sm font-bold text-white border-[1.5px] border-white/[0.14] hover:border-white/30 transition-colors"
            >
              {mode === 'signup' ? 'Sign up with Google' : 'Continue with Google'}
            </button>

            <p className="text-center text-sm text-white/60 mt-5">
              {mode === 'signup' ? 'Already on AthlasX?' : 'New to AthlasX?'}{' '}
              <button type="button" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')} className="text-[color:var(--accent-bright)] font-bold hover:underline">
                {mode === 'signup' ? 'Sign in instead' : 'Create an account'}
              </button>
            </p>
            <p className="text-center text-xs text-white/40 mt-4">
              By continuing you agree to our <a href="#" className="text-[color:var(--accent-bright)] hover:underline">Terms</a> &amp; <a href="#" className="text-[color:var(--accent-bright)] hover:underline">Privacy Policy</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
