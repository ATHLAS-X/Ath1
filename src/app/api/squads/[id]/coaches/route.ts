import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/require-auth'
import { resolveVerifiedAssociationScope } from '@/lib/association/verification-gate'

export const dynamic = 'force-dynamic'

// Assigns a coach to a squad. Association-staff/ops only — a coach cannot
// self-assign to a squad (that would make canAccessSquad's own membership
// check trivially bypassable).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const squad = await db.squad.findUnique({ where: { id: params.id }, select: { association_id: true } })
  if (!squad) return NextResponse.json({ error: 'Squad not found' }, { status: 404 })

  const scope = await resolveVerifiedAssociationScope(auth.user)
  if (scope !== null && !scope.includes(squad.association_id)) {
    return NextResponse.json({ error: 'Forbidden — not scoped to this association' }, { status: 403 })
  }

  const { userId, isLead } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })

  const coach = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true } })
  if (!coach || coach.role !== 'coach') {
    return NextResponse.json({ error: 'userId must belong to a user with the coach role' }, { status: 400 })
  }

  const assignment = await db.squadCoach.upsert({
    where: { squad_id_user_id: { squad_id: params.id, user_id: userId } },
    create: { squad_id: params.id, user_id: userId, is_lead: !!isLead },
    update: { is_lead: !!isLead },
  })

  return NextResponse.json({ assignment })
}
