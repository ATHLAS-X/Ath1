import * as React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Shared onboarding-rail component — numbered circle per step (orange ring
 * + fill on the current step, checkmark + muted-orange fill on completed
 * steps), a connecting vertical line, an optional sublabel per step, and
 * an "All progress saved automatically" footer row with a status dot.
 * Matches design/import/AthlasX Onboarding.html's .stepper/.step/.foot
 * treatment (numbers, not a literal connecting-line element in that
 * mockup's own markup — added here since every onboarding page in this
 * codebase that's already been restyled this way (player/coach/
 * association) already draws one).
 *
 * Step count is caller-supplied, not hardcoded — the four onboarding
 * flows in this codebase have different lengths (player 3, coach 4,
 * association 4, academy 5).
 */

export interface StepRailItem {
  key: string
  label: string
  sublabel?: string
}

export interface StepRailProps {
  steps: StepRailItem[]
  /** 0-indexed. */
  currentIndex: number
  /** 0-indexed step indices considered done (independent of currentIndex,
   *  so a step can be marked done even if the user has stepped back to it). */
  completedIndices?: number[]
  saveLabel?: string
  className?: string
}

export function StepRail({ steps, currentIndex, completedIndices, saveLabel = 'All progress saved automatically', className }: StepRailProps) {
  const completed = new Set(completedIndices ?? steps.map((_, i) => i).filter((i) => i < currentIndex))

  return (
    <nav aria-label="Onboarding steps" className={cn('flex flex-col gap-0.5', className)}>
      {steps.map((step, i) => {
        const isDone = completed.has(i)
        const isCurrent = i === currentIndex
        const isLast = i === steps.length - 1

        return (
          <div key={step.key} className="relative flex items-start gap-3.5 px-1 py-2">
            {!isLast && (
              <span
                aria-hidden
                className="absolute left-[13.5px] top-[34px] w-px h-[calc(100%-10px)]"
                style={{ background: 'var(--ax-card-border)' }}
              />
            )}
            <span
              className={cn(
                'relative z-10 flex-none w-[27px] h-[27px] rounded-full grid place-items-center font-barlow-semi text-[0.78rem] font-bold border-[1.5px] transition-[background-color,border-color,box-shadow]',
                isCurrent
                  ? 'border-ax-accent bg-ax-accent text-[#1a0e02] shadow-[0_0_0_4px_rgba(255,138,30,0.22)]'
                  : isDone
                  ? 'border-ax-accent bg-[rgba(255,138,30,0.14)] text-ax-accentBright'
                  : 'border-ax-cardBorder bg-transparent text-ax-textDim'
              )}
            >
              {isDone && !isCurrent ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </span>
            <span className={cn('font-barlow text-[0.9rem] font-semibold leading-tight pt-0.5', isCurrent || isDone ? 'text-ax-text' : 'text-ax-textDim')}>
              {step.label}
              {step.sublabel && <small className="block text-[0.7rem] font-medium text-ax-textFaint mt-0.5">{step.sublabel}</small>}
            </span>
          </div>
        )
      })}

      <div className="flex items-center gap-2 mt-6 pt-4 text-[0.76rem] text-ax-textFaint">
        <span
          className="w-[7px] h-[7px] rounded-full"
          style={{ background: 'var(--ax-ok)', boxShadow: '0 0 8px var(--ax-ok)' }}
        />
        {saveLabel}
      </div>
    </nav>
  )
}
