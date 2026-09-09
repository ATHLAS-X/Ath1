import { requirePageSession } from '@/lib/require-page-session'

// Every /api/academy-matching* route currently only calls requireAuth
// (no role restriction) — mirrored here as-is. Tightening the API routes'
// own role check to something like ['association','athlasx_ops'] would be
// a separate, deliberate change, not something to do silently while
// closing the page-shell gating gap.
export default async function AcademyMatchingLayout({ children }: { children: React.ReactNode }) {
  await requirePageSession()
  return <>{children}</>
}
