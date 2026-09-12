import type { NextRequest } from "next/server";

/**
 * Same-origin check for hand-rolled, state-changing API routes that mint a
 * session cookie outside NextAuth's own /api/auth/[...nextauth] handler
 * (which already gets NextAuth's built-in CSRF protection). Those routes
 * rely only on `sameSite: lax` today — real but incomplete, since a
 * same-site top-level GET-triggered navigation still sends the cookie, and
 * some browsers/extensions relax SameSite in ways this app can't control.
 *
 * A full CSRF-token scheme would need a token-issuing endpoint, a place to
 * store the expected token per session, and a client-side change to send it
 * — real infrastructure for a threat this route doesn't actually face: it
 * has no legitimate cross-origin caller, so a same-origin check gives
 * equivalent protection for its real usage with none of that.
 *
 * Compares the Origin/Referer's HOST against this same request's own Host
 * header (the standard OWASP "verify Origin" CSRF check) rather than
 * req.nextUrl.origin or an env var like NEXTAUTH_URL. Both alternatives
 * were tried and rejected: req.nextUrl.origin turned out to normalize to
 * Next's internal default hostname ("localhost") regardless of which
 * hostname the client actually connected through (e.g. 127.0.0.1),
 * producing false 403s for genuinely same-origin requests; NEXTAUTH_URL is
 * a fixed config value that can legitimately differ from the port/host a
 * given request actually arrived on (e.g. this app's own e2e suite runs a
 * production build on a different port than NEXTAUTH_URL points at).
 * Comparing a request's Origin against that SAME request's Host header has
 * neither problem — both reflect whatever the client actually used.
 */
export function isSameOriginRequest(req: NextRequest): boolean {
  const candidate = req.headers.get("origin") ?? req.headers.get("referer");
  // No Origin AND no Referer at all is not what a real same-origin
  // fetch() from this app's own pages ever produces — fetch() always sets
  // Origin on a state-changing request, same-origin or not. Treat an
  // absent header as suspicious and reject rather than assume same-origin.
  if (!candidate) return false;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) return false;
  try {
    return new URL(candidate).host === host;
  } catch {
    return false;
  }
}
