import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { rootDestination } from '@/lib/chrome'

export default async function RootPage() {
  const session = await getServerSession(authOptions)
  redirect(rootDestination(session))
}
