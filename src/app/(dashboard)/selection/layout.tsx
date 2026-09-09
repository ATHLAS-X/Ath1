import { requirePageSession } from '@/lib/require-page-session'

// /api/candidate-pool only requires requireAuth (no role restriction) —
// mirrored here as-is.
export default async function SelectionLayout({ children }: { children: React.ReactNode }) {
  await requirePageSession()
  return <>{children}</>
}
