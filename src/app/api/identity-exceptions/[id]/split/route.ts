import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/require-auth'
import { resolveAssociationScope } from '@/lib/association-scope'
import { AttachSnapshotMissingError, attachSkippedPerformance } from '@/lib/identity-exception-attach'

// Split: the ingested name is a new person, not any listed candidate.
// Creates an unclaimed shadow profile from the raw identity, writes the
// skipped Performance onto it, and marks the exception SPLIT.
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

  try {
    const player = await db.$transaction(async (tx) => {
      const created = await tx.playerProfile.create({
        data: {
          full_name: exception.raw_name,
          dob: exception.raw_dob ?? new Date(0),
          district: exception.raw_district ?? '',
          state: '',
          association_id: exception.association_id,
          claim_status: 'unclaimed',
          consent_status: 'not_required',
          profile_source: 'ingest',
        },
      })
      await attachSkippedPerformance(tx, exception, created.id)
      await tx.identityException.update({
        where: { id: params.id },
        data: { status: 'SPLIT', resolved_by_user_id: auth.user.id, resolved_at: new Date() },
      })
      return created
    })

    return NextResponse.json({ status: 'SPLIT', playerId: player.id })
  } catch (err) {
    if (err instanceof AttachSnapshotMissingError) {
      return NextResponse.json({ error: err.message }, { status: 422 })
    }
    throw err
  }
}
