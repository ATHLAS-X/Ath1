import { withSentryConfig } from "@sentry/nextjs/config";

/**
 * Content-Security-Policy — every source below was verified against what
 * this app actually loads, not copy-pasted as a default:
 *
 *   script-src 'self' 'unsafe-inline'
 *     No <Script> tags, no third-party script origins anywhere in app/ or
 *     components/ (checked). 'unsafe-inline' is still required because
 *     Next.js App Router's RSC streaming injects genuine inline <script>
 *     tags with no nonce (`self.__next_f.push(...)`) — confirmed by curling
 *     a rendered page and inspecting the HTML. Removing it breaks hydration
 *     on every route. A real fix needs nonce-based CSP wired through
 *     middleware.ts (a per-request nonce can't live in this static config),
 *     which is a separate piece of work from this header pass.
 *   style-src 'self' 'unsafe-inline'
 *     app/page.tsx renders a <style dangerouslySetInnerHTML>, and many
 *     components use inline style={{...}} props (verified via curl + grep)
 *     — both require 'unsafe-inline' for style-src; neither can be
 *     satisfied by a nonce (style attributes aren't nonce-able).
 *   img-src 'self' data: blob: https://img.youtube.com https://i.ytimg.com
 *     YouTube thumbnails are the only external images (matches
 *     images.remotePatterns below). `blob:` covers the local file preview
 *     in components/academy/forms.tsx and similar upload-preview UIs (URL.createObjectURL).
 *     All avatar/logo/scorecard images are server-uploaded to
 *     public/uploads/... and served same-origin — confirmed in lib/onboarding-server.ts.
 *   font-src 'self'
 *     next/font/google (Inter, Space Grotesk, Instrument Sans) self-hosts
 *     font files at build time — no runtime request to fonts.googleapis.com.
 *   connect-src 'self'
 *     Every client-side fetch() found in app/ and components/ targets a
 *     same-origin /api/... path. The one external fetch (Razorpay) is in
 *     app/api/admin/launch-checklist/route.ts — a server-side route, not
 *     subject to the browser's CSP at all.
 *   frame-src 'none', object-src 'none'
 *     No <iframe>/<object>/<embed> anywhere (checked) — YouTube videos, if
 *     ever embedded, would need https://www.youtube.com added here first.
 *   frame-ancestors 'none'
 *     Belt-and-suspenders with X-Frame-Options: DENY below.
 *
 *   DEV-MODE ONLY: 'unsafe-eval' is added to script-src below when
 *   NODE_ENV !== 'production'. Next.js's dev-mode Fast Refresh runtime
 *   (node_modules/next/dist/compiled/@next/react-refresh-utils) calls
 *   eval() internally for HMR — without 'unsafe-eval' the browser throws
 *   an EvalError the instant that runtime executes, which happens before
 *   React ever gets to hydrate. The effect isn't a CSP warning in some
 *   corner of the app — it's total: every page's client bundle throws on
 *   the same line, so NOTHING hydrates anywhere, every button on every
 *   page is dead, and it survives hard refreshes because the header is
 *   server-set on every single response. Confirmed by adding a plain
 *   <script> (independent of React, so it still runs even when hydration
 *   itself is what's broken) that caught the EvalError directly. Production
 *   builds don't run this runtime at all, so 'unsafe-eval' must never ship
 *   there — it would be a real, unforced security regression for zero gain.
 */
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://img.youtube.com https://i.ytimg.com",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: CSP },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Required on Next.js 14.x for instrumentation.ts's register() hook to
  // actually run (stable without this flag from Next 15 on) — Sentry's
  // server/edge init depends on it.
  experimental: {
    instrumentationHook: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
    ],
  },
  // Onboarding routes renamed for role-prefix consistency
  // (/onboarding -> /player/onboarding, /onboarding/coach ->
  // /coach/onboarding, /onboarding/academy -> /academy/onboarding).
  // /onboarding/association is unaffected — it's a static "not self-serve"
  // notice, not a wizard, and wasn't part of this rename. Permanent (308)
  // since these are old bookmarked/linked URLs being replaced for good,
  // not a temporary reroute.
  async redirects() {
    return [
      { source: "/onboarding", destination: "/player/onboarding", permanent: true },
      { source: "/onboarding/coach", destination: "/coach/onboarding", permanent: true },
      { source: "/onboarding/academy", destination: "/academy/onboarding", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
      /* Image-only upload subfolders (lib/upload-validation.ts's IMAGE_ALLOWLIST
         call sites — avatar, academy logo). Files here are guaranteed by
         readAndValidateUpload() to be real jpeg/png/webp (magic-byte checked,
         saved under a canonical detected-type extension, never the client's
         filename) — never SVG/HTML, so inline display can't execute a script
         in this origin. Other /uploads/* subfolders (coach-certs, fitness,
         guardian, matches) can contain PDFs and intentionally get no explicit
         Content-Disposition override here. */
      {
        source: "/uploads/:userId/avatar/:path*",
        headers: [{ key: "Content-Disposition", value: "inline" }],
      },
      {
        source: "/uploads/:userId/academy-assets/:path*",
        headers: [{ key: "Content-Disposition", value: "inline" }],
      },
    ];
  },
};

// Wraps the config to inject Sentry's build-time plugin (source-map
// upload, release tagging). Safe to leave enabled with no Sentry account
// configured yet: without SENTRY_AUTH_TOKEN the plugin logs a warning and
// skips the upload step rather than failing the build (confirmed against
// the installed @sentry/nextjs's own getBuildPluginOptions, which passes
// an unset authToken straight through to @sentry/webpack-plugin's own
// documented no-op-without-a-token behavior).
//
// tunnelRoute: client-side error reports are proxied through this app's
// own /monitoring path instead of going directly to Sentry's ingest
// domain — keeps the existing connect-src 'self' CSP directive above
// intact with no third-party exception needed.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  tunnelRoute: "/monitoring",
  webpack: {
    treeshake: { removeDebugLogging: true },
  },
});
