'use client'

import { usePathname } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

/**
 * Wraps dashboard route content so navigating between pages cross-fades
 * instead of snapping. Keyed on pathname so AnimatePresence treats each
 * route as a distinct scene; respects prefers-reduced-motion by collapsing
 * to an instant swap.
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const reduceMotion = useReducedMotion()

  return (
    <div className="relative">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={pathname}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
          transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.4, 0, 0.2, 1] }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
