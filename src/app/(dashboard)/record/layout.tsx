import { requirePageSession } from '@/lib/require-page-session'

// /api/my-record only requires requireAuth (any role) and scopes to the
// caller's own player profile server-side — this mirrors that: any
// authenticated session, not a specific role.
export default async function RecordLayout({ children }: { children: React.ReactNode }) {
  await requirePageSession()
  return <>{children}</>
}
