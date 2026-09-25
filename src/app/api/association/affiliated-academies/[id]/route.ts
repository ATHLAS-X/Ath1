import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'
import { resolveVerifiedAssociationScope } from '@/lib/association/verification-gate'
import { affiliatedAcademyAssociationId, updateAffiliatedAcademyStatus, removeAffiliatedAcademy } from '@/lib/association/affiliated-academies'

export const dynamic = 'force-dynamic'

/** Resolves which association owns this entry and confirms the caller may
 *  act on it, without requiring the client to send its own associationId.
 *  Returns the association_id on success, or a NextResponse to return
 *  as-is on failure — a missing id and an id scoped to someone else's
 *  association both come back as 404, never 403, so a caller can't use
 *  the response to confirm another association's entry exists. */
async function resolveOwnedEntry(auth: { user: Parameters<typeof resolveVerifiedAssociationScope>[0] }, entryId: string) {
  const associationId = await affiliatedAcademyAssociationId(entryId)
  if (!associationId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const scope = await resolveVerifiedAssociationScope(auth.user)
  if (scope !== null && !scope.includes(associationId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return associationId
}

/** PATCH — toggle an affiliated-academy entry's status (active/inactive). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { status } = await req.json()
  if (status !== 'active' && status !== 'inactive') {
    return NextResponse.json({ error: "status must be 'active' or 'inactive'" }, { status: 400 })
  }

  const resolved = await resolveOwnedEntry(auth, params.id)
  if (resolved instanceof NextResponse) return resolved

  const updated = await updateAffiliatedAcademyStatus(resolved, params.id, status)
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

/** DELETE — remove an affiliated-academy entry entirely. */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const resolved = await resolveOwnedEntry(auth, params.id)
  if (resolved instanceof NextResponse) return resolved

  const removed = await removeAffiliatedAcademy(resolved, params.id)
  if (!removed) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
