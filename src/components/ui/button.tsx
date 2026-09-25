import * as React from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

// 'primary'/'secondary'/'outline' map to design/import/AthlasX
// Onboarding.html's .btn-fill/.btn-ghost/.btn-text — replaces the ad-hoc raw
// <button> styling duplicated across dashboard pages
// (docs/AthlasX_Design_Consistency_and_Page_Flow_Map.md §2.2). 'default' and
// 'ghost' used to exist solely for src/app/claim/page.tsx's then-unmigrated
// green buttons; that page now uses 'primary' like everywhere else, so both
// were removed rather than left as unused dead variants.
type Variant = 'outline' | 'primary' | 'secondary'
type Size = 'default' | 'sm' | 'lg' | 'icon'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const variantClasses: Record<Variant, string> = {
  outline: 'bg-transparent border border-white/10 text-zinc-200 hover:bg-white/[0.05]',
  // .btn-fill
  primary:
    'font-barlow-semi uppercase tracking-wide bg-ax-accent text-[#1a0e02] border-[1.5px] border-ax-accent shadow-[0_8px_22px_-8px_rgba(255,138,30,0.7)] hover:bg-ax-accentBright hover:border-ax-accentBright',
  // .btn-ghost
  secondary:
    'font-barlow-semi uppercase tracking-wide bg-transparent text-ax-text border-[1.5px] border-ax-cardBorder hover:border-ax-text hover:bg-white/[0.06]',
}

const sizeClasses: Record<Size, string> = {
  default: 'h-10 px-4 text-sm',
  sm: 'h-9 px-3 text-xs',
  lg: 'h-12 px-6 text-base',
  icon: 'h-10 w-10',
}

function buttonClasses(variant: Variant, size: Size, className?: string) {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-xl transition-[color,background-color,border-color,scale] active:scale-[0.96] disabled:opacity-50 disabled:pointer-events-none',
    variantClasses[variant],
    sizeClasses[size],
    className
  )
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'default', ...props }, ref) => (
    <button ref={ref} className={buttonClasses(variant, size, className)} {...props} />
  )
)
Button.displayName = 'Button'

export interface ButtonLinkProps extends React.ComponentProps<typeof Link> {
  variant?: Variant
  size?: Size
}

/**
 * Same visual language as Button, for navigation actions that must stay a
 * real anchor (correct keyboard/middle-click/right-click behavior, no
 * onClick-navigation workaround) rather than a <button> — e.g. the
 * account-bar Sign In/Signup links. Previously these were hand-rolled
 * per-page instead of sharing Button's variant/size tokens.
 */
export const ButtonLink = React.forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  ({ className, variant = 'primary', size = 'default', ...props }, ref) => (
    <Link ref={ref} className={buttonClasses(variant, size, className)} {...props} />
  )
)
ButtonLink.displayName = 'ButtonLink'
