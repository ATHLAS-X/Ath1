import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, getSessionUser } from '@/lib/require-auth'
import { resolveRequestedAssociationScope } from '@/lib/association-scope'

export const dynamic = 'force-dynamic'

// GET is deliberately NOT auth-gated — prospective registrants need to
// browse open trial cycles before they have any account, same reasoning as
// the claim/* routes below. No PII in this response, only cycle/venue
// metadata — EXCEPT that if the caller happens to have a session with a
// linked player profile, each cycle also carries that player's own
// registration status (for the notifications feed's "status updates on
// registrations you've made"). This is the caller's own data, resolved the
// same self-only way as /api/my-record — never another player's.
export async function GET(req: NextRequest) {
  const cycles = await db.trialCycle.findMany({
    include: {
      venues: true,
      _count: { select: { registrations: true } },
      registrations: { select: { dossier: { select: { id: true } } } },
    },
    orderBy: { created_at: 'desc' },
  })

  const sessionUser = await getSessionUser(req)
  const me = sessionUser
    ? await db.user.findUnique({ where: { id: sessionUser.id }, select: { linked_player_id: true } })
    : null
  const myRegistrations = me?.linked_player_id
    ? await db.registration.findMany({
        where: { player_id: me.linked_player_id },
        select: { id: true, trial_cycle_id: true, fee_status: true, checked_in: true },
      })
    : []
  const myRegistrationByCycle = new Map(myRegistrations.map((r) => [r.trial_cycle_id, r]))

  return NextResponse.json({
    cycles: cycles.map(c => ({
      id: c.id,
      age_category: c.age_category,
      dob_window_start: c.dob_window_start,
      dob_window_end: c.dob_window_end,
      fee_amount: c.fee_amount,
      registration_opens: c.registration_opens,
      registration_closes: c.registration_closes,
      status: c.status,
      venues: c.venues,
      registrations: c._count.registrations,
      // Real count of registrations with a generated dossier (was
      // hardcoded to 0 — dossier generation now exists, see lib/dossier.ts).
      // Dossiers are lazy-generated on first view, so this reflects "already
      // viewed at least once", not "all eligible have been pre-generated" —
      // there is no background job to pre-generate every dossier up front.
      dossiers_ready: c.registrations.filter(r => r.dossier !== null).length,
      myRegistration: myRegistrationByCycle.get(c.id) ?? null,
    })),
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { associationId, ageCategory, dobStart, dobEnd, feeAmount, regOpens, regCloses, venues } = await req.json()

  if (!associationId || !ageCategory || !dobStart || !dobEnd || !regOpens || !regCloses) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // associationId is client-supplied — never trust it directly. It's only
  // honoured if the caller's own AssociationStaff membership actually
  // covers it (or the caller is athlasx_ops).
  const scope = await resolveRequestedAssociationScope(auth.user, associationId)
  if (scope !== null && !scope.includes(associationId)) {
    return NextResponse.json({ error: 'Forbidden — not scoped to this association' }, { status: 403 })
  }

  const cycle = await db.trialCycle.create({
    data: {
      association_id: associationId,
      age_category: ageCategory,
      dob_window_start: new Date(dobStart),
      dob_window_end: new Date(dobEnd),
      fee_amount: feeAmount ?? 0,
      registration_opens: new Date(regOpens),
      registration_closes: new Date(regCloses),
      status: 'registration_open',
      venues: {
        create: (venues ?? []).map((v: { name: string; district: string; date: string }) => ({
          name: v.name, district: v.district, date: new Date(v.date),
        })),
      },
    },
    include: { venues: true },
  })

  return NextResponse.json({ cycle })
}
