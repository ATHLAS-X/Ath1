import { NextRequest, NextResponse } from 'next/server'
import type { ScoutVerificationStatus } from '@prisma/client'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/require-auth'

const DECISIONS = new Set<ScoutVerificationStatus>(['approved', 'rejected'])

// The clearing half of the scout pending gate — athlasx_ops only. Mirrors
// src/app/api/ops/associations/[id]/verification/route.ts exactly,
// including the same deliberate restriction: only 'approved'/'rejected'
// as input, never 'pending' — this route decides a pending scout, it
// doesn't un-approve one after the fact.
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

  const decision = typeof body.verification_status === 'string' && DECISIONS.has(body.verification_status as ScoutVerificationStatus)
    ? (body.verification_status as ScoutVerificationStatus)
    : undefined
  if (!decision) {
    return NextResponse.json({ error: "verification_status must be 'approved' or 'rejected'" }, { status: 400 })
  }

  const scout = await db.scoutProfile.findUnique({ where: { id }, select: { id: true, verification_status: true } })
  if (!scout) {
    return NextResponse.json({ error: 'Scout profile not found' }, { status: 404 })
  }
  if (scout.verification_status !== 'pending') {
    return NextResponse.json({ error: `Scout is already ${scout.verification_status}, not pending` }, { status: 409 })
  }

  const updated = await db.scoutProfile.update({
    where: { id },
    data: { verification_status: decision },
    select: { id: true, org_name: true, verification_status: true },
  })

  return NextResponse.json({ scout: updated })
}
