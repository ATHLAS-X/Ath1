import { NextRequest, NextResponse } from 'next/server'
import type { AssociationVerificationStatus } from '@prisma/client'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/require-auth'

const DECISIONS = new Set<AssociationVerificationStatus>(['approved', 'rejected'])

// The clearing half of the pending gate — athlasx_ops only. Deliberately
// only accepts 'approved'/'rejected' as input (never 'pending'): this
// route is for making a decision on a pending association, not for
// un-approving one after the fact — that would need its own, more
// carefully considered action (existing real access already granted would
// need to be actively revoked, not just flagged), out of scope here.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, ['athlasx_ops'])
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const decision = typeof body.verification_status === 'string' && DECISIONS.has(body.verification_status as AssociationVerificationStatus)
    ? (body.verification_status as AssociationVerificationStatus)
    : undefined
  if (!decision) {
    return NextResponse.json({ error: "verification_status must be 'approved' or 'rejected'" }, { status: 400 })
  }

  const association = await db.association.findUnique({ where: { id }, select: { id: true, verification_status: true } })
  if (!association) {
    return NextResponse.json({ error: 'Association not found' }, { status: 404 })
  }
  if (association.verification_status !== 'pending') {
    return NextResponse.json({ error: `Association is already ${association.verification_status}, not pending` }, { status: 409 })
  }

  const updated = await db.association.update({
    where: { id },
    data: { verification_status: decision },
    select: { id: true, name: true, verification_status: true },
  })

  return NextResponse.json({ association: updated })
}
