import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/require-auth'

export const dynamic = 'force-dynamic'

// franchise_scout is intentionally not a selectable value here — it's
// hard-disabled behind FRANCHISE_SCOUT_ENABLED (see feature-flags.ts) and
// there's no scout role/route to receive that visibility on this branch yet.
// Keeping this route's own allowlist independent of the full VisibilityTier
// enum means a client can never opt a player into it just by posting the
// raw string, even if the UI never offers the option.
const SELECTABLE_TIERS = ['association_only', 'cross_association'] as const
type SelectableTier = (typeof SELECTABLE_TIERS)[number]

// Same derive-from-session pattern as the PATCH below — lets the settings
// page know the player's current tier without my-record having to carry it.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const me = await db.user.findUnique({ where: { id: auth.user.id }, select: { linked_player_id: true } })
  if (!me?.linked_player_id) return NextResponse.json({ player: null })

  const player = await db.playerProfile.findUnique({
    where: { id: me.linked_player_id },
    select: { id: true, visibility_tier: true },
  })
  return NextResponse.json({ player })
}

// A player may only ever change their OWN linked PlayerProfile's visibility
// — derived from the caller's own User.linked_player_id, exactly like
// /api/my-record, never from a client-supplied player id in the body.
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const body = await req.json().catch(() => ({}))
  const tier = body?.visibility_tier
  if (!SELECTABLE_TIERS.includes(tier)) {
    return NextResponse.json(
      { error: `visibility_tier must be one of: ${SELECTABLE_TIERS.join(', ')}` },
      { status: 400 },
    )
  }

  const me = await db.user.findUnique({ where: { id: auth.user.id }, select: { linked_player_id: true } })
  if (!me?.linked_player_id) {
    return NextResponse.json({ error: 'No player profile linked to this account' }, { status: 404 })
  }

  const player = await db.playerProfile.update({
    where: { id: me.linked_player_id },
    data: { visibility_tier: tier as SelectableTier },
    select: { id: true, visibility_tier: true },
  })

  return NextResponse.json({ player })
}
