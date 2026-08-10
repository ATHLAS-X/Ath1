import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Withdraws previously granted consent. Data sharing with selectors should
// stop the moment consent_status flips to 'withdrawn' — enforced by callers
// that read consent_status before surfacing a player to selectors.
export async function POST(req: NextRequest) {
  const { claimId } = await req.json()
  if (!claimId) return NextResponse.json({ error: 'claimId is required' }, { status: 400 })

  const claim = await db.playerClaim.findUnique({ where: { id: claimId } })
  if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 })

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
