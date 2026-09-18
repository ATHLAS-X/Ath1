'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'
import { AlertTriangle, RotateCw } from 'lucide-react'

/*
 * Error boundary for every dashboard route. It renders inside
 * (dashboard)/layout.tsx, so when a page crashes the sidebar and top bar stay
 * mounted and only the main pane shows this — the user keeps their navigation,
 * and "Try again" re-renders just the page that failed instead of the whole
 * app. The root src/app/error.tsx still catches anything thrown outside this
 * route group (and anything thrown by the dashboard layout itself).
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex items-center justify-center py-20 font-barlow text-ax-text">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-ax-bad/10 border border-ax-bad/40 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6 text-ax-bad" />
        </div>
        <h2 className="font-anton uppercase text-2xl text-ax-text">This page hit a problem</h2>
        <p className="text-sm text-ax-textDim leading-relaxed">
          Something went wrong loading this page. It has been reported automatically — try again, or pick another
          page from the sidebar.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 font-barlow-semi text-[12.5px] font-bold uppercase tracking-[0.06em] bg-ax-accent text-[#1a0e02] px-[18px] py-[11px] rounded-ax-md hover:bg-ax-accentBright transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5" /> Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center font-barlow-semi text-[12.5px] font-bold uppercase tracking-[0.06em] text-ax-textDim border border-ax-cardBorder px-[18px] py-[11px] rounded-ax-md hover:text-ax-text hover:border-white/30 transition-colors"
          >
            Back to my dashboard
          </Link>
        </div>
        {process.env.NODE_ENV !== 'production' && (
          <p className="text-[10px] text-ax-textFaint/70 font-mono pt-2 break-all">{error.message}</p>
        )}
      </div>
    </div>
  )
}
