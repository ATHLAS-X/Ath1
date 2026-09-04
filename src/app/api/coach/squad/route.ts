import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { calculateAthlasXScore } from '@/lib/athlasx-score'
import { dbRoleMap } from '@/lib/mock-performance-seed'
import { requireAuth } from '@/lib/require-auth'
import { canAccessSquad } from '@/lib/squad-access'
import { verifiedPerformancesByPlayer } from '@/lib/verified-performances'

export const dynamic = 'force-dynamic'

// Real fix for the long-flagged placeholder: this used to return whichever
// SelectionSession was created most recently — first association-wide
// (still wrong), then association-scoped (closer, but still "most recent
// session", not "this coach's actual squad"). Now that a real Squad model
// exists (prisma/schema.prisma — Squad/SquadCoach/SquadPlayer, W7), this
// resolves a real squad: an explicit ?squadId= is checked via
// canAccessSquad (works for both an assigned coach and association staff
// browsing a squad they oversee); with no squadId, it defaults to the
// caller's own most-recent SquadCoach membership — which only resolves for
// an actual assigned coach, not staff (staff should list squads via
// GET /api/squads and pass a specific squadId).
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const requestedSquadId = req.nextUrl.searchParams.get('squadId')

  let squadId: string | null = null
  if (requestedSquadId) {
    if (!(await canAccessSquad(auth.user, requestedSquadId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    squadId = requestedSquadId
  } else {
    const membership = await db.squadCoach.findFirst({ where: { user_id: auth.user.id }, orderBy: { created_at: 'desc' } })
    squadId = membership?.squad_id ?? null
  }

  if (!squadId) return NextResponse.json({ squad: [] })

  const squadPlayers = await db.squadPlayer.findMany({
    where: { squad_id: squadId },
    include: { player: true },
  })
  // A player who withdrew consent must never be surfaced.
  const players = squadPlayers.map(sp => sp.player).filter(p => p.consent_status !== 'withdrawn')

  const playerIds = players.map(p => p.id)
  const latestWeeks = await db.playerWeek.findMany({
    where: { player_id: { in: playerIds } },
    orderBy: { week_start: 'desc' },
  })
  const latestByPlayer = new Map<string, typeof latestWeeks[number]>()
  for (const w of latestWeeks) if (!latestByPlayer.has(w.player_id)) latestByPlayer.set(w.player_id, w)

  const perfsByPlayer = await verifiedPerformancesByPlayer(playerIds)
  const squad = players.map(p => {
    const role = dbRoleMap[p.playing_role ?? 'Batsman'] ?? 'Batsman'
    const week = latestByPlayer.get(p.id)
    const performances = perfsByPlayer[p.id]
    // coachFitnessRating/coachBehaviourRating are deprecated no-ops on
    // calculateAthlasXScore (DEFECT 1 — coach ratings no longer affect the
    // score at all). Passing them here is harmless but pointless; kept
    // only to avoid an unrelated diff. week?.fitness_rating/behaviour_rating
    // below are still shown to the coach as real display fields — a
    // different, pre-existing W5 concept from the new W7 advisory notes.
    const result = calculateAthlasXScore({ playingRole: role, performances, yearsExperience: 3 })
    const age = Math.floor((Date.now() - p.dob.getTime()) / (365.25 * 24 * 3600 * 1000))
    return {
      id: p.id,
      name: p.full_name,
      age,
      district: p.district,
      flag: week?.flag_type ?? 'none',
      athlasx_score: result.total,
      fitness_rating: week?.fitness_rating ?? undefined,
      behaviour_rating: week?.behaviour_rating ?? undefined,
      coach_note: week?.coach_note ?? undefined,
    }
  })

  return NextResponse.json({ squadId, squad })
}
