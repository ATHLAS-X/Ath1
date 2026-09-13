'use client'

import { SessionProvider } from 'next-auth/react'
import type { Session } from 'next-auth'
import type { ReactNode } from 'react'
import { Toaster } from 'sonner'

export default function Providers({
  children,
  session,
}: {
  children: ReactNode
  session?: Session | null
}) {
  return (
    <SessionProvider session={session}>
      {children}
      {/* Was never mounted anywhere — every toast.info/toast.error call in
          the app (Forgot-password toast, "Google sign-in isn't connected
          yet", settings page, etc.) rendered nothing at all; sonner's
          toast() only queues into a store this component actually reads. */}
      <Toaster richColors position="top-right" />
    </SessionProvider>
  )
}
