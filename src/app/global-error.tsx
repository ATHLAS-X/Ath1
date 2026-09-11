'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { AlertTriangle, RotateCw } from 'lucide-react'

/*
 * Catches an error in the ROOT LAYOUT itself (src/app/layout.tsx) — a
 * different, narrower failure than src/app/error.tsx: a crash here means
 * layout.tsx never rendered, so this file must supply its own <html>/
 * <body> rather than relying on the layout that just failed. Flagged as a
 * real gap by @sentry/nextjs's own build-time warning ("no global error
 * handler set up... React rendering errors [would] not [be] reported"),
 * not something invented here — Next.js's App Router convention requires
 * a separate file for this specific case, error.tsx alone doesn't cover
 * it.
 *
 * No ax.* Tailwind utilities here deliberately — if the root layout
 * itself is what crashed, the app's own CSS pipeline may not have
 * initialized either; inline styles keep this screen renderable
 * regardless of what broke.
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
    <html lang="en">
      <body style={{ margin: 0, background: '#0D0D0D', color: '#F5F5F0', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
            <div
              style={{
                width: 56, height: 56, borderRadius: '9999px', margin: '0 auto 16px',
                background: 'rgba(255,90,77,0.1)', border: '1px solid rgba(255,90,77,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <AlertTriangle size={24} color="#FF5A4D" />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, textTransform: 'uppercase', margin: '0 0 12px' }}>Something went wrong</h1>
            <p style={{ fontSize: 14, color: 'rgba(245,245,240,0.62)', lineHeight: 1.5, margin: '0 0 20px' }}>
              An unexpected error occurred while loading AthlasX. This has been reported automatically — try again.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '12.5px', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.06em', background: '#FF8A1E', color: '#1a0e02',
                padding: '11px 18px', borderRadius: 9, border: 'none', cursor: 'pointer',
              }}
            >
              <RotateCw size={14} /> Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
