/**
 * Forges a real, verifiable NextAuth session cookie for e2e use — same
 * technique as tests/helpers/auth.ts (used by vitest integration tests
 * calling route handlers directly), adapted to set an actual browser
 * cookie via BrowserContext.addCookies for Playwright.
 *
 * This exercises the app's real JWT verification path (src/lib/auth.ts's
 * session strategy is stateless JWT — no server-side session table), so a
 * request built with this helper is indistinguishable from a real sign-in
 * as far as getServerSession/requirePageRole are concerned. It does NOT
 * require a real seeded user per role — useful for L2 (redirect-by-role)
 * and L4 (forged/expired cookie) in landing.spec.ts, where the only thing
 * under test is the root page's session handling, not downstream
 * role-specific page content.
 */
import '../../helpers/load-env'
import { encode } from 'next-auth/jwt'
import type { BrowserContext } from '@playwright/test'

const SECRET = process.env.NEXTAUTH_SECRET!

/** Mirrors src/lib/auth.ts#applySessionCookie's own cookie-name logic. */
function cookieName(): string {
  const useSecureCookies = process.env.NEXTAUTH_URL?.startsWith('https://') ?? !!process.env.VERCEL
  return useSecureCookies ? '__Secure-next-auth.session-token' : 'next-auth.session-token'
}

export async function forgedSessionJwt(opts: {
  id?: string
  role?: string
  email?: string
  maxAge?: number // seconds; negative produces an already-expired token
} = {}): Promise<string> {
  const { id = 'e2e-forged-user', role = 'player', email = 'e2e-forged-user@test.local', maxAge } = opts
  return encode({
    token: { id, role, email },
    secret: SECRET,
    ...(maxAge !== undefined ? { maxAge } : {}),
  })
}

export async function setForgedSession(
  context: BrowserContext,
  baseURL: string,
  opts?: Parameters<typeof forgedSessionJwt>[0],
): Promise<void> {
  const jwt = await forgedSessionJwt(opts)
  const { hostname } = new URL(baseURL)
  const name = cookieName()
  await context.addCookies([
    {
      name,
      value: jwt,
      domain: hostname,
      path: '/',
      httpOnly: true,
      secure: name.startsWith('__Secure-'),
      sameSite: 'Lax',
    },
  ])
}

export { cookieName }
