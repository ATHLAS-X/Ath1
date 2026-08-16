import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/require-auth'

// Only the session's chair_id can unlock convergence — checked server-side,
// not left to the client to decide whether to show a "Lock squad" button.
// chairId is derived from the caller's own verified session, never trusted
// from the request body — that's what let an unauthenticated caller
// unlock convergence (and read every selector's grade) just by knowing the
// chair's id.
export async function POST(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  const chairId = auth.user.id

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
