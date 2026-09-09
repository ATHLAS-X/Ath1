import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/require-auth'
import { resolveAssociationScope } from '@/lib/association-scope'

export const dynamic = 'force-dynamic'

// docs/AthlasX_Master_Data_Points_Phase1_Prompts.md L-5 — the existing
// GET /api/trial-cycles is deliberately public/unscoped (prospective
// registrants browse before having an account) and returns every
// association's cycles. There was no authenticated "my region's cycles"
// view for an association-role caller until this route. Net-new, not a
// fix to the existing endpoint — that one's public-browse contract stays
// exactly as-is.
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['association', 'athlasx_ops'])
  if (auth instanceof NextResponse) return auth

  const scope = await resolveAssociationScope(auth.user)
  const unrestricted = scope === null

  const cycles = await db.trialCycle.findMany({
    where: unrestricted ? undefined : { association_id: { in: scope ?? [] } },
    include: {
      venues: true,
      _count: { select: { registrations: true } },
    },
    orderBy: { created_at: 'desc' },
  })

  return NextResponse.json({
    cycles: cycles.map(c => ({
      id: c.id,
      age_category: c.age_category,
      dob_window_start: c.dob_window_start,
      dob_window_end: c.dob_window_end,
      registration_opens: c.registration_opens,
      registration_closes: c.registration_closes,
      status: c.status,
      venues: c.venues,
      registrations: c._count.registrations,
    })),
  })
}
