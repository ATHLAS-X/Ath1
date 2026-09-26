import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/require-auth'
import { resolveVerifiedRequestedAssociationScope } from '@/lib/association/verification-gate'
import { listAffiliatedAcademies, addAffiliatedAcademy } from '@/lib/association/affiliated-academies'

export const dynamic = 'force-dynamic'

/** GET — the caller's own association's self-reported affiliated-academy
 *  list. Same associationId-in-query pattern as POST's associationId body
 *  field — an association caller with multiple staff-membership rows can
 *  pass which one; everyone else's default (no query param) resolves to
 *  their own scope. Requires an explicit associationId for athlasx_ops,
 *  which has no scope of its own to default to. */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const associationId = req.nextUrl.searchParams.get('associationId')
  const scope = await resolveVerifiedRequestedAssociationScope(auth.user, associationId)
  if (scope === null) {
    if (!associationId) return NextResponse.json({ error: 'associationId is required' }, { status: 400 })
    return NextResponse.json({ academies: await listAffiliatedAcademies(associationId) })
  }
  if (scope.length === 0) return NextResponse.json({ academies: [] })

  const academies = await listAffiliatedAcademies(scope[0])
  return NextResponse.json({ academies })
}

/** POST — add an affiliated-academy entry. `associationId` is optional —
 *  when omitted (the normal dashboard case, which has no reason to know
 *  its own association's id), it defaults to the caller's own resolved
 *  scope, same as GET. An explicit associationId is only needed for an
 *  ops caller (unrestricted scope, nothing to default to) or a staffer
 *  belonging to more than one association.
 *  Self-reported data: no verification against any external source, and
 *  the response/UI must not imply otherwise. */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  const { academyName, contactName, contactPhone, contactEmail } = body
  let associationId: string | null = body.associationId ?? null
  if (!academyName || typeof academyName !== 'string' || !academyName.trim()) {
    return NextResponse.json({ error: 'academyName is required' }, { status: 400 })
  }

  const scope = await resolveVerifiedRequestedAssociationScope(auth.user, associationId)
  if (scope === null) {
    if (!associationId) return NextResponse.json({ error: 'associationId is required' }, { status: 400 })
  } else {
    if (scope.length === 0 || (associationId && !scope.includes(associationId))) {
      return NextResponse.json({ error: 'Forbidden — not scoped to this association' }, { status: 403 })
    }
    associationId = associationId ?? scope[0]
  }

  const academy = await addAffiliatedAcademy(associationId!, {
    academyName: academyName.trim(),
    contactName: typeof contactName === 'string' ? contactName.trim() : undefined,
    contactPhone: typeof contactPhone === 'string' ? contactPhone.trim() : undefined,
    contactEmail: typeof contactEmail === 'string' ? contactEmail.trim() : undefined,
  })
  return NextResponse.json({ academy })
}
