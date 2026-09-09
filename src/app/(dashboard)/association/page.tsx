'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2, CalendarRange, Users, TrendingDown, TrendingUp, Lock, UserCog, Star } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { dbRoleMap } from '@/lib/mock-performance-seed'

/**
 * Association-facing dashboard — docs/AthlasX_Master_Data_Points_Phase1_Prompts.md
 * L-5. Read-only per the pivot document's role table: an Association views
 * their own region's trial cycles, selection/convergence results, and
 * season tracking for their players. No create/edit anywhere on this page
 * — record creation for associations is the athlasx_ops-only tool at
 * /ops/associations/new, and this role has no selection authority.
 *
 * Data sources (see the API-gap analysis given before this was built):
 * - Trial cycles: GET /api/trial-cycles/mine — net-new, scoped by
 *   resolveAssociationScope. The existing GET /api/trial-cycles is
 *   deliberately public/unscoped for pre-account browsing, so it couldn't
 *   be reused for a private "my region" view.
 * - Selection/convergence: GET /api/grading/session (already permitted
 *   'association') + GET /api/grading/[sessionId]/convergence (this pass
 *   added 'association' to its role allowlist — it only allowed
 *   'selection_panel' before).
 * - Season tracking: GET /api/tracking (already scoped correctly for any
 *   role). Note: this only returns players with an active TrendAlert
 *   (flagged for a form/skill issue), not full-squad season tracking —
 *   there's no existing endpoint for "every player's trend, flagged or
 *   not." Flagged here as a known scope limit, not silently hidden.
 * - Coach assignments (W7 — coaches are assigned BY the association):
 *   GET /api/squads (list, scoped) + GET /api/squads/[id] (per-squad
 *   coach roster, already returns {userId, email, isLead}) for read;
 *   POST /api/squads/[id]/coaches (already association/ops-only, already
 *   rejects self-assignment) for the assign action itself. All three
 *   already existed. The one net-new piece: GET /api/association/coaches
 *   (the "coaches available to assign" list) was missing user_id in its
 *   response — the assign endpoint needs User.id, not CoachProfile.id —
 *   fixed as a one-field addition alongside this page.
 */

interface TrialCycleRow {
  id: string
  age_category: string
  dob_window_start: string
  dob_window_end: string
  registration_opens: string
  registration_closes: string
  status: string
  venues: { id: string; name: string }[]
  registrations: number
}

interface ConvergenceView {
  player_id: string
  name: string
  district: string
  average: number
  consensus: 'unanimous' | 'split' | 'contested'
}

interface TrackedPlayer {
  id: string
  name: string
  district: string
  playing_role: string
  flag: string
  athlasx_score: number
  score_delta: number
}

interface SquadCoachRow {
  userId: string
  email: string
  isLead: boolean
}

interface SquadRow {
  id: string
  name: string
  season: string
  status: string
  coaches: SquadCoachRow[] | null
}

interface AvailableCoach {
  id: string
  user_id: string
  full_name: string
  email: string
}

const cycleStatusColor: Record<string, string> = {
  upcoming: 'text-ax-accentBright bg-[rgba(255,138,30,0.1)] border-[rgba(255,138,30,0.2)]',
  open: 'text-ax-ok bg-[rgba(56,211,159,0.1)] border-[rgba(56,211,159,0.2)]',
  closed: 'text-ax-textFaint bg-white/[0.03] border-ax-cardBorder',
  completed: 'text-ax-textDim bg-white/[0.03] border-ax-cardBorder',
}

function SectionHeading({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <Icon className="w-4 h-4 text-ax-accentBright" />
      <div>
        <p className="text-sm font-bold text-ax-text">{title}</p>
        <p className="text-[11px] text-ax-textFaint">{sub}</p>
      </div>
    </div>
  )
}

