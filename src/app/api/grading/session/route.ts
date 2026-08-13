import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Returns the most recently created selection session, its real players,
// and the pool of users eligible to act as a selector — enough for the
// grading page to submit and read grades against the live database instead
// of local component state.
export async function GET() {
  const session = await db.selectionSession.findFirst({
    orderBy: { created_at: 'desc' },
    include: {
      association: { include: { players: { orderBy: { created_at: 'asc' } } } },
    },
  })

  if (!session) return NextResponse.json({ session: null })

  const selectors = await db.user.findMany({
    where: { role: 'selection_panel' },
    select: { id: true, email: true },
  })

  return NextResponse.json({
    session: {
      id: session.id,
      chair_id: session.chair_id,
      convergence_unlocked_at: session.convergence_unlocked_at,
      players: session.association.players.map(p => ({
        id: p.id,
        full_name: p.full_name,
        district: p.district,
        playing_role: p.playing_role,
      })),
    },
    selectors,
  })
}
