import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/require-auth'
import { canAccessSquad } from '@/lib/squad-access'

export const dynamic = 'force-dynamic'

// Advisory-only — see prisma/schema.prisma's CoachAdvisoryNote doc comment.
// This table has no relationship to Grade/Selection whatsoever; nothing
// written here can ever reach calculateAthlasXScore.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  if (!(await canAccessSquad(auth.user, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const notes = await db.coachAdvisoryNote.findMany({
    where: { squad_id: params.id },
    include: { player: { select: { id: true, full_name: true } }, coach: { select: { id: true, email: true } } },
    orderBy: { created_at: 'desc' },
  })

  return NextResponse.json({ notes })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  if (!(await canAccessSquad(auth.user, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { playerId, fitnessRating, behaviourRating, note } = await req.json()
  if (!playerId) return NextResponse.json({ error: 'playerId is required' }, { status: 400 })
  if (fitnessRating === undefined && behaviourRating === undefined && !note) {
    return NextResponse.json({ error: 'At least one of fitnessRating, behaviourRating, or note is required' }, { status: 400 })
  }

  const membership = await db.squadPlayer.findUnique({
    where: { squad_id_player_id: { squad_id: params.id, player_id: playerId } },
  })
  if (!membership) return NextResponse.json({ error: 'Player is not a member of this squad' }, { status: 400 })

  const created = await db.coachAdvisoryNote.create({
    data: {
      squad_id: params.id,
      player_id: playerId,
      coach_user_id: auth.user.id,
      fitness_rating: fitnessRating ?? undefined,
      behaviour_rating: behaviourRating ?? undefined,
      note: note ?? undefined,
    },
  })

  return NextResponse.json({ note: created })
}
