import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/require-auth'
import { resolveAssociationScope } from '@/lib/association-scope'

// Aggregates every selector's grade per player into a ConvergenceView
// (src/types/index.ts). Refuses to return anything until the chair has
// unlocked convergence — the server-side half of the blind-grading
// guarantee (grade.ts enforces the write side).
export async function GET(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const session = await db.selectionSession.findUnique({ where: { id: params.sessionId } })
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  // sessionId is caller-supplied — previously any authenticated caller
  // could read ANY other association's convergence view just by guessing/
  // enumerating a sessionId. Never trust it without checking it against
  // the caller's own association membership OR the caller's own
  // relationship to this specific session.
  //
  // Association-staff membership (resolveAssociationScope) is the right
  // check for ops/staff routes, but the real callers of THIS route are
  // selection-panel chairs and selectors (role 'selection_panel') — a
  // distinct identity concept in this schema that has no AssociationStaff
  // row of its own (see the same caveat already flagged on coach/squad).
  // Requiring AssociationStaff membership here would lock out every
  // legitimate chair/selector, so the check accepts either: staff/ops
  // scoped to this association, OR the caller is this session's chair, OR
  // the caller has actually submitted a grade in this session (proving
  // they were a real participant on this panel, not just any authenticated
  // user guessing a sessionId).
  const scope = await resolveAssociationScope(auth.user)
  const isScopedStaff = scope === null || scope.includes(session.association_id)
  if (!isScopedStaff) {
    const isChair = session.chair_id === auth.user.id
    const isParticipatingSelector = !isChair && (await db.grade.findFirst({
      where: { selection_session_id: params.sessionId, selector_id: auth.user.id },
      select: { id: true },
    })) !== null
    if (!isChair && !isParticipatingSelector) {
      return NextResponse.json({ error: 'Forbidden — not scoped to this association' }, { status: 403 })
    }
  }

  if (!session.convergence_unlocked_at) {
    return NextResponse.json({ error: 'Convergence has not been unlocked by the chair yet' }, { status: 403 })
  }

  const grades = await db.grade.findMany({
    where: { selection_session_id: params.sessionId },
    select: { player_id: true, overall_grade: true },
  })

  const byPlayer = new Map<string, number[]>()
  for (const g of grades) {
    const list = byPlayer.get(g.player_id) ?? []
    list.push(g.overall_grade)
    byPlayer.set(g.player_id, list)
  }

  const players = await db.playerProfile.findMany({
    where: { id: { in: Array.from(byPlayer.keys()) } },
    select: { id: true, full_name: true, district: true },
  })
  const playerById = new Map(players.map(p => [p.id, p]))

  const views = Array.from(byPlayer.entries()).map(([player_id, list]) => {
    const average = list.reduce((a, b) => a + b, 0) / list.length
    const distribution: Record<string, number> = {}
    for (const g of list) distribution[g] = (distribution[g] ?? 0) + 1
    const spread = Math.max(...list) - Math.min(...list)
    const consensus = spread <= 1 ? 'unanimous' : spread <= 3 ? 'split' : 'contested'
    const player = playerById.get(player_id)
    return {
      player_id,
      name: player?.full_name ?? 'Unknown',
      district: player?.district ?? '',
      grades: list,
      average,
      distribution,
      consensus,
    }
  })

  return NextResponse.json({ views, alreadySelected: (await db.selection.findMany({
    where: { selection_session_id: params.sessionId },
    select: { player_id: true },
  })).map(s => s.player_id) })
}
