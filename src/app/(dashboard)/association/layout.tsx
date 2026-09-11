import { getServerSession } from 'next-auth'
import { notFound, redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { isAssociationAccessPending } from '@/lib/association/verification-gate'

// Same pattern as src/app/(dashboard)/academy/layout.tsx — this page's own
// API calls are already role-gated (requireRole(['association',
// 'athlasx_ops']) on trial-cycles/mine, tracking, grading/*, squads/*,
// association/coaches), but the page SHELL itself had no equivalent
// check. athlasx_ops is included as the same unrestricted superset every
// other association-scoped route in this codebase already treats it as
// (resolveVerifiedAssociationScope returns null for athlasx_ops, meaning
// unrestricted — not a separate code path).
//
// A self-serve association stuck pending (or rejected) AthlasX Ops
// verification never reaches this dashboard shell at all — redirected to
// the holding page instead, same "no real access until approved" gate
// enforced at every API chokepoint via verification-gate.ts.
export default async function AssociationLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  const role = session?.user?.role
  if (role !== 'association' && role !== 'athlasx_ops') {
    notFound()
  }
  if (session?.user && await isAssociationAccessPending({ id: session.user.id!, email: session.user.email ?? '', role })) {
    redirect('/association/pending')
  }
  return <>{children}</>
}
