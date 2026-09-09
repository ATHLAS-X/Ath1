import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/require-auth'
import { resolveAssociationScope } from '@/lib/association-scope'

export const dynamic = 'force-dynamic'

/**
 * GET — coach accounts naming one of the caller's associations, for manual
 * review (docs/AthlasX_Pivot_Compliance_Audit_and_Role_Prompts.md Prompt
 * C-1, decision: no schema change — self-serve coach signup stays as-is,
 * but association staff get visibility into who has joined naming their
 * association, since it's currently a free dropdown pick with no
 * association-side approval step). This is read-only: there is no
 * approve/reject action, since that needs persisted state
 * (CoachProfile has no status column) that wasn't authorized. Real squad
 * access (SquadCoach) is unaffected either way — association/ops staff
 * already control that separately.
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['association', 'athlasx_ops'])
  if (auth instanceof NextResponse) return auth

  const scope = await resolveAssociationScope(auth.user)
  const coaches = await db.coachProfile.findMany({
    where: scope === null ? {} : { association_id: { in: scope } },
    include: { user: { select: { id: true, email: true } } },
    orderBy: { created_at: 'desc' },
  })

  return NextResponse.json({
    coaches: coaches.map((c) => ({
      id: c.id,
      // Added alongside the Association dashboard's coach-assignment
      // section (docs/AthlasX_Master_Data_Points_Phase1_Prompts.md) —
      // POST /api/squads/[id]/coaches needs the User.id, not
      // CoachProfile.id, to assign a coach to a squad.
      user_id: c.user.id,
      full_name: c.full_name,
      email: c.user.email,
      association_id: c.association_id,
      created_at: c.created_at.toISOString(),
    })),
  })
}
