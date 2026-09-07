import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Orange-system card, replacing the ad-hoc .glass/.glass-card/.glass-dark
 * treatments (defined in globals.css, used across 18/19 pages per
 * docs/AthlasX_Design_Consistency_and_Page_Flow_Map.md §2.x) with the
 * card-bg/card-border values from design/import/AthlasX Onboarding.html's
 * :root. Existing .glass* classes are left untouched in globals.css —
 * nothing consumes this yet, per this pass's "tokens and components only"
 * scope.
 */
export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('bg-[color:var(--ax-card-bg)] border border-ax-cardBorder rounded-ax-xl backdrop-blur-xl', className)}
      {...props}
    />
  )
)
Card.displayName = 'Card'

export const GlassCard = Card
