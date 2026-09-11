import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/require-auth'
import { resolveVerifiedAssociationScope } from '@/lib/association/verification-gate'

export const dynamic = 'force-dynamic'

// docs/AthlasX_Master_Data_Points_Phase1_Prompts.md L-5 — the existing
// GET /api/trial-cycles is deliberately public/unscoped (prospective
// registrants browse before having an account) and returns every
// association's cycles. There was no authenticated "my region's cycles"
// view for an association-role caller until this route. Net-new, not a
// fix to the existing endpoint — that one's public-browse contract stays
// exactly as-is.
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['association', 'athlasx_ops'])
  if (auth instanceof NextResponse) return auth

  const scope = await resolveVerifiedAssociationScope(auth.user)
  const unrestricted = scope === null

  const cycles = await db.trialCycle.findMany({
    where: unrestricted ? undefined : { association_id: { in: scope ?? [] } },
    include: {
      venues: true,
      _count: { select: { registrations: true } },
    },
    orderBy: { created_at: 'desc' },
  })

  // Real "registrations, last 8 weeks" trend. Registration.created_at is a
  // real timestamp on every row — bucketing it by week is aggregation, not
  // invention, unlike the mockup's sparkline which had no query behind it
  // at all before this. Scoped by the same trial-cycle set as `cycles`
  // above so an association only ever sees its own region's registrations.
  const cycleIds = cycles.map((c) => c.id)
  const regs = cycleIds.length
    ? await db.registration.findMany({ where: { trial_cycle_id: { in: cycleIds } }, select: { created_at: true } })
    : []
  const mondayOf = (d: Date) => {
    const day = d.getUTCDay()
    const diff = (day === 0 ? -6 : 1) - day
    const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff))
    return monday.toISOString().slice(0, 10)
  }
  const byWeek = new Map<string, number>()
  for (const r of regs) {
    const key = mondayOf(r.created_at)
    byWeek.set(key, (byWeek.get(key) ?? 0) + 1)
  }
  const now = new Date()
  const eightWeeksAgo = new Date(now.getTime() - 8 * 7 * 24 * 3600 * 1000)
  const trend = Array.from(byWeek.entries())
    .filter(([week]) => new Date(week) >= new Date(mondayOf(eightWeeksAgo)))
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([week, count]) => ({ week, count }))
  const thisWeekCount = byWeek.get(mondayOf(now)) ?? 0

  // Real association-scoped player count and venue count for the hero —
  // PlayerProfile.association_id and TrialVenue both already exist; scoped
  // the same way `cycles` is above.
  const totalPlayers = await db.playerProfile.count({
    where: unrestricted ? undefined : { association_id: { in: scope ?? [] } },
  })
  const totalVenues = cycles.reduce((sum, c) => sum + c.venues.length, 0)

  return NextResponse.json({
    cycles: cycles.map(c => ({
      id: c.id,
      age_category: c.age_category,
      dob_window_start: c.dob_window_start,
      dob_window_end: c.dob_window_end,
      registration_opens: c.registration_opens,
      registration_closes: c.registration_closes,
      status: c.status,
      venues: c.venues,
      registrations: c._count.registrations,
    })),
    trend,
    thisWeekCount,
    totalPlayers,
    totalVenues,
  })
}
