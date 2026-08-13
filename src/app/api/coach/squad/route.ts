import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { calculateAthlasXScore } from '@/lib/athlasx-score'
import { dbRoleMap, seedPerformances } from '@/lib/mock-performance-seed'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await db.selectionSession.findFirst({
    orderBy: { created_at: 'desc' },
    include: { association: { include: { players: true } } },
  })
  if (!session) return NextResponse.json({ squad: [] })

  const playerIds = session.association.players.map(p => p.id)
  const latestWeeks = await db.playerWeek.findMany({
    where: { player_id: { in: playerIds } },
    orderBy: { week_start: 'desc' },
  })
  const latestByPlayer = new Map<string, typeof latestWeeks[number]>()
  for (const w of latestWeeks) if (!latestByPlayer.has(w.player_id)) latestByPlayer.set(w.player_id, w)

  const squad = session.association.players.map(p => {
    const role = dbRoleMap[p.playing_role ?? 'Batsman'] ?? 'Batsman'
    const week = latestByPlayer.get(p.id)
    const performances = seedPerformances(p.id, role)
    const result = calculateAthlasXScore({
      playingRole: role,
      performances,
      yearsExperience: 3,
      coachFitnessRating: week?.fitness_rating ?? undefined,
      coachBehaviourRating: week?.behaviour_rating ?? undefined,
    })
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

  return NextResponse.json({ squad })
}
