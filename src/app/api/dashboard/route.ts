import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { calculateAthlasXScore } from '@/lib/athlasx-score'
import { dbRoleMap, seedPerformances } from '@/lib/mock-performance-seed'
import { requireRole } from '@/lib/require-auth'
import { resolveAssociationScope } from '@/lib/association-scope'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['association', 'selection_panel', 'coach', 'athlasx_ops'])
  if (auth instanceof NextResponse) return auth

  // association is now derived from the caller's own membership (null scope
  // = athlasx_ops, unrestricted; otherwise the first association they're
  // actually staff on) — never an arbitrary "first row in the table" pick.
  const scope = await resolveAssociationScope(auth.user)
  const association = scope === null
    ? await db.association.findFirst()
    : scope.length > 0 ? await db.association.findFirst({ where: { id: { in: scope } } }) : null
  const players = association
    ? await db.playerProfile.findMany({ where: { association_id: association.id, consent_status: { not: 'withdrawn' } } })
    : []
  // NOT YET SCOPED — flagging rather than silently leaving unfixed:
  // registrations/pendingIngest/formDropAlerts/trialCycles/totalIngestJobs/
  // session/claimedCount/alerts/activity below are still global counts
  // across every association, not filtered to `association`/`scope`. Full
  // per-query scoping here is a larger rewrite than this auth-hardening
  // pass covers — the route is now un-servable to an anonymous caller
  // (the actual finding this pass fixes), but a real association_staff
  // user today still sees cross-association aggregate numbers.
  const registrations = await db.registration.count()
  const pendingIngest = await db.ingestJob.count({ where: { status: 'pending_review' } })
  const formDropAlerts = await db.trendAlert.count({ where: { flag_type: 'form_drop' } })
  const trialCycles = await db.trialCycle.count()
  const totalIngestJobs = await db.ingestJob.count()
  const session = await db.selectionSession.findFirst({ orderBy: { created_at: 'desc' } })
  const claimedCount = await db.playerProfile.count({ where: { claim_status: 'claimed' } })

  let gradingLabel = 'Not started'
  let gradingDone = false
  if (session) {
    const gradeCount = await db.grade.count({ where: { selection_session_id: session.id } })
    const totalSelectors = await db.user.count({ where: { role: 'selection_panel' } })
    const possible = players.length * totalSelectors
    gradingLabel = `${gradeCount}/${possible} grades submitted`
    gradingDone = possible > 0 && gradeCount === possible
  }

  const trackedCount = await db.trendAlert.count()

  // Registration trend — grouped by day from real Registration rows
  const regs = await db.registration.findMany({ select: { created_at: true }, orderBy: { created_at: 'asc' } })
  const byDay = new Map<string, number>()
  let running = 0
  for (const r of regs) {
    const day = r.created_at.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
    running++
    byDay.set(day, running)
  }
  const registrationTrend = Array.from(byDay.entries()).map(([day, count]) => ({ day, count }))

  // Score distribution — computed live from each player's seeded performances
  const bands = [
    { band: '0–40', min: 0, max: 40 },
    { band: '41–55', min: 41, max: 55 },
    { band: '56–70', min: 56, max: 70 },
    { band: '71–85', min: 71, max: 85 },
    { band: '86–100', min: 86, max: 100 },
  ]
  const scores = players.map(p => {
    const role = dbRoleMap[p.playing_role ?? 'Batsman'] ?? 'Batsman'
    const result = calculateAthlasXScore({ playingRole: role, performances: seedPerformances(p.id, role), yearsExperience: 3 })
    return result.total
  })
  const scoreDist = bands.map(b => ({ band: b.band, count: scores.filter(s => s >= b.min && s <= b.max).length }))

  // Active flags
  // Same principle as the players list above — a withdrawn player must not
  // be surfaced via active flags/recent activity either.
  const allAlerts = await db.trendAlert.findMany({ orderBy: { triggered_at: 'desc' }, take: 6 })
  const alertPlayers = await db.playerProfile.findMany({
    where: { id: { in: allAlerts.map(a => a.player_id) }, consent_status: { not: 'withdrawn' } },
  })
  const alertPlayerById = new Map(alertPlayers.map(p => [p.id, p]))
  const alerts = allAlerts.filter(a => alertPlayerById.has(a.player_id))
  const activeFlags = alerts.map(a => ({
    name: alertPlayerById.get(a.player_id)?.full_name ?? 'Unknown',
    flag: a.flag_type,
    detail: a.flag_type === 'form_drop'
      ? `${a.consecutive_declining_weeks ?? '?'} consecutive declines · ${a.skill_dimension ?? 'performance'}`
      : 'Trending up',
  }))

  // Recent activity — merged from ingest jobs + trend alerts + trial cycles
  const recentJobs = await db.ingestJob.findMany({ orderBy: { created_at: 'desc' }, take: 3 })
  const recentCycles = await db.trialCycle.findMany({ orderBy: { created_at: 'desc' }, take: 2 })
  const activity = [
    ...recentJobs.map(j => ({ text: `${j.source} sync ${j.status === 'pending_review' ? 'queued' : j.status} — ${j.player_rows} rows`, type: 'ingest', time: j.created_at })),
    ...alerts.slice(0, 3).map(a => ({
      text: `${alertPlayerById.get(a.player_id)?.full_name ?? 'Player'}: ${a.flag_type === 'form_drop' ? `${a.consecutive_declining_weeks} consecutive declining weeks · form_drop` : 'on form · trending up'}`,
      type: a.flag_type === 'form_drop' ? 'alert' : 'flag',
      time: a.triggered_at,
    })),
    ...recentCycles.map(c => ({ text: `${c.age_category} trial cycle ${c.status === 'upcoming' ? 'created' : 'published'}`, type: 'cycle', time: c.created_at })),
  ].sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 6).map(a => ({
    text: a.text, type: a.type, time: timeAgo(a.time),
  }))

  return NextResponse.json({
    kpis: {
      registrations,
      dossiersReady: 0,
      pendingIngest,
      formDropAlerts,
    },
    pipeline: [
      { label: 'W1 — Ingest', href: '/ingest', done: totalIngestJobs > 0, count: `${pendingIngest} pending review` },
      { label: 'W2 — Identity', href: '/profile', done: claimedCount > 0, count: `${claimedCount} claimed` },
      { label: 'W3 — Trial Cycles', href: '/trial-cycles', done: trialCycles > 0, count: `${trialCycles} cycle${trialCycles === 1 ? '' : 's'} · ${registrations} reg.` },
      { label: 'W4 — Grading', href: '/grading', done: gradingDone, count: gradingLabel },
      { label: 'W5 — Tracking', href: '/tracking', done: trackedCount > 0, count: `${formDropAlerts} flags active` },
    ],
    registrationTrend,
    scoreDist,
    activeFlags,
    activity,
  })
}

function timeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const hours = Math.floor(diffMs / 3600000)
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
