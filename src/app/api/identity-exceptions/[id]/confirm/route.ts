import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/require-auth'
import { resolveAssociationScope } from '@/lib/association-scope'

// Confirms an OPEN exception attaches to one of its own candidate_player_ids
// (or a caller-supplied playerId, still validated against the candidate
// list — never an arbitrary id). Never auto-merged; a human always confirms.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(req, ['association', 'athlasx_ops'])
  if (auth instanceof NextResponse) return auth

  const exception = await db.identityException.findUnique({ where: { id: params.id } })
  if (!exception) return NextResponse.json({ error: 'Exception not found' }, { status: 404 })
  if (exception.status !== 'OPEN') return NextResponse.json({ error: 'Exception already resolved' }, { status: 409 })

  const scope = await resolveAssociationScope(auth.user)
  if (scope !== null && !scope.includes(exception.association_id)) {
    return NextResponse.json({ error: 'Forbidden — not scoped to this association' }, { status: 403 })
  }

  const { playerId } = await req.json()
  const targetPlayerId = playerId ?? exception.candidate_player_ids[0]
  if (!targetPlayerId || !exception.candidate_player_ids.includes(targetPlayerId)) {
    return NextResponse.json({ error: 'playerId must be one of this exception\'s candidates' }, { status: 400 })
  }

  await db.identityException.update({
    where: { id: params.id },
    data: { status: 'CONFIRMED', resolved_by_user_id: auth.user.id, resolved_at: new Date() },
  })

  return NextResponse.json({ status: 'CONFIRMED', playerId: targetPlayerId })
}
