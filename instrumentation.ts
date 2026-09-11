// Next.js's own instrumentation entry point (requires
// experimental.instrumentationHook: true in next.config.mjs on Next
// 14.x — stable without the flag from Next 15 on). register() runs once
// per server/edge runtime instance at boot, before any request is
// handled.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

// Reports an error that occurred while rendering (App Router's
// server-component/route-handler error path) — this is a *different*
// signal from src/app/error.tsx's client-side Sentry.captureException:
// error.tsx only catches errors that make it to the client render tree,
// this hook catches the ones the server itself failed to render at all.
export const onRequestError = async (
  ...args: Parameters<Awaited<typeof import('@sentry/nextjs')>['captureRequestError']>
) => {
  const Sentry = await import('@sentry/nextjs')
  Sentry.captureRequestError(...args)
}
