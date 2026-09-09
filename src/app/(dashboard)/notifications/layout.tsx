import { requirePageSession } from '@/lib/require-page-session'

// Fetches /api/my-record and /api/trial-cycles, both requireAuth-only,
// each scoped to the caller's own identity server-side — any
// authenticated session, not a specific role.
export default async function NotificationsLayout({ children }: { children: React.ReactNode }) {
  await requirePageSession()
  return <>{children}</>
}
