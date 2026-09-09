import { getServerSession } from 'next-auth'
import { notFound } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { ACADEMY_SELF_SERVE_ENABLED } from '@/lib/feature-flags'

// Every page under src/app/api/academy/** already refuses to serve data
// unless ACADEMY_SELF_SERVE_ENABLED is on and the caller is academy_admin
// (academyGate() + requireRole in each route). Until this layout, the
// PAGE SHELLS themselves (page.tsx, players, add-players, join-requests)
// had no equivalent check — anyone navigating here directly saw the UI
// render (with its data fetches failing), rather than the page not
// existing at all. This closes that gap for the whole route group in one
// place, matching academyGate()'s own "this surface doesn't exist right
// now" posture: notFound(), not a 403/redirect — being an academy_admin
// with the flag off gets the exact same 404 as anyone else, same as every
// gated API route already does.
export default async function AcademyLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!ACADEMY_SELF_SERVE_ENABLED || session?.user?.role !== 'academy_admin') {
    notFound()
  }
  return <>{children}</>
}
