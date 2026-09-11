import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/require-auth'

export const dynamic = 'force-dynamic'

// athlasx_ops-only list of scout accounts awaiting verification — mirrors
// src/app/api/ops/associations/pending/route.ts. Includes the scout's own
// email since ScoutProfile is 1:1 with User (no staff join table the way
// Association has) — one row per pending scout, not a "lead" pick.
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['athlasx_ops'])
  if (auth instanceof NextResponse) return auth

  const scouts = await db.scoutProfile.findMany({
    where: { verification_status: 'pending' },
    orderBy: { created_at: 'asc' },
    include: { user: { select: { email: true } } },
  })

  return NextResponse.json({
    scouts: scouts.map((s) => ({
      id: s.id,
      orgName: s.org_name,
      orgType: s.org_type,
      contactName: s.contact_name,
      contactPhone: s.contact_phone,
      email: s.user.email,
      created_at: s.created_at,
    })),
  })
}
