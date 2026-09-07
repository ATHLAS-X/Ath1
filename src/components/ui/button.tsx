import * as React from 'react'
import { cn } from '@/lib/utils'

// 'default'/'ghost' kept for the one existing caller (src/app/claim/page.tsx)
// so this pass doesn't touch that page.tsx while still registering the new
// design-system variants. 'primary'/'secondary'/'outline' map to
// design/import/AthlasX Onboarding.html's .btn-fill/.btn-ghost/.btn-text —
// replaces the ad-hoc raw <button> styling duplicated across dashboard
// pages (docs/AthlasX_Design_Consistency_and_Page_Flow_Map.md §2.2).
type Variant = 'default' | 'outline' | 'ghost' | 'primary' | 'secondary'
type Size = 'default' | 'sm' | 'lg' | 'icon'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const variantClasses: Record<Variant, string> = {
  default: 'bg-green-500 text-black font-semibold hover:bg-green-400',
  outline: 'bg-transparent border border-white/10 text-zinc-200 hover:bg-white/[0.05]',
  ghost: 'bg-transparent text-zinc-400 hover:bg-white/[0.05] hover:text-white',
  // .btn-fill
  primary:
    'font-barlow-semi uppercase tracking-wide bg-ax-accent text-[#1a0e02] border-[1.5px] border-ax-accent shadow-[0_8px_22px_-8px_rgba(255,138,30,0.7)] hover:bg-ax-accentBright hover:border-ax-accentBright',
  // .btn-ghost
  secondary:
    'font-barlow-semi uppercase tracking-wide bg-transparent text-ax-text border-[1.5px] border-ax-cardBorder hover:border-ax-text hover:bg-white/[0.06]',
}

const sizeClasses: Record<Size, string> = {
  default: 'h-10 px-4 text-sm',
  sm: 'h-8 px-3 text-xs',
  lg: 'h-12 px-6 text-base',
  icon: 'h-10 w-10',
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl transition-colors disabled:opacity-50 disabled:pointer-events-none',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    />
  )
)
Button.displayName = 'Button'
