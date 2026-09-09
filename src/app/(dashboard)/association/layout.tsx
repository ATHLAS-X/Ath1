import { getServerSession } from 'next-auth'
import { notFound } from 'next/navigation'
import { authOptions } from '@/lib/auth'

// Same pattern as src/app/(dashboard)/academy/layout.tsx — this page's own
// API calls are already role-gated (requireRole(['association',
// 'athlasx_ops']) on trial-cycles/mine, tracking, grading/*, squads/*,
// association/coaches), but the page SHELL itself had no equivalent
// check. athlasx_ops is included as the same unrestricted superset every
// other association-scoped route in this codebase already treats it as
// (resolveAssociationScope returns null for athlasx_ops, meaning
// unrestricted — not a separate code path).
export default async function AssociationLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  const role = session?.user?.role
  if (role !== 'association' && role !== 'athlasx_ops') {
    notFound()
  }
  return <>{children}</>
}
