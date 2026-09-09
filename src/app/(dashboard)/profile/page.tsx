'use client'

import { User } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { chromeIdentity } from '@/lib/chrome'
import { Card } from '@/components/ui/card'

export default function ProfilePage() {
  const { data: session } = useSession()
  const identity = chromeIdentity(session?.user)

  return (
    <div className="space-y-5 max-w-[900px] font-barlow">
      <div>
        <h1 className="font-anton uppercase text-xl text-ax-text">My Profile</h1>
        <p className="text-xs text-ax-textFaint mt-0.5">Identity and account details</p>
      </div>
      <Card className="p-6 flex items-center gap-4">
        <div className="w-14 h-14 rounded-ax-xl bg-[rgba(255,138,30,0.14)] border border-[color:var(--ax-accent)] flex items-center justify-center">
          <User className="w-6 h-6 text-ax-accentBright" />
        </div>
        <div>
          <p className="text-sm font-bold text-ax-text">{identity.email || 'Not signed in'}</p>
          <p className="text-xs text-ax-textFaint">{identity.roleLabel}</p>
        </div>
      </Card>
    </div>
  )
}
