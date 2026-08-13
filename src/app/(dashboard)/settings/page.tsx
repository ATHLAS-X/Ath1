'use client'

import { Settings } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="space-y-5 max-w-[900px]">
      <div>
        <h1 className="text-xl font-black text-white">Settings</h1>
        <p className="text-xs text-zinc-600 mt-0.5">Association and account preferences</p>
      </div>
      <div className="glass-card p-6 flex items-center gap-3 text-zinc-500">
        <Settings className="w-4 h-4" />
        <p className="text-xs">Settings management is not yet implemented.</p>
      </div>
    </div>
  )
}
