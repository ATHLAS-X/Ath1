import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/require-auth'

// Withdraws previously granted consent. Data sharing with selectors should
// stop the moment consent_status flips to 'withdrawn' — enforced by callers
// that read consent_status before surfacing a player to selectors.
//
// Previously had NO auth check at all — any caller who knew or guessed a
// claimId could withdraw consent on someone else's behalf, a real griefing/
// DoS vector (silently strip a player's visibility from selectors). Now
// self-service only: the caller must be the player who owns this claim,
// resolved the same way my-record/route.ts derives identity
// (User.linked_player_id), never a client-supplied id.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { claimId } = await req.json()
  if (!claimId) return NextResponse.json({ error: 'claimId is required' }, { status: 400 })

  const claim = await db.playerClaim.findUnique({ where: { id: claimId } })
  if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 })

  const me = await db.user.findUnique({ where: { id: auth.user.id }, select: { linked_player_id: true } })
  if (!me?.linked_player_id || me.linked_player_id !== claim.player_id) {
    return NextResponse.json({ error: 'Forbidden — not your claim' }, { status: 403 })
  }

  await db.playerClaim.update({
    where: { id: claimId },
    data: { consent_status: 'withdrawn', consent_withdrawn_at: new Date() },
  })

  await db.playerProfile.update({
    where: { id: claim.player_id },
    data: { consent_status: 'withdrawn' },
  })

  return NextResponse.json({ withdrawn: true })
}
