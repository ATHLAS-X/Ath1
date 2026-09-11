import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/require-auth'
import { resolveVerifiedAssociationScope } from '@/lib/association/verification-gate'
import { verifiedPerformancesByPlayer } from '@/lib/verified-performances'

export const dynamic = 'force-dynamic'

const sessionInclude = {
  association: {
    include: {
      players: { where: { consent_status: { not: 'withdrawn' as const } }, orderBy: { created_at: 'asc' as const } },
    },
  },
}

interface AdvisoryContext {
  latest_note: { note: string | null; fitness_rating: number | null; behaviour_rating: number | null; created_at: Date } | null
  trend_flag: string
}

function serializeSession(
  session: {
    id: string
    chair_id: string
    convergence_unlocked_at: Date | null
    association: {
      players: { id: string; full_name: string; district: string; playing_role: string | null }[]
    }
  },
  callerId: string,
  performancesByPlayer: Awaited<ReturnType<typeof verifiedPerformancesByPlayer>>,
  advisoryByPlayer: Record<string, AdvisoryContext>,
) {
  return {
    session: {
      id: session.id,
      chair_id: session.chair_id,
      convergence_unlocked_at: session.convergence_unlocked_at,
      players: session.association.players.map(p => ({
        id: p.id,
        full_name: p.full_name,
        district: p.district,
        playing_role: p.playing_role,
        performances: performancesByPlayer[p.id],
        // Read-only coach/trend context — see athlasx-score.ts's DEFECT 1
        // header comment. Never fed into calculateAthlasXScore or any
        // grade field; advisory-only, same as /tracking's DeepView.
        advisory: advisoryByPlayer[p.id] ?? { latest_note: null, trend_flag: 'none' },
      })),
    },
    is_chair: session.chair_id === callerId,
  }
}

// Returns the most recently created selection session the caller may see,
// and its real players. is_chair is derived from the verified session so
// the grading screen can show the chair unlock control without an
// "acting as" selector picker. This route used to return every
// selection_panel user as a client-side impersonation pool; identity for
// grade/unlock/lock-squad is the caller's session, never a chosen id.
//
// AssociationStaff is the ops/staff scope. Selection-panel callers are a
// distinct identity — they often have no staff row (see convergence/
// route.ts). Without a second path, a real selector signing in sees no
// session and cannot grade as themselves. Scope them by SelectorProfile
// and by being this session's chair; never fall back to "any session".
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['selection_panel', 'association', 'athlasx_ops'])
  if (auth instanceof NextResponse) return auth

  const staffScope = await resolveVerifiedAssociationScope(auth.user)
  const unrestricted = staffScope === null
  const selectorProfile = unrestricted
    ? null
    : await db.selectorProfile.findUnique({
        where: { user_id: auth.user.id },
        select: { association_id: true },
      })
  const associationIds = [
    ...(staffScope ?? []),
    ...(selectorProfile ? [selectorProfile.association_id] : []),
  ]

  const session = await db.selectionSession.findFirst({
    where: unrestricted
      ? undefined
      : {
          OR: [
            ...(associationIds.length > 0 ? [{ association_id: { in: associationIds } }] : []),
            { chair_id: auth.user.id },
          ],
        },
    orderBy: { created_at: 'desc' },
    include: sessionInclude,
  })

  if (!session) return NextResponse.json({ session: null })

  const playerIds = session.association.players.map(p => p.id)
  const performancesByPlayer = await verifiedPerformancesByPlayer(playerIds)

  // Advisory context — read-only, never touches scoring. Most recent
  // CoachAdvisoryNote per player (any squad) and the latest TrendAlert's
  // flag_type, same "most recent row wins" convention /api/tracking uses.
  const [notes, alerts] = await Promise.all([
    db.coachAdvisoryNote.findMany({
      where: { player_id: { in: playerIds } },
      orderBy: { created_at: 'desc' },
      select: { player_id: true, note: true, fitness_rating: true, behaviour_rating: true, created_at: true },
    }),
    db.trendAlert.findMany({
      where: { player_id: { in: playerIds } },
      orderBy: { triggered_at: 'desc' },
      select: { player_id: true, flag_type: true },
    }),
  ])
  const advisoryByPlayer: Record<string, AdvisoryContext> = {}
  for (const id of playerIds) {
    const latestNote = notes.find(n => n.player_id === id) ?? null
    const latestAlert = alerts.find(a => a.player_id === id)
    advisoryByPlayer[id] = {
      latest_note: latestNote
        ? { note: latestNote.note, fitness_rating: latestNote.fitness_rating, behaviour_rating: latestNote.behaviour_rating, created_at: latestNote.created_at }
        : null,
      trend_flag: latestAlert?.flag_type ?? 'none',
    }
  }

  return NextResponse.json(serializeSession(session, auth.user.id, performancesByPlayer, advisoryByPlayer))
}
