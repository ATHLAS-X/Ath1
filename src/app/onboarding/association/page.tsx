import Link from 'next/link'
import { Anton, Barlow, Barlow_Semi_Condensed } from 'next/font/google'
import { ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

/*
 * Self-serve association onboarding was removed (2026-09-06) — see
 * docs/AthlasX_Pivot_Compliance_Audit_and_Role_Prompts.md's Prompt A-1. It
 * let anyone self-attest a "data-sharing consent" checkbox and immediately
 * receive a real AssociationStaff row with the same privileges
 * src/lib/association-scope.ts's real authorization chokepoints trust,
 * inverting the pivot document's W1 workflow (AthlasX Ops verifies a
 * signed data-sharing agreement before an association gets any access).
 *
 * Decision made: remove public self-serve entirely (path a). Association +
 * first-staff creation now happens through an internal AthlasX-Ops-only
 * tool at /ops/associations/new (POST /api/associations/onboard, now
 * requireRole(["athlasx_ops"])) after a real, offline-verified agreement.
 *
 * This is a static notice, not a wizard — there's no step to show, so it
 * uses the same rail-shell family (brandmark, eyebrow, Anton headline) as
 * the player/coach/academy onboarding wizards for visual consistency
 * across the onboarding surface, just without a stepper.
 */

const anton = Anton({ subsets: ['latin'], weight: '400', variable: '--font-anton' })
const barlow = Barlow({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-barlow' })
const barlowSemi = Barlow_Semi_Condensed({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-barlow-semi' })

const OB_VARS = {
  '--bg': '#0D0D0D',
  '--bg-soft': '#141312',
  '--accent': '#FF8A1E',
  '--accent-bright': '#FFA64D',
  '--ov08': 'rgba(255, 138, 30, 0.08)',
  '--ov14': 'rgba(255, 138, 30, 0.14)',
  '--card-border': 'rgba(245, 245, 240, 0.14)',
} as React.CSSProperties

export default function AssociationOnboardingRemovedPage() {
  return (
    <div className={cn(anton.variable, barlow.variable, barlowSemi.variable)} style={OB_VARS}>
      <div className="min-h-screen grid lg:grid-cols-[1fr_2fr] bg-[color:var(--bg)] font-[family-name:var(--font-barlow)] text-white">
        {/* ── LEFT RAIL ── */}
        <aside className="relative overflow-hidden hidden lg:flex flex-col p-8 lg:p-[2.618rem] bg-[color:var(--bg-soft)]">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(120% 80% at 0% 0%, var(--ov14), transparent 55%), radial-gradient(110% 70% at 0% 100%, var(--ov08), transparent 55%), linear-gradient(180deg, rgba(16,26,20,0.5) 0%, rgba(26,14,10,0.55) 100%)',
            }}
          />
          <div className="relative z-10">
            <Link href="/" className="font-[family-name:var(--font-barlow-semi)] uppercase tracking-[0.22em] font-bold text-[0.95rem] text-white">
              ATHLAS<span className="text-[color:var(--accent)]">X</span>
            </Link>
            <div className="mt-6">
              <p className="font-[family-name:var(--font-barlow-semi)] uppercase tracking-[0.2em] text-[11px] font-bold text-[color:var(--accent-bright)] mb-1.5">Association Onboarding</p>
              <h1 className="font-[family-name:var(--font-anton)] uppercase font-normal leading-[0.92] text-[42px] text-white">
                Set up your <b className="text-[color:var(--accent)] font-normal">association.</b>
              </h1>
              <p className="mt-3.5 text-sm leading-relaxed text-white/60 max-w-[22rem]">Association access starts with AthlasX Ops, not a sign-up form — every association&apos;s record has to be trustworthy for everyone downstream.</p>
            </div>
          </div>
        </aside>

        {/* ── RIGHT: NOTICE ── */}
        <div className="relative flex items-center justify-center p-6 lg:p-10 min-w-0">
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(110% 50% at 100% 0%, var(--ov08), transparent 55%)' }} />
          <div className="relative z-10 max-w-md w-full text-center space-y-3">
            <ShieldAlert className="w-8 h-8 text-white/40 mx-auto" />
            <h2 className="font-[family-name:var(--font-anton)] uppercase font-normal text-2xl text-white">Sign-up isn&apos;t self-serve</h2>
            <p className="text-sm text-white/50 leading-relaxed">
              AthlasX Ops sets up a new association directly after your data-sharing agreement is verified — this keeps every association&apos;s
              record trustworthy for everyone downstream. Reach out to AthlasX to get your association set up.
            </p>
            <Link href="/" className="inline-block mt-2 text-sm font-bold text-[color:var(--accent-bright)] hover:text-[color:var(--accent)]">Back to AthlasX</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
