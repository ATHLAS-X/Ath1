import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import HeroLanding from '@/components/marketing/HeroLanding'

// Signed-in visitors go straight to their dashboard, same as before.
// Signed-out visitors now see a real landing page instead of an immediate
// redirect to the sign-in form — / previously had no public-facing content
// at all (confirmed: no hero/marketing component existed anywhere in this
// app), which meant every visitor was auth-gated before seeing anything.
export default async function RootPage() {
  const session = await getServerSession(authOptions)
  if (session?.user?.id) redirect('/dashboard')
  return <HeroLanding />
}
