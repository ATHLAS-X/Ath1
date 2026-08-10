import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Returns only the calling selector's own grades — never another
// selector's. This is what makes blind grading real: there is no route
// anywhere that returns all selectors' grades before convergence is
// unlocked (see convergence/route.ts, which enforces that separately).
export async function GET(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const selectorId = req.nextUrl.searchParams.get('selectorId')
  if (!selectorId) return NextResponse.json({ error: 'selectorId query param is required' }, { status: 400 })

  const grades = await db.grade.findMany({
    where: { selection_session_id: params.sessionId, selector_id: selectorId },
    select: { player_id: true, overall_grade: true, notes: true, submitted_at: true },
  })

  return NextResponse.json({ grades })
}
