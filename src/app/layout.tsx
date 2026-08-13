import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AthlasX',
  description: 'Cricket talent intelligence for the association pathway',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
