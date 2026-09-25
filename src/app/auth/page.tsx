'use client'

import { useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import Image from 'next/image'
import { Anton, Barlow, Barlow_Semi_Condensed } from 'next/font/google'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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
  { src: '/images/hero/attached-f1-redbull-night.jpg', alt: 'Formula 1 driver in Red Bull racing suit celebrating under floodlights and fireworks', className: 'row-span-2' },
  { src: '/images/hero/attached-badminton-smash.webp', alt: 'Badminton player leaping mid-air for an overhead smash' },
  { src: '/images/hero/attached-cricket-virat-bw.png', alt: 'Black-and-white photo of a cricketer in national kit raising his bat', className: 'row-span-2' },
  { src: '/images/hero/attached-basketball-poster.jpg', alt: 'Basketball players contesting a shot at the rim in a packed arena' },
]

function AuthPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Landing page's "Signup" link passes ?mode=signup so this page opens
  // straight on the Sign Up tab instead of always defaulting to Sign In
  // regardless of which account-bar link was actually clicked.
  const [mode, setMode] = useState<Mode>(searchParams.get('mode') === 'signup' ? 'signup' : 'signin')
  const [role, setRole] = useState<Role | null>('player')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSubmitted, setForgotSubmitted] = useState(false)
  const [forgotError, setForgotError] = useState<string | null>(null)

  async function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault()
    setForgotError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      })
      const data = await res.json().catch(() => ({}))
      // A 200 is the only "sent" signal, and the API makes it look identical
      // whether or not the account exists. Every other status it returns — a
      // bad origin (403), a malformed request (400), reset being unavailable in
      // this environment (503) — is independent of the email entered, so
      // showing it leaks nothing and stops this form claiming a link was sent
      // when the request never got that far.
      if (!res.ok) {
        setForgotError(data?.error ?? 'Something went wrong. Please try again.')
        return
      }
      setForgotSubmitted(true)
    } catch {
      setForgotError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Synchronous lock, not just the `submitting` state — setSubmitting(true)
  // doesn't disable the button until React actually re-renders, so two
  // clicks issued back-to-back in the same tick could both fire
  // handleSignIn before that render happens. Same useRef<Set> pattern
  // already used in src/app/player/onboarding/page.tsx for exactly this.
  const locksRef = useRef<Set<string>>(new Set())

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    if (locksRef.current.has('signin')) return
    locksRef.current.add('signin')
    setSubmitting(true)
    setError(null)
    try {
      const result = await signIn('credentials', { email, password, redirect: false })
      if (result?.error) {
        setError('Incorrect email or password.')
        setSubmitting(false)
        return
      }
      // Left `submitting` true through the redirect on success, same as
      // handleRoleSignUp below — avoids a flash of the re-enabled button
      // right before navigation away from this page.
      router.push('/')
    } finally {
      locksRef.current.delete('signin')
    }
  }

  const ROLE_WIZARD_PATH: Record<'player' | 'coach' | 'academy' | 'scout' | 'association', string> = {
    player: '/player/onboarding',
    coach: '/coach/onboarding',
    academy: '/academy/onboarding',
    scout: '/scout/onboarding',
    association: '/onboarding/association',
  }

  // All five roles now route straight to their own onboarding wizard with
  // no pre-check and no bare-account pre-creation at this picker level —
  // player and coach used to POST /api/auth/signup here first, but their
  // wizards' own /api/player/onboard and /api/coach/onboard routes already
  // create the account themselves (email+password+profile in one
  // transaction), so the pre-creation only ever produced a duplicate-email
  // 409 once the wizard tried to create the same account again. Each
  // destination page still independently checks its own feature flag
  // (ASSOCIATION_SELF_SERVE_ENABLED / ACADEMY_SELF_SERVE_ENABLED /
  // SCOUT_SELF_SERVE_ENABLED) and shows its own not-available state if
  // still off — this page never pre-empts that.
  function handleRoleSelect(next: Role) {
    setRole(next)
    setError(null)
    router.push(ROLE_WIZARD_PATH[next])
  }

  // handleRoleSelect only fires when the <select> actually changes value —
  // 'player' is the default, so a visitor happy with that default never
  // triggers it. This button is the explicit affordance for that case (and
  // for re-confirming any other already-selected role); it's the only way
  // off this screen when the dropdown is left untouched.
  function handleContinue() {
    if (role) router.push(ROLE_WIZARD_PATH[role])
  }

  const roleUnavailable = false

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
            <h1 className="font-[family-name:var(--font-anton)] uppercase font-normal text-4xl sm:text-5xl text-white mb-1.5 text-balance">
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

            {mode === 'signin' && forgotOpen ? (
              forgotSubmitted ? (
                <div className="space-y-3">
                  <p role="status" className="text-sm text-white/80">
                    If an account exists for that email, a password reset link has been sent.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setForgotOpen(false); setForgotSubmitted(false); setForgotEmail('') }}
                    className="text-[color:var(--accent-bright)] hover:underline text-sm"
                  >
                    Back to sign in
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} className="space-y-3">
                  <p className="text-sm text-white/60">
                    Enter your account email — we&apos;ll send a reset link if it matches an account.
                  </p>
                  <input
                    type="email" required value={forgotEmail} placeholder="Email address"
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full px-3.5 py-3 rounded-[9px] bg-white/[0.06] border border-white/[0.14] text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-[color:var(--accent)] focus:bg-white/[0.09] transition-colors"
                  />
                  {forgotError && <p role="status" className="text-xs text-[#ff8a7e]">{forgotError}</p>}
                  <button
                    type="submit" disabled={submitting}
                    className="font-[family-name:var(--font-barlow-semi)] w-full py-3.5 rounded-[10px] text-base font-bold uppercase tracking-wide bg-[color:var(--accent)] text-[#1a0e02] shadow-[0_10px_26px_-10px_rgba(255,138,30,0.8)] hover:bg-[color:var(--accent-bright)] transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'Sending…' : 'Send reset link'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setForgotOpen(false)}
                    className="text-white/60 hover:text-white text-sm"
                  >
                    Back to sign in
                  </button>
                </form>
              )
            ) : mode === 'signin' ? (
              <form onSubmit={handleSignIn} className="space-y-3">
                <Input
                  type="email" required value={email} placeholder="Email address"
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-auto px-3.5 py-3 rounded-[9px] bg-white/[0.06] border-white/[0.14] focus:border-[color:var(--accent)] focus:bg-white/[0.09] placeholder:text-white/40"
                />
                <Input
                  type="password" required value={password} placeholder="Password"
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-auto px-3.5 py-3 rounded-[9px] bg-white/[0.06] border-white/[0.14] focus:border-[color:var(--accent)] focus:bg-white/[0.09] placeholder:text-white/40"
                />
                {error && <p role="status" className="text-xs text-[#ff8a7e]">{error}</p>}

                <div className="flex items-center justify-between text-sm text-white/60 pt-1 pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-[15px] h-[15px] accent-[color:var(--accent)]" />
                    Remember me
                  </label>
                  <button
                    type="button"
                    onClick={() => setForgotOpen(true)}
                    className="text-[color:var(--accent-bright)] hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>

                <Button
                  type="submit" disabled={submitting} variant="primary"
                  className="h-auto w-full py-3.5 rounded-[10px] text-base bg-[color:var(--accent)] border-[color:var(--accent)] shadow-[0_10px_26px_-10px_rgba(255,138,30,0.8)] hover:bg-[color:var(--accent-bright)] hover:border-[color:var(--accent-bright)]"
                >
                  {submitting ? 'Signing in…' : 'Sign In'}
                </Button>
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
                <p className="text-xs text-white/40">
                  Choosing a different role above takes you straight there. Happy with &ldquo;{ROLES.find((r) => r.value === (role ?? 'player'))?.label}&rdquo;? Continue below — it collects your email and password there.
                </p>
                <button
                  type="button"
                  onClick={handleContinue}
                  className="font-[family-name:var(--font-barlow-semi)] w-full py-3.5 rounded-[10px] text-base font-bold uppercase tracking-wide bg-[color:var(--accent)] text-[#1a0e02] shadow-[0_10px_26px_-10px_rgba(255,138,30,0.8)] hover:bg-[color:var(--accent-bright)] transition-colors"
                >
                  Continue
                </button>
              </div>
            )}

            <div className="flex items-center gap-3 my-5 text-[11px] font-[family-name:var(--font-barlow-semi)] uppercase tracking-[0.14em] text-white/40">
              <span className="flex-1 h-px bg-white/[0.14]" />
              or
              <span className="flex-1 h-px bg-white/[0.14]" />
            </div>
            <Button
              type="button" variant="outline"
              onClick={() => toast.info('Google sign-in isn’t connected yet.')}
              className="h-auto w-full py-3 rounded-[10px] text-sm bg-transparent border-[1.5px] border-white/[0.14] text-white hover:border-white/30 hover:bg-transparent normal-case font-bold"
            >
              {mode === 'signup' ? 'Sign up with Google' : 'Continue with Google'}
            </Button>

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

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthPageInner />
    </Suspense>
  )
}
