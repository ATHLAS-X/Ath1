import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/require-auth'
import { resolveVerifiedAssociationScope } from '@/lib/association/verification-gate'
import { getOrGenerateDossier } from '@/lib/dossier'

export const dynamic = 'force-dynamic'

// Selection-panel-facing: dossier is lazy-generated on first view, then
// cached (Dossier is otherwise immutable — no regenerate action in v1).
//
// SECURITY FIX: this route previously called getOrGenerateDossier(registrationId)
// straight off requireAuth with no ownership check at all — any authenticated
// user of any role could read (and lazily generate) another association's
// private pre-camp dossier by guessing/enumerating a registrationId. The
// sibling list route (../route.ts) already closed this exact gap for the
// list endpoint; this detail route was missed. Mirrors that route's fix:
// resolve the registration's real trial cycle → association, and require it
// be in the caller's own verified scope. Also checks registration.trial_cycle_id
// matches the URL's cycle id, not just that SOME cycle owns it — a caller
// scoped to their own association could otherwise pass their own valid
// cycleId alongside a foreign registrationId and bypass an association-only
// check that didn't tie the two together.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; registrationId: string }> }) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { id: cycleId, registrationId } = await params

  const registration = await db.registration.findUnique({
    where: { id: registrationId },
    select: { trial_cycle_id: true, trial_cycle: { select: { association_id: true } } },
  })
  if (!registration || registration.trial_cycle_id !== cycleId) {
    return NextResponse.json({ error: 'Registration not found' }, { status: 404 })
  }

  const scope = await resolveVerifiedAssociationScope(auth.user)
  if (scope !== null && !scope.includes(registration.trial_cycle.association_id)) {
    return NextResponse.json({ error: 'Forbidden — not scoped to this association' }, { status: 403 })
  }

  const dossier = await getOrGenerateDossier(registrationId)
  if (!dossier) return NextResponse.json({ error: 'Registration not found' }, { status: 404 })

  return NextResponse.json({ dossier })
}
