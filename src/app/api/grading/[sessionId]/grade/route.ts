import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/require-auth'

// Submits (or updates) one selector's grade for one player. This is the
// actual blind-grading enforcement point: a selector can only ever write
// their OWN row (selector_id derived from the caller's own verified
// session — NEVER from the request body, which is what let anyone submit
// a grade "as" any other selector — scoped by the unique
// [session, selector, player] constraint) and this route never returns
// any other selector's grade — see mine/route.ts and convergence/route.ts
// for the read side of that boundary.
//
// T-GRADE-AUTH: requireAuth alone let ANY authenticated user (player,
// coach, staff) POST a grade — live-proved as a full privilege escalation
// into blind selection-panel grading. Selectors have no per-session or
// per-association membership row in this schema (see convergence/route.ts's
// note on the same gap) — role 'selection_panel' is the only membership
// concept that exists, so that's the enforcement boundary here.
export async function POST(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const auth = await requireRole(req, ['selection_panel'])
  if (auth instanceof NextResponse) return auth
  const selectorId = auth.user.id

  const { playerId, grade, notes } = await req.json()

  if (!playerId || !grade) {
    return NextResponse.json({ error: 'playerId and grade are required' }, { status: 400 })
  }
  if (grade < 1 || grade > 10) {
    return NextResponse.json({ error: 'grade must be between 1 and 10' }, { status: 400 })
  }

  const session = await db.selectionSession.findUnique({ where: { id: params.sessionId } })
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  if (session.convergence_unlocked_at) {
    return NextResponse.json({ error: 'Grading is closed — convergence has already been unlocked for this session' }, { status: 409 })
  }

  const saved = await db.grade.upsert({
    where: {
      selection_session_id_selector_id_player_id: {
        selection_session_id: params.sessionId,
        selector_id: selectorId,
        player_id: playerId,
      },
    },
    create: {
      selection_session_id: params.sessionId,
      selector_id: selectorId,
      player_id: playerId,
      overall_grade: grade,
      notes,
      status: 'submitted',
      submitted_at: new Date(),
    },
    update: {
      overall_grade: grade,
      notes,
      status: 'submitted',
      submitted_at: new Date(),
    },
  })

  return NextResponse.json({ id: saved.id, submitted_at: saved.submitted_at })
}
