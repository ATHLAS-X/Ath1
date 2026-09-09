import { requirePageSession } from '@/lib/require-page-session'

// This page reads only the client-side session (useSession) — no
// role-scoped API call to mirror. Any authenticated session.
export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
  await requirePageSession()
  return <>{children}</>
}
