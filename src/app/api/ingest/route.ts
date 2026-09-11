import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requireRole } from '@/lib/require-auth'
import { resolveVerifiedAssociationScope, resolveVerifiedRequestedAssociationScope } from '@/lib/association/verification-gate'
import { resolveIngestSource } from '@/lib/ingest/registry'
import type { IngestSourceKey } from '@/lib/ingest/types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['association', 'athlasx_ops'])
  if (auth instanceof NextResponse) return auth

  // Now association-scoped — IngestJob.association_id was added as part of
  // the real-write-path work; the previous "nothing to filter on" gap is
  // closed for jobs created going forward (the 4 seed rows predate the
  // column and have association_id: null, so they show for everyone —
  // acceptable for fixture data, not a live leak).
  const scope = await resolveVerifiedAssociationScope(auth.user)
  const jobs = await db.ingestJob.findMany({
    where: scope === null ? undefined : { OR: [{ association_id: { in: scope } }, { association_id: null }] },
    orderBy: { created_at: 'desc' },
  })
  // First association the caller may submit against. The ingest page POSTs
  // this id; it is derived from AssociationStaff (or any association for
  // athlasx_ops), never from an unscoped client pick.
  const associationId = scope === null
    ? (await db.association.findFirst())?.id ?? null
    : scope[0] ?? null
  return NextResponse.json({ jobs, associationId })
}

// Submits raw data through one of the 4 source adapters, computes
// confidence, and creates an IngestJob row holding the normalized payload
// pending approval. Nothing downstream (Match/Performance/Tournament) is
// created here — that only happens on approval, see [id]/decide/route.ts.
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['association', 'athlasx_ops'])
  if (auth instanceof NextResponse) return auth

  let body: { associationId?: string; sourceKey?: string; payload?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const { associationId, sourceKey, payload } = body ?? {}
  if (!associationId || !sourceKey || !payload) {
    return NextResponse.json({ error: 'associationId, sourceKey, and payload are required' }, { status: 400 })
  }

  const scope = await resolveVerifiedRequestedAssociationScope(auth.user, associationId)
  if (scope !== null && !scope.includes(associationId)) {
    return NextResponse.json({ error: 'Forbidden — not scoped to this association' }, { status: 403 })
  }

  let source
  try {
    source = resolveIngestSource(sourceKey as IngestSourceKey)
  } catch {
    return NextResponse.json({ error: `Unknown sourceKey: ${sourceKey}` }, { status: 400 })
  }

  const { payload: normalized, confidence } = source.normalize(payload)

  const job = await db.ingestJob.create({
    data: {
      association_id: associationId,
      source: source.key,
      method: source.key,
      tournament: normalized.tournamentName,
      match_count: 1,
      player_rows: normalized.performances.length,
      status: 'pending_review',
      confidence,
      raw_payload: normalized as unknown as object,
    },
  })

  return NextResponse.json({ job })
}
