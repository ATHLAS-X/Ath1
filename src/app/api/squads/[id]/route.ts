import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/require-auth'
import { canAccessSquad } from '@/lib/squad-access'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  if (!(await canAccessSquad(auth.user, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const squad = await db.squad.findUnique({
    where: { id: params.id },
    include: {
      players: {
        include: { player: { select: { id: true, full_name: true, district: true, playing_role: true, consent_status: true } } },
      },
      coaches: {
        include: { user: { select: { id: true, email: true } } },
      },
    },
  })
  if (!squad) return NextResponse.json({ error: 'Squad not found' }, { status: 404 })

  // A player who withdrew consent must never be surfaced, even as a squad
  // member — same convention as every other player-list read path.
  const players = squad.players.filter(sp => sp.player.consent_status !== 'withdrawn')

  return NextResponse.json({
    squad: {
      id: squad.id,
      name: squad.name,
      season: squad.season,
      status: squad.status,
      players: players.map(sp => sp.player),
      coaches: squad.coaches.map(c => ({ userId: c.user_id, email: c.user.email, isLead: c.is_lead })),
    },
  })
}
