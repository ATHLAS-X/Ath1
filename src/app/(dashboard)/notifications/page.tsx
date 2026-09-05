'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarClock, CheckCircle2, Loader2, ArrowRight } from 'lucide-react'

/*
 * W6 — "Trial & camp notifications... Registration deep link -> W3"
 *
 * Built for the player role: upcoming trial cycles they're eligible for by
 * age (DOB inside the cycle's dob_window) that they haven't registered for
 * yet, plus status updates on registrations they've already made. Sourced
 * from GET /api/trial-cycles (public) + /api/my-record (for the player's
 * own dob) — no new list-everything route needed.
 */

interface Venue { id: string; name: string; district: string; date: string }
interface Registration { id: string; fee_status: string; checked_in: boolean }
interface Cycle {
  id: string
  age_category: string
  dob_window_start: string
  dob_window_end: string
  registration_opens: string
  registration_closes: string
  status: string
  venues: Venue[]
  myRegistration: Registration | null
}

function isEligible(dob: Date, cycle: Cycle): boolean {
  const start = new Date(cycle.dob_window_start)
  const end = new Date(cycle.dob_window_end)
  return dob >= start && dob <= end
}

export default function NotificationsPage() {
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [dob, setDob] = useState<Date | null>(null)
  const [hasProfile, setHasProfile] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/trial-cycles').then((r) => r.json()),
      fetch('/api/my-record').then((r) => r.json()),
    ]).then(([cyclesData, recordData]) => {
      setCycles(cyclesData.cycles ?? [])
      if (recordData.player?.dob) setDob(new Date(recordData.player.dob))
      else setHasProfile(false)
    }).finally(() => setLoading(false))
  }, [])

  const openForRegistration = dob
    ? cycles.filter((c) => c.status === 'registration_open' && !c.myRegistration && isEligible(dob, c))
    : []
  const myRegistrations = cycles.filter((c) => c.myRegistration)

  return (
    <div className="space-y-5 max-w-[900px]">
      <div>
        <h1 className="text-xl font-black text-white">Notifications</h1>
        <p className="text-xs text-zinc-600 mt-0.5">Trial cycles you&apos;re eligible for, and updates on your registrations</p>
      </div>

      {loading ? (
        <div className="glass-card p-8 flex items-center justify-center text-zinc-600">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : !hasProfile ? (
        <div className="glass-card p-6 text-xs text-zinc-600">No player profile is linked to this account yet.</div>
      ) : (
        <div className="glass-card p-5 space-y-3">
          {openForRegistration.length === 0 && myRegistrations.length === 0 && (
            <p className="text-xs text-zinc-600 px-1">Nothing to show right now — new trial cycles you&apos;re eligible for will appear here.</p>
          )}

          {openForRegistration.map((c) => (
            <Link
              key={c.id}
              href={`/trial-cycles/${c.id}/register`}
              className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-green-500/25 transition-colors group"
            >
              <CalendarClock className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-zinc-300">
                  You&apos;re eligible for the <span className="font-bold text-white">{c.age_category}</span> trial cycle — registration closes{' '}
                  {new Date(c.registration_closes).toLocaleDateString()}
                </p>
                <p className="text-[10px] text-zinc-600 mt-1">{c.venues.length} venue{c.venues.length === 1 ? '' : 's'}</p>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-green-400 transition-colors shrink-0 mt-0.5" />
            </Link>
          ))}

          {myRegistrations.map((c) => (
            <div key={c.id} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <CheckCircle2 className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-zinc-300">
                  Registered for the <span className="font-bold text-white">{c.age_category}</span> trial cycle —{' '}
                  fee {c.myRegistration!.fee_status}
                  {c.myRegistration!.checked_in ? ', checked in' : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
