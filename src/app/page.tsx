import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { rootDestination } from '@/lib/chrome'
import HeroLanding from '@/components/marketing/HeroLanding'

// Signed-in visitors go straight to their role's own home page (rootDestination
// in src/lib/chrome.ts) — not unconditionally to /dashboard, whose API route
// 403s for a player session. Signed-out visitors see a real landing page
// instead of an immediate redirect to the sign-in form.
export default async function RootPage() {
  const session = await getServerSession(authOptions)
  if (session?.user?.id) redirect(rootDestination(session))
  return <HeroLanding />
}
