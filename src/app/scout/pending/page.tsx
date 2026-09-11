import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Anton, Barlow, Barlow_Semi_Condensed } from 'next/font/google'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { authOptions } from '@/lib/auth'
import { isScoutAccessPending } from '@/lib/scout/verification-gate'

/*
 * Holding screen for a signed-in scout whose org hasn't been approved by
 * AthlasX Ops yet — mirrors src/app/association/pending/page.tsx exactly
 * (same visual family, same self-redirect-both-ways behavior), swapped to
 * the scout verification gate.
 *
 * Self-redirects both ways: someone who isn't a scout at all has nothing
 * to see here; someone whose org just got approved shouldn't be stuck
 * looking at a stale pending screen.
 */

const anton = Anton({ subsets: ['latin'], weight: '400', variable: '--font-anton' })
const barlow = Barlow({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-barlow' })
const barlowSemi = Barlow_Semi_Condensed({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-barlow-semi' })

export default async function ScoutPendingPage() {
  const session = await getServerSession(authOptions)
  const role = session?.user?.role
  if (!session?.user || role !== 'scout') {
    redirect('/')
  }
  const pending = await isScoutAccessPending({ id: session.user.id!, email: session.user.email ?? '', role })
  if (!pending) {
    redirect('/scout')
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
            Your scout account is signed up, but AthlasX Ops hasn&apos;t verified your organization yet — the candidate pool stays
            locked until that review completes. This usually doesn&apos;t take long. You don&apos;t need to do anything else right now.
          </p>
          <Link href="/" className="inline-block mt-2 text-sm font-bold text-[#FFA64D] hover:text-[#FF8A1E]">Back to AthlasX</Link>
        </div>
      </div>
    </div>
  )
}
