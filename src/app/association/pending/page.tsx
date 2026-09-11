import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Anton, Barlow, Barlow_Semi_Condensed } from 'next/font/google'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { authOptions } from '@/lib/auth'
import { isAssociationAccessPending } from '@/lib/association/verification-gate'

/*
 * Holding screen for a signed-in association staff member whose
 * association hasn't been approved by AthlasX Ops yet — same visual
 * family as the onboarding pages (rail-less, centered notice, like
 * src/app/onboarding/association/page.tsx's flag-off state), not the
 * dashboard chrome, since this user has no real dashboard access to show.
 *
 * Self-redirects both ways: someone who isn't association staff at all
 * has nothing to see here; someone whose association just got approved
 * shouldn't be stuck looking at a stale pending screen.
 */

const anton = Anton({ subsets: ['latin'], weight: '400', variable: '--font-anton' })
const barlow = Barlow({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-barlow' })
const barlowSemi = Barlow_Semi_Condensed({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-barlow-semi' })

export default async function AssociationPendingPage() {
  const session = await getServerSession(authOptions)
  const role = session?.user?.role
  if (!session?.user || role !== 'association') {
    redirect('/')
  }
  const pending = await isAssociationAccessPending({ id: session.user.id!, email: session.user.email ?? '', role })
  if (!pending) {
    redirect('/association')
  }

  return (
    <div className={cn(anton.variable, barlow.variable, barlowSemi.variable)}>
      <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D] font-[family-name:var(--font-barlow)] text-[#F5F5F0] p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-[rgba(255,138,30,0.14)] border border-[#FF8A1E]/40 flex items-center justify-center mx-auto">
            <Clock className="w-6 h-6 text-[#FFA64D]" />
          </div>
          <h1 className="font-[family-name:var(--font-anton)] uppercase text-2xl">Pending AthlasX Ops verification</h1>
          <p className="text-sm text-white/60 leading-relaxed">
            Your association is signed up, but AthlasX Ops hasn&apos;t verified your data-sharing agreement yet — your dashboard stays
            locked until that review completes. This usually doesn&apos;t take long. You don&apos;t need to do anything else right now.
          </p>
          <Link href="/" className="inline-block mt-2 text-sm font-bold text-[#FFA64D] hover:text-[#FF8A1E]">Back to AthlasX</Link>
        </div>
      </div>
    </div>
  )
}
