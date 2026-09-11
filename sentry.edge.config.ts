import * as Sentry from '@sentry/nextjs'

// Edge-runtime Sentry init. This app has no route explicitly configured
// for the edge runtime today (grepped for `export const runtime = 'edge'`
// — no matches; no middleware.ts exists either), so this file is
// currently unused in practice. It stays wired up so error tracking
// doesn't silently go missing the moment a future route opts into edge.
Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
})
