'use client'

import { User } from 'lucide-react'

export default function ProfilePage() {
  return (
    <div className="space-y-5 max-w-[900px]">
      <div>
        <h1 className="text-xl font-black text-white">My Profile</h1>
        <p className="text-xs text-zinc-600 mt-0.5">Identity and account details</p>
      </div>
      <div className="glass-card p-6 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center">
          <User className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-white">Hritvik Garg</p>
          <p className="text-xs text-zinc-600">AthlasX Ops</p>
        </div>
      </div>
    </div>
  )
}
