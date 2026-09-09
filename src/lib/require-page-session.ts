import { getServerSession } from 'next-auth'
import { notFound } from 'next/navigation'
import { authOptions } from '@/lib/auth'

/**
 * Server-component-side page gate — same posture as the existing
 * src/app/(dashboard)/academy/layout.tsx and .../association/layout.tsx:
 * notFound() rather than a redirect, so an unauthorized visitor sees the
 * exact same "this doesn't exist" response as a gated API route, not a
 * page shell that renders and then fails its own data fetches.
 *
 * requirePageSession() is for pages whose backing API route only calls
 * requireAuth (any authenticated role) and scopes data to the caller's
 * own identity server-side — the page itself has no role restriction to
 * mirror, only "must be logged in."
 */
export async function requirePageSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user) notFound()
  return session
}

/** For pages whose backing API route calls requireRole([...]) — mirrors
 *  that same allowlist at the page-shell level. */
export async function requirePageRole(roles: string[]) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.role || !roles.includes(session.user.role)) notFound()
  return session
}
