import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/require-auth'
import { resolveVerifiedAssociationScope } from '@/lib/association/verification-gate'
import { AttachSnapshotMissingError, attachSkippedPerformance } from '@/lib/identity-exception-attach'

// Merge: attach the skipped row onto an explicit surviving candidate.
// Does not move or rewrite either player's existing Performance history —
// only the new snapshot is written.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(req, ['association', 'athlasx_ops'])
  if (auth instanceof NextResponse) return auth

  const exception = await db.identityException.findUnique({ where: { id: params.id } })
  if (!exception) return NextResponse.json({ error: 'Exception not found' }, { status: 404 })
  if (exception.status !== 'OPEN') return NextResponse.json({ error: 'Exception already resolved' }, { status: 409 })

  const scope = await resolveVerifiedAssociationScope(auth.user)
  if (scope !== null && !scope.includes(exception.association_id)) {
    return NextResponse.json({ error: 'Forbidden — not scoped to this association' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const targetPlayerId = body?.playerId
  if (!targetPlayerId || !exception.candidate_player_ids.includes(targetPlayerId)) {
    return NextResponse.json({ error: 'playerId must be one of this exception\'s candidates' }, { status: 400 })
  }

  try {
    await db.$transaction(async (tx) => {
      await attachSkippedPerformance(tx, exception, targetPlayerId)
      await tx.identityException.update({
        where: { id: params.id },
        data: { status: 'MERGED', resolved_by_user_id: auth.user.id, resolved_at: new Date() },
      })
    })
  } catch (err) {
    if (err instanceof AttachSnapshotMissingError) {
      return NextResponse.json({ error: err.message }, { status: 422 })
    }
    throw err
  }

  return NextResponse.json({ status: 'MERGED', playerId: targetPlayerId })
}
