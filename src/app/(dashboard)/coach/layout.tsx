import { requirePageSession } from '@/lib/require-page-session'

// /api/coach/squad only requires requireAuth (any role) and scopes to the
// caller's own SquadCoach membership server-side — any authenticated
// session, not a specific role.
export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  await requirePageSession()
  return <>{children}</>
}
