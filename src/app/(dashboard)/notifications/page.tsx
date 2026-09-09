'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarClock, CheckCircle2, Loader2, ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/card'

/*
 * W6 — "Trial & camp notifications... Registration deep link -> W3"
 *
 * Built for the player role: upcoming trial cycles they're eligible for by
 * age (DOB inside the cycle's dob_window) that they haven't registered for
 * yet, plus status updates on registrations they've already made. Sourced
 * from GET /api/trial-cycles (public) + /api/my-record (for the player's
 * own dob) — no new list-everything route needed.
 *
 * Styling-pass note: this page covers trial-cycle eligibility/registration
 * status only — no selection-result or guardian-consent-request feed
 * exists here or anywhere else in this codebase today. Not added in this
 * pass (styling only); flagged in the accompanying report instead.
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
    <div className="space-y-5 max-w-[900px] font-barlow">
      <div>
        <h1 className="font-anton uppercase text-xl text-ax-text">Notifications</h1>
        <p className="text-xs text-ax-textFaint mt-0.5">Trial cycles you&apos;re eligible for, and updates on your registrations</p>
      </div>

      {loading ? (
        <Card className="p-8 flex items-center justify-center text-ax-textFaint">
          <Loader2 className="w-5 h-5 animate-spin" />
        </Card>
      ) : !hasProfile ? (
        <Card className="p-6 text-xs text-ax-textFaint">No player profile is linked to this account yet.</Card>
      ) : (
        <Card className="p-5 space-y-3">
          {openForRegistration.length === 0 && myRegistrations.length === 0 && (
            <p className="text-xs text-ax-textFaint px-1">Nothing to show right now — new trial cycles you&apos;re eligible for will appear here.</p>
          )}

          {openForRegistration.map((c) => (
            <Link
              key={c.id}
              href={`/trial-cycles/${c.id}/register`}
              className="flex items-start gap-3 p-3 rounded-ax-md bg-white/[0.02] border border-ax-cardBorder hover:border-ax-accent/40 transition-colors group"
            >
              <CalendarClock className="w-4 h-4 text-ax-accentBright mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-ax-textDim">
                  You&apos;re eligible for the <span className="font-bold text-ax-text">{c.age_category}</span> trial cycle — registration closes{' '}
                  {new Date(c.registration_closes).toLocaleDateString()}
                </p>
                <p className="text-[10px] text-ax-textFaint mt-1">{c.venues.length} venue{c.venues.length === 1 ? '' : 's'}</p>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-ax-textFaint group-hover:text-ax-accentBright transition-colors shrink-0 mt-0.5" />
            </Link>
          ))}

          {myRegistrations.map((c) => (
            <div key={c.id} className="flex items-start gap-3 p-3 rounded-ax-md bg-white/[0.02] border border-ax-cardBorder">
              <CheckCircle2 className="w-4 h-4 text-ax-ok mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-ax-textDim">
                  Registered for the <span className="font-bold text-ax-text">{c.age_category}</span> trial cycle —{' '}
                  fee {c.myRegistration!.fee_status}
                  {c.myRegistration!.checked_in ? ', checked in' : ''}
                </p>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
