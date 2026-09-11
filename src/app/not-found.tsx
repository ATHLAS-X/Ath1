import Link from 'next/link'
import { Compass } from 'lucide-react'

/*
 * Root not-found.tsx (Next.js App Router convention — renders for any
 * unmatched route, and wherever a segment calls notFound() with no closer
 * not-found.tsx of its own). Same visual family as error.tsx and the
 * pending holding screens — a standalone full-screen state, not the
 * dashboard chrome, since there's no route context to render it inside.
 * Server component (no interactivity needed), unlike error.tsx which
 * Next.js requires to be client-side.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ax-bg font-barlow text-ax-text p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-[rgba(255,138,30,0.14)] border border-ax-accent/40 flex items-center justify-center mx-auto">
          <Compass className="w-6 h-6 text-ax-accentBright" />
        </div>
        <h1 className="font-anton uppercase text-2xl text-ax-text">Page not found</h1>
        <p className="text-sm text-ax-textDim leading-relaxed">
          This page doesn&apos;t exist, or it may have moved. Double-check the link, or head back to AthlasX.
        </p>
        <Link
          href="/"
          className="inline-flex items-center font-barlow-semi text-[12.5px] font-bold uppercase tracking-[0.06em] bg-ax-accent text-[#1a0e02] px-[18px] py-[11px] rounded-ax-md hover:bg-ax-accentBright transition-colors mt-2"
        >
          Back to AthlasX
        </Link>
      </div>
    </div>
  )
}
