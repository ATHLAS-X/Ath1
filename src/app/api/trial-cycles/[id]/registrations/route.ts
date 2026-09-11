import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/require-auth'
import { resolveVerifiedAssociationScope } from '@/lib/association/verification-gate'

export const dynamic = 'force-dynamic'

// Selection-panel-facing list of registrants for a cycle, browsable per
// venue (matches the dossier list→detail split used elsewhere in this app).
//
// Deliberately NOT filtered by visibility_tier: registering for a trial
// cycle is a player's own action directed at the association running it,
// unlike passive cross-association browsing — a registrant should always
// be visible to the association whose cycle they registered for, whatever
// visibility_tier their home profile carries (same reasoning as
// claim/search's exemption). What IS checked: the cycle itself must belong
// to the caller's own association — this was previously missing entirely,
// letting any authenticated staff view any other association's private
// registrant list just by guessing/enumerating a cycleId.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { id: cycleId } = await params

  const cycle = await db.trialCycle.findUnique({ where: { id: cycleId }, select: { association_id: true } })
  if (!cycle) return NextResponse.json({ error: 'Trial cycle not found' }, { status: 404 })

  const scope = await resolveVerifiedAssociationScope(auth.user)
  if (scope !== null && !scope.includes(cycle.association_id)) {
    return NextResponse.json({ error: 'Forbidden — not scoped to this association' }, { status: 403 })
  }

  const venueId = req.nextUrl.searchParams.get('venueId')

  const registrations = await db.registration.findMany({
    where: { trial_cycle_id: cycleId, ...(venueId ? { venue_id: venueId } : {}) },
    include: {
      player: { select: { id: true, full_name: true, playing_role: true, district: true } },
      venue: { select: { id: true, name: true } },
      dossier: { select: { id: true, has_match_history: true } },
    },
    orderBy: { created_at: 'desc' },
  })

  return NextResponse.json({ registrations })
}
