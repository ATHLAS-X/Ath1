import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/require-auth'

// Returns only the calling selector's own grades — never another
// selector's. This is what makes blind grading real: there is no route
// anywhere that returns all selectors' grades before convergence is
// unlocked (see convergence/route.ts, which enforces that separately).
// selectorId is now derived from the verified session, not a query param
// — the same class of caller-supplied-identity issue as grade/unlock.
export async function GET(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth
  const selectorId = auth.user.id

  const grades = await db.grade.findMany({
    where: { selection_session_id: params.sessionId, selector_id: selectorId },
    select: { player_id: true, overall_grade: true, notes: true, submitted_at: true },
  })

  return NextResponse.json({ grades })
}
