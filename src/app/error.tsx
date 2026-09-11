'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'
import { AlertTriangle, RotateCw } from 'lucide-react'

/*
 * Root error boundary (Next.js App Router convention — catches anything
 * an unexpected exception throws past a page's own manual error handling,
 * not a replacement for it). Every dashboard page already handles its own
 * known failure paths (a 403, a failed fetch) with useState; this is the
 * safety net underneath that for the unknown case — a real bug, a null
 * pointer on an unexpected API shape — that would otherwise show Next's
 * raw dev overlay or a blank screen in production.
 *
 * Must be a client component (Next.js requirement for error.tsx) and
 * cannot assume the dashboard chrome (sidebar/topbar) is mounted — an
 * error here can occur before a layout even resolves, so this renders as
 * a standalone full-screen state, same visual family as the pending
 * holding screens (association/pending, scout/pending).
 */
export default function GlobalError({
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
    <div className="min-h-screen flex items-center justify-center bg-ax-bg font-barlow text-ax-text p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-ax-bad/10 border border-ax-bad/40 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6 text-ax-bad" />
        </div>
        <h1 className="font-anton uppercase text-2xl text-ax-text">Something went wrong</h1>
        <p className="text-sm text-ax-textDim leading-relaxed">
          An unexpected error occurred. This has been reported automatically — try again, or head back to your
          dashboard if it keeps happening.
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
            Back to AthlasX
          </Link>
        </div>
        {process.env.NODE_ENV !== 'production' && (
          <p className="text-[10px] text-ax-textFaint/70 font-mono pt-2 break-all">{error.message}</p>
        )}
      </div>
    </div>
  )
}