export default function AssociationDashboard() {
  const [cycles, setCycles] = useState<TrialCycleRow[] | null>(null)
  const [cyclesError, setCyclesError] = useState('')

  const [convergenceLoading, setConvergenceLoading] = useState(true)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [convergenceLocked, setConvergenceLocked] = useState(false)
  const [convergence, setConvergence] = useState<ConvergenceView[] | null>(null)
  const [convergenceError, setConvergenceError] = useState('')

  const [tracked, setTracked] = useState<TrackedPlayer[] | null>(null)
  const [trackedError, setTrackedError] = useState('')

  const [squads, setSquads] = useState<SquadRow[] | null>(null)
  const [squadsError, setSquadsError] = useState('')
  const [availableCoaches, setAvailableCoaches] = useState<AvailableCoach[]>([])
  const [assigningSquad, setAssigningSquad] = useState<string | null>(null)
  const [assignError, setAssignError] = useState('')

  function loadSquads() {
    fetch('/api/squads')
      .then(async r => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Failed to load squads')
        const list: { id: string; name: string; season: string; status: string }[] = d.squads ?? []
        setSquads(list.map(s => ({ ...s, coaches: null })))
        // Coach roster is per-squad detail, not in the list response —
        // fetched lazily per squad rather than N+1'd eagerly for every
        // squad up front, since an association can have many squads.
        list.forEach(s => {
          fetch(`/api/squads/${s.id}`)
            .then(async r2 => {
              const d2 = await r2.json()
              if (!r2.ok) return
              setSquads(prev => prev?.map(sq => sq.id === s.id ? { ...sq, coaches: d2.squad.coaches ?? [] } : sq) ?? prev)
            })
            .catch(() => {})
        })
      })
      .catch(e => setSquadsError(e instanceof Error ? e.message : 'Failed to load squads'))
  }

  async function assignCoach(squadId: string, userId: string) {
    setAssigningSquad(squadId)
    setAssignError('')
    try {
      const res = await fetch(`/api/squads/${squadId}/coaches`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to assign coach')
      setSquads(prev => prev?.map(sq => {
        if (sq.id !== squadId) return sq
        const assigned = availableCoaches.find(c => c.user_id === userId)
        const already = sq.coaches?.some(c => c.userId === userId)
        if (already || !assigned) return sq
        return { ...sq, coaches: [...(sq.coaches ?? []), { userId, email: assigned.email, isLead: false }] }
      }) ?? prev)
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Failed to assign coach')
    } finally {
      setAssigningSquad(null)
    }
  }

  useEffect(() => {
    loadSquads()
    fetch('/api/association/coaches')
      .then(async r => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Failed to load coaches')
        setAvailableCoaches(d.coaches ?? [])
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/trial-cycles/mine')
      .then(async r => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Failed to load trial cycles')
        setCycles(d.cycles ?? [])
      })
      .catch(e => setCyclesError(e instanceof Error ? e.message : 'Failed to load trial cycles'))

    fetch('/api/tracking')
      .then(async r => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Failed to load season tracking')
        setTracked(d.players ?? [])
      })
      .catch(e => setTrackedError(e instanceof Error ? e.message : 'Failed to load season tracking'))

    fetch('/api/grading/session')
      .then(async r => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Failed to load selection session')
        if (!d.session) { setSessionId(null); return }
        setSessionId(d.session.id)
        if (!d.session.convergence_unlocked_at) { setConvergenceLocked(true); return }
        const cr = await fetch(`/api/grading/${d.session.id}/convergence`)
        const cd = await cr.json()
        if (!cr.ok) throw new Error(cd.error || 'Failed to load convergence')
        setConvergence(cd.views ?? [])
      })
      .catch(e => setConvergenceError(e instanceof Error ? e.message : 'Failed to load selection session'))
      .finally(() => setConvergenceLoading(false))
  }, [])

  return (
    <div className="space-y-6 max-w-[1100px] font-barlow">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-anton uppercase text-xl text-ax-text">Association Dashboard</h1>
        <p className="text-xs text-ax-textFaint mt-0.5">Read-only overview of your region — trial cycles, selection results, and player tracking</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card className="p-5">
          <SectionHeading icon={CalendarRange} title="Trial Cycles" sub="Your association's own cycles only" />
          {cyclesError && <p className="text-xs text-ax-bad">{cyclesError}</p>}
          {!cycles && !cyclesError && <Loader2 className="w-4 h-4 animate-spin text-ax-textFaint" />}
          {cycles && cycles.length === 0 && <p className="text-xs text-ax-textFaint">No trial cycles for your association yet.</p>}
          {cycles && cycles.length > 0 && (
            <div className="space-y-2">
              {cycles.map(c => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 gap-y-2 px-3 py-2.5 rounded-ax-md bg-white/[0.02] border border-ax-cardBorder">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[10px] font-bold px-2 py-1 rounded-ax-sm border border-[rgba(255,138,30,0.2)] bg-[rgba(255,138,30,0.1)] text-ax-accentBright uppercase tracking-wide shrink-0">
                      {c.age_category}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-ax-text">{c.venues.map(v => v.name).join(', ') || 'No venue set'}</p>
                      <p className="text-[11px] text-ax-textFaint mt-0.5">{c.registrations} registered</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-ax-sm border shrink-0 ${cycleStatusColor[c.status] ?? cycleStatusColor.closed}`}>
                    {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="p-5">
          <SectionHeading icon={Users} title="Selection Convergence" sub="Most recent selection session for your region" />
          {convergenceError && <p className="text-xs text-ax-bad">{convergenceError}</p>}
          {convergenceLoading && !convergenceError && <Loader2 className="w-4 h-4 animate-spin text-ax-textFaint" />}
          {!convergenceLoading && !convergenceError && sessionId === null && (
            <p className="text-xs text-ax-textFaint">No selection session found for your association yet.</p>
          )}
          {convergenceLocked && (
            <div className="flex items-center gap-2 text-xs text-ax-textFaint">
              <Lock className="w-3.5 h-3.5" />
              Convergence has not been unlocked by the session chair yet.
            </div>
          )}
          {convergence && convergence.length === 0 && <p className="text-xs text-ax-textFaint">No grades submitted yet for this session.</p>}
          {convergence && convergence.length > 0 && (
            <div className="space-y-1.5">
              {convergence.map(v => (
                <div key={v.player_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-ax-sm bg-white/[0.03] border border-ax-cardBorder">
                  <div className="min-w-0">
                    <p className="text-sm text-ax-text font-semibold">{v.name}</p>
                    <p className="text-[11px] text-ax-textFaint">{v.district}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black text-ax-text tabular-nums">{v.average.toFixed(1)}</span>
                    <span className={`text-[10px] font-bold uppercase ${v.consensus === 'unanimous' ? 'text-ax-ok' : v.consensus === 'split' ? 'text-ax-accentBright' : 'text-ax-bad'}`}>
                      {v.consensus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card className="p-5">
          <SectionHeading icon={TrendingUp} title="Season Tracking" sub="Players currently flagged for a form or skill trend — not the full roster" />
          {trackedError && <p className="text-xs text-ax-bad">{trackedError}</p>}
          {!tracked && !trackedError && <Loader2 className="w-4 h-4 animate-spin text-ax-textFaint" />}
          {tracked && tracked.length === 0 && <p className="text-xs text-ax-textFaint">No players currently flagged.</p>}
          {tracked && tracked.length > 0 && (
            <div className="space-y-1.5">
              {tracked.map(p => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-ax-sm bg-white/[0.03] border border-ax-cardBorder">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-ax-text font-semibold">{p.name}</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/[0.05] border border-ax-cardBorder text-ax-textDim uppercase tracking-wide">
                        {dbRoleMap[p.playing_role] ?? p.playing_role.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-[11px] text-ax-textFaint">{p.district} · {p.playing_role}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-ax-text tabular-nums">{p.athlasx_score}</span>
                    {p.score_delta !== 0 && (
                      p.score_delta > 0
                        ? <TrendingUp className="w-3.5 h-3.5 text-ax-ok" />
                        : <TrendingDown className="w-3.5 h-3.5 text-ax-bad" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="p-5">
          <SectionHeading icon={UserCog} title="Coach Assignments" sub="Assign coaches to your squads — the only action on this page" />
          {squadsError && <p className="text-xs text-ax-bad">{squadsError}</p>}
          {assignError && <p className="text-xs text-ax-bad mt-1">{assignError}</p>}
          {!squads && !squadsError && <Loader2 className="w-4 h-4 animate-spin text-ax-textFaint" />}
          {squads && squads.length === 0 && <p className="text-xs text-ax-textFaint">No squads for your association yet.</p>}
          {squads && squads.length > 0 && (
            <div className="space-y-3">
              {squads.map(sq => {
                const assignedIds = new Set((sq.coaches ?? []).map(c => c.userId))
                const unassigned = availableCoaches.filter(c => !assignedIds.has(c.user_id))
                return (
                  <div key={sq.id} className="p-3 rounded-ax-md bg-white/[0.02] border border-ax-cardBorder">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div>
                        <p className="text-sm font-bold text-ax-text">{sq.name}</p>
                        <p className="text-[11px] text-ax-textFaint">{sq.season} · {sq.status}</p>
                      </div>
                    </div>

                    {sq.coaches === null ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-ax-textFaint" />
                    ) : sq.coaches.length === 0 ? (
                      <p className="text-[11px] text-ax-textFaint mb-2">No coach assigned yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {sq.coaches.map(c => (
                          <span key={c.userId} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-ax-sm bg-[rgba(255,138,30,0.1)] border border-[rgba(255,138,30,0.2)] text-ax-accentBright">
                            {c.isLead && <Star className="w-3 h-3" />}
                            {c.email}
                          </span>
                        ))}
                      </div>
                    )}

                    {unassigned.length > 0 && (
                      <div className="flex items-center gap-2">
                        <select
                          className="h-8 px-2 rounded-ax-sm bg-white/[0.03] border border-ax-cardBorder text-ax-text text-xs focus:outline-none focus:border-ax-accent"
                          defaultValue=""
                          onChange={e => { if (e.target.value) { assignCoach(sq.id, e.target.value); e.target.value = '' } }}
                          disabled={assigningSquad === sq.id}
                        >
                          <option value="" disabled>Assign a coach…</option>
                          {unassigned.map(c => <option key={c.user_id} value={c.user_id}>{c.full_name} ({c.email})</option>)}
                        </select>
                        {assigningSquad === sq.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-ax-textFaint" />}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  )
}
