import { Anton, Barlow, Barlow_Semi_Condensed, JetBrains_Mono } from 'next/font/google'
import { cn } from '@/lib/utils'

/**
 * Shared visual system for the academy-admin surface — migrated onto the
 * site-wide orange/black Anton/Barlow system (tailwind.config.ts's `ax`
 * tokens, globals.css) rather than the separate navy/Inter "System B"
 * palette this surface launched with (design/import/AthlasX Academy Admin
 * Dashboard.html's own :root). That palette was a reasonable starting
 * point when this was the only page using it, but with player/coach/
 * academy onboarding and the association notice all now sharing one
 * system, keeping the admin surface on a second one just for KPI cards and
 * tables was the one remaining inconsistency. Variable NAMES are kept
 * stable (`--canvas`, `--panel`, `--line`, etc.) so the four page files
 * that already reference them via Tailwind arbitrary-value classes don't
 * need touching beyond their headings. JetBrains Mono is kept for
 * tabular/numeric displays (KPI values, timestamps) — a deliberate
 * addition to the shared system, not a leftover, since nothing in the
 * onboarding flows needed tabular figures.
 */
export const anton = Anton({ subsets: ['latin'], weight: '400', variable: '--font-anton' })
export const barlow = Barlow({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-barlow' })
export const barlowSemi = Barlow_Semi_Condensed({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-barlow-semi' })
export const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-mono-jb' })

export const ACADEMY_VARS = {
  '--canvas': '#0D0D0D',
  '--canvas-soft': '#141312',
  '--panel': '#141312',
  '--panel-2': '#1c1916',
  '--line': 'rgba(245, 245, 240, 0.14)',
  '--text': '#F5F5F0',
  '--text-dim': 'rgba(245, 245, 240, 0.62)',
  '--text-faint': 'rgba(245, 245, 240, 0.4)',
  '--accent': '#FF8A1E',
  '--accent-rgb': '255, 138, 30',
  '--accent-bright': '#FFA64D',
  '--bad': '#ff5a4d',
  '--bad-rgb': '255, 90, 77',
  '--ok': '#38d39f',
  '--blue': '#4C8DFF',
  '--purple': '#B57BFF',
  '--teal': '#2DD4BF',
  '--grey': '#5B6B7A',
  '--wa': '#25D366',
} as React.CSSProperties

export function AcademyShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(anton.variable, barlow.variable, barlowSemi.variable, jetbrainsMono.variable, 'font-[family-name:var(--font-barlow)] -m-6 min-h-[calc(100vh)]', className)}
      style={{ ...ACADEMY_VARS, background: 'var(--canvas)', color: 'var(--text)' }}
    >
      {children}
    </div>
  )
}

export const CARD_CLS = 'bg-[color:var(--panel)] border border-[color:var(--line)] rounded-[11px]'
export const CONTROL_CLS =
  'w-full px-3.5 py-2.5 font-[family-name:var(--font-barlow)] text-sm text-[color:var(--text)] bg-[color:var(--canvas)] border border-[color:var(--line)] rounded-[9px] outline-none placeholder:text-[color:var(--text-faint)] focus:border-[color:var(--accent)] focus:shadow-[0_0_0_3px_rgba(255,138,30,0.2)] transition-all'
export const LABEL_CLS = 'block font-[family-name:var(--font-barlow-semi)] text-[10.5px] font-bold uppercase tracking-[0.12em] text-[color:var(--text-dim)] mb-1.5'
export const BTN_AMBER_CLS =
  'px-4 py-2.5 rounded-[9px] border-[1.5px] border-[color:var(--accent)] bg-[color:var(--accent)] text-[#1a0e02] font-[family-name:var(--font-barlow-semi)] uppercase tracking-wide font-bold text-sm hover:bg-[color:var(--accent-bright)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
export const BTN_GHOST_CLS =
  'px-4 py-2.5 rounded-[9px] border-[1.5px] border-[color:var(--line)] bg-transparent text-[color:var(--text-dim)] font-[family-name:var(--font-barlow-semi)] uppercase tracking-wide font-bold text-sm hover:text-[color:var(--text)] hover:border-white/40 transition-colors'
export const EYEBROW_CLS = 'font-[family-name:var(--font-barlow-semi)] text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--text-faint)]'
export const H1_CLS = 'font-[family-name:var(--font-anton)] uppercase font-normal leading-[0.95] text-[2rem] text-[color:var(--text)] mt-1'
