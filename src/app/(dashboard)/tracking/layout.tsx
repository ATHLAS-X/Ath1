import { requirePageSession } from '@/lib/require-page-session'

// /api/tracking only requires requireAuth (no role restriction) —
// mirrored here as-is.
export default async function TrackingLayout({ children }: { children: React.ReactNode }) {
  await requirePageSession()
  return <>{children}</>
}
