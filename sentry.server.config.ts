import * as Sentry from '@sentry/nextjs'

// Server-side Sentry init, loaded from instrumentation.ts's register()
// hook (Next.js's own server-instrumentation entry point). No tunnel here
// — the tunnel option only matters for the browser SDK routing around a
// page's CSP; server-side requests aren't subject to CSP at all.
Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
})
