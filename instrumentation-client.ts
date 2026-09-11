import * as Sentry from '@sentry/nextjs'

/**
 * Client-side Sentry init — this exact filename (project root, not under
 * src/app) is the current @sentry/nextjs v10 convention, replacing the
 * older sentry.client.config.ts pattern (confirmed by the installed
 * package's own runtime warning in build/cjs/client/index.js, which
 * explicitly recommends this file over the legacy one).
 *
 * No-ops safely with an empty DSN (dev/CI without Sentry configured) —
 * the SDK just doesn't report anywhere, it doesn't throw. Real reporting
 * activates the moment NEXT_PUBLIC_SENTRY_DSN is set in the environment.
 *
 * tunnel matches next.config.mjs's tunnelRoute: '/monitoring' — client
 * error reports go through a same-origin Next.js route instead of
 * directly to Sentry's ingest domain, so this app's existing
 * connect-src 'self' CSP directive (next.config.mjs) doesn't need a
 * third-party exception carved into it just for error reporting.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tunnel: '/monitoring',
  tracesSampleRate: 0.1,
  // Session replay is a separate, higher-cost Sentry product — not
  // enabled here; this is error visibility only, matching the actual ask.
})

// Required export for App Router navigation instrumentation — the SDK
// itself flags this as "ACTION REQUIRED" at build time without it.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
