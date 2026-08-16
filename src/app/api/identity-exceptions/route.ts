import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/require-auth'
import { resolveAssociationScope } from '@/lib/association-scope'

export const dynamic = 'force-dynamic'

// Gated to association_staff/athlasx_ops per the auth pass's role model —
// mandatorily scoped via resolveAssociationScope, never an optional
// client-supplied associationId.
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['association', 'athlasx_ops'])
  if (auth instanceof NextResponse) return auth

  const scope = await resolveAssociationScope(auth.user)
  const exceptions = await db.identityException.findMany({
    where: scope === null ? { status: 'OPEN' } : { status: 'OPEN', association_id: { in: scope } },
    orderBy: { created_at: 'desc' },
  })

  return NextResponse.json({ exceptions })
}
