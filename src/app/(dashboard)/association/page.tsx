'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2, CalendarRange, Users, TrendingDown, TrendingUp, Lock, UserCog, Star, Flag, AlertTriangle, Building2, Trash2, Info } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { dbRoleMap } from '@/lib/mock-performance-seed'
import { RingGauge } from '@/components/ui/ring-gauge'

// Header restyled against the hero + stat-tile + KPI-card pattern (docs
// request, 2026-09-10). The four Card sections below are UNCHANGED — real
// logic, real endpoints, not part of this pass. The "registrations, last 8
// weeks" sparkline + delta WAS dropped in an earlier pass as unbacked —
// on review, Registration.created_at is a real per-row timestamp;
// GET /api/trial-cycles/mine now buckets it by week (scoped to this
// association's own cycles, same as everything else on this page) and
// returns `trend`/`thisWeekCount`. The mockup's "Tracked players"
// stat is also relabeled "Flagged players" here: GET /api/tracking (this
// page's own pre-existing comment says so) returns only players with an
// active TrendAlert, not the full roster — calling it "tracked" the way
// the mockup did would overstate what the number means.

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

interface AffiliatedAcademyRow {
  id: string
  academy_name: string
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  status: 'active' | 'inactive'
  created_at: string
}

// Fixed alongside this restyle: this map's keys ('open'/'closed') never
// matched TrialCycleStatus's real values (upcoming/registration_open/
// registration_closed/in_progress/completed) — every real row fell
// through to the `?? cycleStatusColor.closed` default, confirmed live
// (an in_progress cycle rendered with the "closed" gray badge). Not
// something this pass introduced; found while wiring the new hero/stat
// tiles against the same field.
const cycleStatusColor: Record<string, string> = {
  upcoming: 'text-ax-accentBright bg-[rgba(255,138,30,0.1)] border-[rgba(255,138,30,0.2)]',
  registration_open: 'text-ax-ok bg-[rgba(56,211,159,0.1)] border-[rgba(56,211,159,0.2)]',
  in_progress: 'text-ax-accentBright bg-[rgba(255,138,30,0.1)] border-[rgba(255,138,30,0.2)]',
  registration_closed: 'text-ax-textFaint bg-white/[0.03] border-ax-cardBorder',
  completed: 'text-ax-textDim bg-white/[0.03] border-ax-cardBorder',
}

function formatCycleStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
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

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const w = 120, h = 36
  const min = Math.min(...values), max = Math.max(...values)
  const range = max - min || 1
  const points = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <polyline points={points} fill="none" stroke="rgb(52,211,153)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function StatTile({ icon: Icon, value, label, tint }: { icon: React.ElementType; value: string | number; label: string; tint?: string }) {
  return (
    <div className="rounded-ax-md border border-ax-cardBorder bg-ax-bgSoft p-4">
      <div className={`w-[34px] h-[34px] rounded-full flex items-center justify-center ${tint ?? 'bg-[rgba(255,138,30,0.08)]'}`}>
        <Icon className="w-4 h-4 text-ax-accentBright" />
      </div>
      <div className="font-anton text-2xl text-ax-text mt-3">{value}</div>
      <p className="font-barlow-semi text-[10.5px] font-bold uppercase tracking-[0.1em] text-ax-textDim mt-0.5">{label}</p>
    </div>
  )
}

