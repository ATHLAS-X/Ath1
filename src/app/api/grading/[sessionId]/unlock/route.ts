import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Only the session's chair_id can unlock convergence — checked server-side,
// not left to the client to decide whether to show a "Lock squad" button.
export async function POST(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const { chairId } = await req.json()
  if (!chairId) return NextResponse.json({ error: 'chairId is required' }, { status: 400 })

  const session = await db.selectionSession.findUnique({ where: { id: params.sessionId } })
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  if (session.chair_id !== chairId) {
    return NextResponse.json({ error: 'Only the committee chair can unlock convergence' }, { status: 403 })
  }
  if (session.convergence_unlocked_at) {
    return NextResponse.json({ error: 'Convergence is already unlocked' }, { status: 409 })
  }

  const updated = await db.selectionSession.update({
    where: { id: params.sessionId },
    data: { convergence_unlocked_at: new Date(), status: 'converging' },
  })

  return NextResponse.json({ convergence_unlocked_at: updated.convergence_unlocked_at })
}
