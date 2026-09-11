import { getServerSession } from 'next-auth'
import { notFound, redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { FRANCHISE_SCOUT_ENABLED } from '@/lib/feature-flags'
import { isScoutAccessPending } from '@/lib/scout/verification-gate'

// Same posture as academy/layout.tsx: the page shell itself 404s rather
// than rendering with a failed data fetch. Gated on FRANCHISE_SCOUT_ENABLED
// (the player-data-safety flag, checked independently again in
// /api/scout/candidates), not SCOUT_SELF_SERVE_ENABLED (the signup-surface
// flag) — an already-existing scout account should still lose access to
// real player data the moment the safety flag goes off, even if the
// account itself predates that decision.
//
// Same pattern as association/layout.tsx's pending-verification redirect:
// a scout whose ScoutProfile isn't yet approved never reaches this
// dashboard shell at all — redirected to the holding page instead, same
// "no real access until approved" gate enforced again independently at
// GET /api/scout/candidates.
export default async function ScoutLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  const role = session?.user?.role
  if (!FRANCHISE_SCOUT_ENABLED || (role !== 'scout' && role !== 'athlasx_ops')) {
    notFound()
  }
  if (session?.user && await isScoutAccessPending({ id: session.user.id!, email: session.user.email ?? '', role })) {
    redirect('/scout/pending')
  }
  return <>{children}</>
}
