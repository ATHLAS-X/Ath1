/**
 * Shared test helper for simulating a real authenticated session against a
 * route handler called directly (not through Next's server). Uses
 * next-auth/jwt#encode with the same NEXTAUTH_SECRET
 * src/lib/require-auth.ts#getSessionUser verifies against, so a request
 * built with this helper exercises real session verification, not a
 * stub — a request with no session still 401s exactly as it would in
 * production.
 *
 * First built for tests/integration/consent-withdrawal.test.ts; factored
 * out here so tests/integration/grading-blind.test.ts (and any future
 * test needing a real session) reuses the same helper instead of a copy.
 */
import { NextRequest } from 'next/server'
import { encode } from 'next-auth/jwt'

const SECRET = process.env.NEXTAUTH_SECRET!

export async function sessionCookieFor(userId: string, role: string): Promise<string> {
  const jwt = await encode({
    token: { id: userId, role, email: `${userId}@test.local` },
    secret: SECRET,
  })
  return `next-auth.session-token=${jwt}`
}

export async function getAsUser(url: string, userId: string, role: string): Promise<NextRequest> {
  return new NextRequest(url, {
    headers: { cookie: await sessionCookieFor(userId, role) },
  })
}

export async function postAsUser(url: string, userId: string, role: string, body: unknown): Promise<NextRequest> {
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
      cookie: await sessionCookieFor(userId, role),
    },
  })
}
