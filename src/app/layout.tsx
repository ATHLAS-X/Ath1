import type { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Providers from '@/components/Providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'AthlasX',
  description: 'Cricket talent intelligence for the association pathway',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  )
}
