import { requirePageSession } from '@/lib/require-page-session'

// /api/player/visibility only requires requireAuth (any role) and reads/
// writes the caller's own row — any authenticated session, not a
// specific role.
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requirePageSession()
  return <>{children}</>
}
