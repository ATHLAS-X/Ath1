import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/require-auth'

export const dynamic = 'force-dynamic'

// athlasx_ops-only list of associations awaiting verification — the other
// half of the self-serve pending gate (src/lib/association/verification-gate.ts
// withholds access; this is how Ops actually clears it). Includes each
// association's lead staff email so Ops has something to act on besides a
// bare association name.
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['athlasx_ops'])
  if (auth instanceof NextResponse) return auth

  const associations = await db.association.findMany({
    where: { verification_status: 'pending' },
    orderBy: { created_at: 'asc' },
    include: {
      staff: {
        where: { is_lead: true },
        include: { user: { select: { email: true } } },
        take: 1,
      },
    },
  })

  return NextResponse.json({
    associations: associations.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      state: a.state,
      leadStaffEmail: a.staff[0]?.user.email ?? null,
      created_at: a.created_at,
    })),
  })
}
