import type { Metadata } from 'next'
import { Anton, Barlow, Barlow_Semi_Condensed } from 'next/font/google'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Providers from '@/components/Providers'
import { cn } from '@/lib/utils'
import './globals.css'

// Registered globally per the site-wide design-system pass — was
// previously loaded per-page (HeroLanding.tsx, auth/page.tsx, each
// onboarding page) with the same variable names. Loading once here means
// those pages now receive the same font instances via inheritance; their
// own local next/font calls still work unchanged (Next dedupes identical
// font requests), so this is not a breaking change for them.
const anton = Anton({ subsets: ['latin'], weight: '400', variable: '--font-anton' })
const barlow = Barlow({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-barlow' })
const barlowSemi = Barlow_Semi_Condensed({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-barlow-semi' })

export const metadata: Metadata = {
  title: 'AthlasX',
  description: 'Cricket talent intelligence for the association pathway',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  return (
    <html lang="en" className={cn(anton.variable, barlow.variable, barlowSemi.variable)}>
      <body className="antialiased">
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  )
}
