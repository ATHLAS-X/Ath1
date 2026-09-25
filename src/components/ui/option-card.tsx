import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Shared "option card" button — the bordered, selectable card pattern used
 * for single/multi-select pickers (playing role, batting/bowling style,
 * preferred formats, academy/org type, etc.). Extracted from OPTCARD_CLS,
 * which was independently copy-pasted into player/coach/academy/scout
 * onboarding and onboarding/association's page.tsx files — each carrying
 * the same `transition-all` (animates every property on every click,
 * across dozens of option cards) instead of a scoped transition.
 *
 * Only player/onboarding/page.tsx is migrated onto this component so far;
 * the other 4 onboarding wizards still use their own local OPTCARD_CLS
 * copy — see docs/UI_CONSOLIDATION_BACKLOG.md.
 */
export interface OptionCardProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active: boolean
}

export const OptionCard = React.forwardRef<HTMLButtonElement, OptionCardProps>(
  ({ active, className, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'border-[1.5px] rounded-[11px] transition-[background-color,border-color,box-shadow] active:scale-[0.96]',
        active
          ? 'bg-[rgba(255,138,30,0.14)] border-ax-accent text-ax-accentBright'
          : 'bg-ax-fieldBg border-ax-cardBorder text-white/70 hover:border-white/30',
        className
      )}
      {...props}
    />
  )
)
OptionCard.displayName = 'OptionCard'
