'use client'

import { Bell } from 'lucide-react'

const notifications = [
  { id: 1, text: 'Dev Patel flagged: 3 consecutive declining weeks · form_drop', time: '6h ago' },
  { id: 2, text: 'Arjun Sharma flagged: on form · +4 score delta this week', time: '4h ago' },
  { id: 3, text: 'CricHeroes sync completed — 412 rows queued for review', time: '2h ago' },
]

export default function NotificationsPage() {
  return (
    <div className="space-y-5 max-w-[900px]">
      <div>
        <h1 className="text-xl font-black text-white">Notifications</h1>
        <p className="text-xs text-zinc-600 mt-0.5">Flags, ingest jobs, and cycle updates</p>
      </div>
      <div className="glass-card p-5 space-y-3">
        {notifications.map(n => (
          <div key={n.id} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <Bell className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-zinc-300">{n.text}</p>
              <p className="text-[10px] text-zinc-600 mt-1">{n.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
