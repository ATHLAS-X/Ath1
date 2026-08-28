import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/require-auth'

// Locks the final squad: creates one immutable Selection row per chosen
// player and moves the session to 'locked'. Only the chair may call this,
// and only after convergence has been unlocked. chairId is derived from
// the caller's own verified session, not the request body.
export async function POST(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const auth = await requireRole(req, ['selection_panel'])
  if (auth instanceof NextResponse) return auth
  const chairId = auth.user.id

  const { playerIds } = await req.json()
  if (!Array.isArray(playerIds) || playerIds.length === 0) {
    return NextResponse.json({ error: 'a non-empty playerIds array is required' }, { status: 400 })
  }

  const session = await db.selectionSession.findUnique({ where: { id: params.sessionId } })
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  if (session.chair_id !== chairId) {
    return NextResponse.json({ error: 'Only the committee chair can lock the squad' }, { status: 403 })
  }
  if (!session.convergence_unlocked_at) {
    return NextResponse.json({ error: 'Convergence must be unlocked before locking the squad' }, { status: 409 })
  }
  if (session.squad_locked_at) {
    return NextResponse.json({ error: 'Squad is already locked' }, { status: 409 })
  }

  await db.$transaction([
    ...playerIds.map((playerId: string) =>
      db.selection.create({
        data: {
          selection_session_id: params.sessionId,
          player_id: playerId,
          rationale: 'Selected via committee convergence',
          decided_at: new Date(),
          decided_by: [chairId],
        },
      })
    ),
    db.selectionSession.update({
      where: { id: params.sessionId },
      data: { status: 'locked', squad_locked_at: new Date() },
    }),
  ])

  return NextResponse.json({ locked: true, count: playerIds.length })
}