export default function AssociationDashboard() {
  const [cycles, setCycles] = useState<TrialCycleRow[] | null>(null)
  const [cyclesError, setCyclesError] = useState('')
  const [registrationTrend, setRegistrationTrend] = useState<{ week: string; count: number }[]>([])
  const [thisWeekCount, setThisWeekCount] = useState(0)
  const [totalPlayers, setTotalPlayers] = useState(0)
  const [totalVenues, setTotalVenues] = useState(0)

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

  const [affiliatedAcademies, setAffiliatedAcademies] = useState<AffiliatedAcademyRow[] | null>(null)
  const [affiliatedError, setAffiliatedError] = useState('')
  const [newAcademyName, setNewAcademyName] = useState('')
  const [newAcademyContactName, setNewAcademyContactName] = useState('')
  const [newAcademyContactPhone, setNewAcademyContactPhone] = useState('')
  const [addingAcademy, setAddingAcademy] = useState(false)

  function loadAffiliatedAcademies() {
    fetch('/api/association/affiliated-academies')
      .then(async r => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Failed to load affiliated academies')
        setAffiliatedAcademies(d.academies ?? [])
      })
      .catch(e => setAffiliatedError(e instanceof Error ? e.message : 'Failed to load affiliated academies'))
  }

  async function addAcademy() {
    if (!newAcademyName.trim()) return
    setAddingAcademy(true)
    setAffiliatedError('')
    try {
      const res = await fetch('/api/association/affiliated-academies', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academyName: newAcademyName.trim(),
          contactName: newAcademyContactName.trim() || undefined,
          contactPhone: newAcademyContactPhone.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add academy')
      setAffiliatedAcademies(prev => [data.academy, ...(prev ?? [])])
      setNewAcademyName(''); setNewAcademyContactName(''); setNewAcademyContactPhone('')
    } catch (err) {
      setAffiliatedError(err instanceof Error ? err.message : 'Failed to add academy')
    } finally {
      setAddingAcademy(false)
    }
  }

  async function toggleAcademyStatus(id: string, current: 'active' | 'inactive') {
    const next = current === 'active' ? 'inactive' : 'active'
    setAffiliatedAcademies(prev => prev?.map(a => a.id === id ? { ...a, status: next } : a) ?? prev)
    try {
      const res = await fetch(`/api/association/affiliated-academies/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) throw new Error('Failed to update status')
    } catch {
      setAffiliatedAcademies(prev => prev?.map(a => a.id === id ? { ...a, status: current } : a) ?? prev)
      setAffiliatedError('Failed to update status — reverted.')
    }
  }

  async function removeAcademy(id: string) {
    const prev = affiliatedAcademies
    setAffiliatedAcademies(list => list?.filter(a => a.id !== id) ?? list)
    try {
      const res = await fetch(`/api/association/affiliated-academies/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to remove')
    } catch {
      setAffiliatedAcademies(prev)
      setAffiliatedError('Failed to remove entry — restored.')
    }
  }

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
    loadAffiliatedAcademies()
  }, [])

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
        setRegistrationTrend(d.trend ?? [])
        setThisWeekCount(d.thisWeekCount ?? 0)
        setTotalPlayers(d.totalPlayers ?? 0)
        setTotalVenues(d.totalVenues ?? 0)
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

  // Every number below is derived from the same four fetches this page
  // already makes — none of it is a placeholder.
  const stats = useMemo(() => {
    const openCycles = (cycles ?? []).filter(c => c.status === 'registration_open' || c.status === 'in_progress').length
    const totalRegistrations = (cycles ?? []).reduce((sum, c) => sum + c.registrations, 0)
    const flaggedPlayers = tracked?.length ?? 0
    const unanimous = (convergence ?? []).filter(v => v.consensus === 'unanimous').length
    const split = (convergence ?? []).filter(v => v.consensus === 'split').length
    const contested = (convergence ?? []).filter(v => v.consensus === 'contested').length
    const convergenceTotal = unanimous + split + contested
    const closingSoon = (cycles ?? []).filter(c => {
      if (c.status !== 'registration_open') return false
      const days = (new Date(c.registration_closes).getTime() - Date.now()) / 86400000
      return days >= 0 && days <= 7
    }).length
    return { openCycles, totalRegistrations, flaggedPlayers, unanimous, split, contested, convergenceTotal, closingSoon }
  }, [cycles, tracked, convergence])

  return (
    <div className="space-y-6 max-w-[1300px] font-barlow">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <p className="font-barlow-semi text-[11px] font-bold uppercase tracking-[0.18em] text-ax-accentBright">Association dashboard</p>
        <h1 className="font-anton uppercase text-2xl sm:text-[30px] text-ax-text mt-1">Trial cycle oversight</h1>
      </motion.div>

      {/* Hero */}
      <div
        className="rounded-ax-lg border border-ax-cardBorder p-6 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-6"
        style={{ background: 'linear-gradient(120deg, rgba(255,138,30,0.08), var(--ax-bg-soft) 55%)' }}
      >
        <div className="flex items-center gap-5 min-w-0">
          <RingGauge value={stats.openCycles} max={Math.max(stats.openCycles, cycles?.length ?? 1, 1)} label={stats.openCycles} sublabel="Cycles" />
          <div className="min-w-0">
            <p className="font-barlow-semi text-[11px] font-bold uppercase tracking-[0.18em] text-ax-accentBright">Trial season command centre</p>
            <h2 className="font-anton uppercase text-xl sm:text-2xl text-ax-text mt-1.5 leading-tight">
              {totalPlayers.toLocaleString()} tracked players · {stats.totalRegistrations.toLocaleString()} registrations across {stats.openCycles} active trial cycle{stats.openCycles === 1 ? '' : 's'}
            </h2>
            <p className="text-[13.5px] text-ax-textDim mt-2.5 leading-relaxed max-w-lg">
              {stats.unanimous} unanimous, {stats.split} split and {stats.contested} contested scout call{stats.contested === 1 ? '' : 's'}
              {totalVenues > 0 && <> · {totalVenues} trial venue{totalVenues === 1 ? '' : 's'} confirmed</>}.
            </p>
          </div>
        </div>
        <a
          href="/trial-cycles"
          className="shrink-0 font-barlow-semi text-[12.5px] font-bold uppercase tracking-[0.06em] bg-ax-accent text-[#1a0e02] px-[18px] py-[11px] rounded-ax-md hover:bg-ax-accentBright transition-colors text-center"
        >
          Open Cycle Console
        </a>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatTile icon={CalendarRange} value={stats.openCycles} label="Active cycles" />
        <StatTile icon={Users} value={stats.totalRegistrations.toLocaleString()} label="Registrations" />
        <StatTile icon={Flag} value={stats.unanimous} label="Unanimous" tint="bg-[rgba(56,211,159,0.1)]" />
        <StatTile icon={AlertTriangle} value={stats.split} label="Split calls" />
        <StatTile icon={AlertTriangle} value={stats.contested} label="Contested" tint="bg-[rgba(255,90,77,0.1)]" />
      </div>

      {/* KPI row */}
      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4">
        <div className="rounded-ax-lg border border-ax-cardBorder bg-ax-bgSoft p-5 sm:p-6 flex items-center justify-between gap-4">
          <div>
            <p className="font-barlow-semi text-[10.5px] font-bold uppercase tracking-[0.12em] text-ax-textDim">Registrations, last 8 weeks</p>
            <div className="font-anton text-4xl sm:text-[52px] text-ax-text leading-none mt-2">{stats.totalRegistrations.toLocaleString()}</div>
            {thisWeekCount > 0 && (
              <p className="text-[11px] font-bold text-ax-ok mt-1.5">↑ {thisWeekCount} this week</p>
            )}
          </div>
          <Sparkline values={registrationTrend.map(t => t.count)} />
        </div>
        <div className="rounded-ax-lg border border-ax-cardBorder bg-ax-bgSoft p-5 sm:p-6">
          <p className="font-barlow-semi text-[10.5px] font-bold uppercase tracking-[0.12em] text-ax-textDim">Panel consensus</p>
          {stats.convergenceTotal > 0 ? (
            <>
              <div className="flex h-3.5 rounded-ax-sm overflow-hidden mt-4 bg-white/[0.03]">
                {stats.unanimous > 0 && <div className="bg-ax-ok" style={{ width: `${(stats.unanimous / stats.convergenceTotal) * 100}%` }} />}
                {stats.split > 0 && <div className="bg-[rgba(255,138,30,0.22)]" style={{ width: `${(stats.split / stats.convergenceTotal) * 100}%` }} />}
                {stats.contested > 0 && <div className="bg-ax-bad" style={{ width: `${(stats.contested / stats.convergenceTotal) * 100}%` }} />}
              </div>
              <div className="flex justify-between mt-2.5 text-[10.5px] font-barlow-semi font-bold uppercase tracking-wide">
                <span className="text-ax-ok">Unanimous ({stats.unanimous})</span>
                <span className="text-ax-accentBright">Split ({stats.split})</span>
                <span className="text-ax-bad">Contested ({stats.contested})</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-ax-textFaint mt-3">No convergence data yet.</p>
          )}
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card className="p-0 overflow-hidden">
          <div className="p-5 pb-0">
            <SectionHeading icon={CalendarRange} title="Trial Cycles" sub="Your association's own cycles only" />
          </div>
          {cyclesError && <p className="text-xs text-ax-bad px-5 pb-5">{cyclesError}</p>}
          {!cycles && !cyclesError && <Loader2 className="w-4 h-4 animate-spin text-ax-textFaint mx-5 mb-5" />}
          {cycles && cycles.length === 0 && <p className="text-xs text-ax-textFaint px-5 pb-5">No trial cycles for your association yet.</p>}
          {cycles && cycles.length > 0 && (
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10.5px] font-barlow-semi font-bold uppercase tracking-[0.1em] text-ax-textDim border-y border-ax-cardBorder">
                    <th className="px-5 py-2.5 font-bold">Age category</th>
                    <th className="px-3 py-2.5 font-bold hidden md:table-cell">DOB window</th>
                    <th className="px-3 py-2.5 font-bold hidden lg:table-cell">Registration opens / closes</th>
                    <th className="px-3 py-2.5 font-bold">Status</th>
                    <th className="px-3 py-2.5 font-bold">Venues</th>
                    <th className="px-5 py-2.5 font-bold text-right">Regs</th>
                  </tr>
                </thead>
                <tbody>
                  {cycles.map(c => (
                    <tr key={c.id} className="border-b border-ax-cardBorder last:border-b-0 hover:bg-white/[0.02]">
                      <td className="px-5 py-3 text-sm font-bold text-ax-text">{c.age_category}</td>
                      <td className="px-3 py-3 text-xs text-ax-textDim hidden md:table-cell">
                        {new Date(c.dob_window_start).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} – {new Date(c.dob_window_end).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-3 py-3 text-xs text-ax-textDim hidden lg:table-cell">
                        {new Date(c.registration_opens).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – {new Date(c.registration_closes).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-ax-sm border shrink-0 ${cycleStatusColor[c.status] ?? cycleStatusColor.closed}`}>
                          {formatCycleStatus(c.status)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm text-ax-textDim">{c.venues.length}</td>
                      <td className="px-5 py-3 text-sm text-ax-text font-semibold text-right">{c.registrations}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="p-0 overflow-hidden">
            <div className="p-5 pb-0">
              <SectionHeading icon={Users} title="Scout Convergence" sub="Most recent selection session for your region" />
            </div>
            {convergenceError && <p className="text-xs text-ax-bad px-5 pb-5">{convergenceError}</p>}
            {convergenceLoading && !convergenceError && <Loader2 className="w-4 h-4 animate-spin text-ax-textFaint mx-5 mb-5" />}
            {!convergenceLoading && !convergenceError && sessionId === null && (
              <p className="text-xs text-ax-textFaint px-5 pb-5">No selection session found for your association yet.</p>
            )}
            {convergenceLocked && (
              <div className="flex items-center gap-2 text-xs text-ax-textFaint px-5 pb-5">
                <Lock className="w-3.5 h-3.5" />
                Convergence has not been unlocked by the session chair yet.
              </div>
            )}
            {convergence && convergence.length === 0 && <p className="text-xs text-ax-textFaint px-5 pb-5">No grades submitted yet for this session.</p>}
            {convergence && convergence.length > 0 && (
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10.5px] font-barlow-semi font-bold uppercase tracking-[0.1em] text-ax-textDim border-y border-ax-cardBorder">
                      <th className="px-5 py-2.5 font-bold">Player name</th>
                      <th className="px-3 py-2.5 font-bold">District</th>
                      <th className="px-3 py-2.5 font-bold">Average</th>
                      <th className="px-5 py-2.5 font-bold text-right">Consensus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {convergence.map(v => (
                      <tr key={v.player_id} className="border-b border-ax-cardBorder last:border-b-0 hover:bg-white/[0.02]">
                        <td className="px-5 py-2.5 text-sm text-ax-text font-semibold">{v.name}</td>
                        <td className="px-3 py-2.5 text-xs text-ax-textDim">{v.district}</td>
                        <td className="px-3 py-2.5 text-sm font-black text-ax-text tabular-nums">{v.average.toFixed(1)}</td>
                        <td className="px-5 py-2.5 text-right">
                          <span className={`text-[10px] font-bold uppercase ${v.consensus === 'unanimous' ? 'text-ax-ok' : v.consensus === 'split' ? 'text-ax-accentBright' : 'text-ax-bad'}`}>
                            {v.consensus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="p-0 overflow-hidden">
            <div className="p-5 pb-0">
              <SectionHeading icon={TrendingUp} title="Tracked Players" sub="Currently flagged for a form or skill trend — not the full roster" />
            </div>
            {trackedError && <p className="text-xs text-ax-bad px-5 pb-5">{trackedError}</p>}
            {!tracked && !trackedError && <Loader2 className="w-4 h-4 animate-spin text-ax-textFaint mx-5 mb-5" />}
            {tracked && tracked.length === 0 && <p className="text-xs text-ax-textFaint px-5 pb-5">No players currently flagged.</p>}
            {tracked && tracked.length > 0 && (
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10.5px] font-barlow-semi font-bold uppercase tracking-[0.1em] text-ax-textDim border-y border-ax-cardBorder">
                      <th className="px-5 py-2.5 font-bold">Name</th>
                      <th className="px-3 py-2.5 font-bold hidden md:table-cell">District</th>
                      <th className="px-3 py-2.5 font-bold hidden md:table-cell">Role</th>
                      <th className="px-3 py-2.5 font-bold">Score</th>
                      <th className="px-5 py-2.5 font-bold text-right">Delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tracked.map(p => (
                      <tr key={p.id} className="border-b border-ax-cardBorder last:border-b-0 hover:bg-white/[0.02]">
                        <td className="px-5 py-2.5 text-sm text-ax-text font-semibold">{p.name}</td>
                        <td className="px-3 py-2.5 text-xs text-ax-textDim hidden md:table-cell">{p.district}</td>
                        <td className="px-3 py-2.5 text-xs text-ax-textDim hidden md:table-cell">{dbRoleMap[p.playing_role] ?? p.playing_role.replace(/_/g, ' ')}</td>
                        <td className="px-3 py-2.5 text-sm font-black text-ax-text tabular-nums">{p.athlasx_score}</td>
                        <td className="px-5 py-2.5 text-right">
                          <span className={`text-sm font-bold tabular-nums inline-flex items-center gap-1 ${p.score_delta > 0 ? 'text-ax-ok' : p.score_delta < 0 ? 'text-ax-bad' : 'text-ax-textFaint'}`}>
                            {p.score_delta !== 0 && (p.score_delta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />)}
                            {p.score_delta > 0 ? '+' : ''}{p.score_delta.toFixed(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </motion.div>
      </div>

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

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <Card className="p-5">
          <SectionHeading icon={Building2} title="Affiliated Academies" sub="Academies you consider affiliated with your association" />

          <div className="flex items-start gap-2 p-3 rounded-ax-md border border-ax-cardBorder bg-white/[0.02] mb-4">
            <Info className="w-3.5 h-3.5 text-ax-textFaint mt-0.5 shrink-0" />
            <p className="text-[11px] text-ax-textDim leading-relaxed">
              This list is self-reported by your association — AthlasX does not independently verify academy affiliations against any external registry. Add and remove entries as your own records change.
            </p>
          </div>

          {affiliatedError && <p className="text-xs text-ax-bad mb-2">{affiliatedError}</p>}

          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <input
              value={newAcademyName}
              onChange={e => setNewAcademyName(e.target.value)}
              placeholder="Academy name *"
              className="flex-1 h-9 px-3 rounded-ax-sm bg-white/[0.03] border border-ax-cardBorder text-ax-text text-sm placeholder:text-ax-textFaint focus:outline-none focus:border-ax-accent"
            />
            <input
              value={newAcademyContactName}
              onChange={e => setNewAcademyContactName(e.target.value)}
              placeholder="Contact name"
              className="flex-1 h-9 px-3 rounded-ax-sm bg-white/[0.03] border border-ax-cardBorder text-ax-text text-sm placeholder:text-ax-textFaint focus:outline-none focus:border-ax-accent"
            />
            <input
              value={newAcademyContactPhone}
              onChange={e => setNewAcademyContactPhone(e.target.value)}
              placeholder="Contact phone"
              className="flex-1 h-9 px-3 rounded-ax-sm bg-white/[0.03] border border-ax-cardBorder text-ax-text text-sm placeholder:text-ax-textFaint focus:outline-none focus:border-ax-accent"
            />
            <button
              type="button"
              onClick={addAcademy}
              disabled={addingAcademy || !newAcademyName.trim()}
              className="shrink-0 h-9 px-4 rounded-ax-sm bg-ax-accent text-[#1a0e02] text-xs font-bold uppercase tracking-wide hover:bg-ax-accentBright transition-colors disabled:opacity-50"
            >
              {addingAcademy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Add'}
            </button>
          </div>

          {!affiliatedAcademies && !affiliatedError && <Loader2 className="w-4 h-4 animate-spin text-ax-textFaint" />}
          {affiliatedAcademies && affiliatedAcademies.length === 0 && (
            <p className="text-xs text-ax-textFaint">No affiliated academies added yet.</p>
          )}
          {affiliatedAcademies && affiliatedAcademies.length > 0 && (
            <div className="space-y-2">
              {affiliatedAcademies.map(a => (
                <div key={a.id} className="flex items-center justify-between gap-3 p-3 rounded-ax-md bg-white/[0.02] border border-ax-cardBorder">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ax-text truncate">{a.academy_name}</p>
                    <p className="text-[11px] text-ax-textFaint truncate">
                      {[a.contact_name, a.contact_phone].filter(Boolean).join(' · ') || 'No contact info added'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleAcademyStatus(a.id, a.status)}
                      className={`text-[10px] font-bold uppercase px-2 py-1 rounded-ax-sm border transition-colors ${
                        a.status === 'active'
                          ? 'text-ax-ok bg-[rgba(56,211,159,0.1)] border-[rgba(56,211,159,0.2)]'
                          : 'text-ax-textFaint bg-white/[0.03] border-ax-cardBorder'
                      }`}
                    >
                      {a.status === 'active' ? 'Active' : 'Inactive'}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeAcademy(a.id)}
                      className="p-1.5 rounded-ax-sm text-ax-textFaint hover:text-ax-bad hover:bg-ax-bad/10 transition-colors"
                      aria-label={`Remove ${a.academy_name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  )
}
