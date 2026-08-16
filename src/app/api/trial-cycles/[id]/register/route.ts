import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/require-auth'
import { saveTrialUpload, UploadValidationError } from '@/lib/upload'

export const dynamic = 'force-dynamic'

// Player self-registration into a trial cycle. Auth-gated (unlike the GET
// on /api/trial-cycles, which is deliberately public for browsing) since
// registering requires a known identity — the caller's own claimed player
// profile (User.linked_player_id), never a client-supplied playerId.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { id: cycleId } = await params
  const { venueId, dobProof, residencyProof, footageBatting, footageBowling, footageKeeping } = await req.json()

  if (!venueId) {
    return NextResponse.json({ error: 'venueId is required' }, { status: 400 })
  }

  const me = await db.user.findUnique({ where: { id: auth.user.id }, select: { linked_player_id: true } })
  if (!me?.linked_player_id) {
    return NextResponse.json({ error: 'No claimed player profile linked to this account — claim a profile first' }, { status: 400 })
  }

  const cycle = await db.trialCycle.findUnique({ where: { id: cycleId }, include: { venues: true } })
  if (!cycle) return NextResponse.json({ error: 'Trial cycle not found' }, { status: 404 })
  if (cycle.status !== 'registration_open') {
    return NextResponse.json({ error: 'Registration is not open for this cycle' }, { status: 409 })
  }
  const venue = cycle.venues.find(v => v.id === venueId)
  if (!venue) return NextResponse.json({ error: 'Venue does not belong to this cycle' }, { status: 400 })

  const existing = await db.registration.findFirst({
    where: { trial_cycle_id: cycleId, player_id: me.linked_player_id },
  })
  if (existing) {
    return NextResponse.json({ registration: existing, alreadyRegistered: true })
  }

  // Fee is acknowledgment-only — no payment provider is wired up anywhere in
  // this codebase (confirmed, none exists). fee_status always starts
  // 'pending'; there is no code path that can set it to 'paid' without a
  // real gateway integration, which is out of scope here.
  let documentsUploaded = false
  let footageAttached = false
  const footageUrls: string[] = []

  try {
    if (dobProof && residencyProof) {
      await saveTrialUpload(dobProof)
      await saveTrialUpload(residencyProof)
      documentsUploaded = true
    }
    for (const clip of [footageBatting, footageBowling, footageKeeping]) {
      if (clip) {
        footageUrls.push(await saveTrialUpload(clip))
      }
    }
    footageAttached = footageUrls.length > 0
  } catch (err) {
    if (err instanceof UploadValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    throw err
  }

  const registration = await db.$transaction(async (tx) => {
    if (footageUrls.length > 0) {
      await tx.playerProfile.update({
        where: { id: me.linked_player_id! },
        data: { footage_urls: { push: footageUrls } },
      })
    }
    return tx.registration.create({
      data: {
        trial_cycle_id: cycleId,
        player_id: me.linked_player_id!,
        venue_id: venueId,
        fee_status: 'pending',
        documents_uploaded: documentsUploaded,
        footage_attached: footageAttached,
      },
    })
  })

  return NextResponse.json({ registration })
}
