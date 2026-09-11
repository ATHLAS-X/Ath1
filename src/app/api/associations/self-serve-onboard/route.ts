import { NextRequest, NextResponse } from 'next/server'
import type { AssociationType } from '@prisma/client'
import { db } from '@/lib/db'
import { applySessionCookie, encodeSessionToken } from '@/lib/auth'
import { hashPassword, validatePasswordStrength } from '@/lib/password'
import { rateLimit } from '@/lib/rate-limit'
import { ASSOCIATION_SELF_SERVE_ENABLED } from '@/lib/feature-flags'

const ASSOCIATION_TYPES = new Set<AssociationType>(['state', 'district'])

// The public self-serve counterpart to POST /api/associations/onboard
// (which stays athlasx_ops-only — do not weaken that route or merge these
// two). This one does NOT get to skip verification the way the Ops route
// does: it creates the Association with verification_status: 'pending'
// explicitly (never relying on the schema default for this path, so the
// intent reads directly in this file rather than living only in
// schema.prisma), and — unlike the Ops route — signs the creator in
// immediately, since here the person submitting the form IS the
// association's own nominated staff member. Real association-scoped
// access is withheld until AthlasX Ops approves: see
// src/lib/association/verification-gate.ts, which every association-
// scoped route in this codebase now resolves scope through instead of
// trusting AssociationStaff membership alone.
export async function POST(req: NextRequest) {
  if (!ASSOCIATION_SELF_SERVE_ENABLED) {
    return NextResponse.json({ error: 'Association sign-up is not available yet' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const name = String(body.name ?? '').trim()
  const type = typeof body.type === 'string' && ASSOCIATION_TYPES.has(body.type as AssociationType)
    ? (body.type as AssociationType)
    : undefined
  const state = String(body.state ?? '').trim()
  const parentAssociationId = body.parentAssociationId ? String(body.parentAssociationId) : undefined
  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  const dataSharingSigned = body.dataSharingSigned === true

  if (!name || !type || !state || !email || !password) {
    return NextResponse.json({ error: 'Association identity and staff account details are required' }, { status: 400 })
  }

  const signupLimit = rateLimit('association-self-serve-signup', email, 5, 3600)
  if (!signupLimit.success) {
    return NextResponse.json({ error: 'Too many signup attempts. Please try again later.' }, { status: 429 })
  }

  const passwordError = validatePasswordStrength(password)
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 })
  }

  // Same optional-parent rule as the Ops route — never required, not
  // every district association has a parent on file yet.
  if (type === 'district' && parentAssociationId) {
    const parent = await db.association.findUnique({ where: { id: parentAssociationId }, select: { id: true, type: true } })
    if (!parent || parent.type !== 'state') {
      return NextResponse.json({ error: 'parentAssociationId must reference an existing state association' }, { status: 400 })
    }
  }

  if (!dataSharingSigned) {
    return NextResponse.json({ error: 'Data-sharing consent must be explicitly accepted to complete onboarding' }, { status: 400 })
  }

  const passwordHash = await hashPassword(password)

  try {
    const { user, association } = await db.$transaction(async (tx) => {
      const createdAssociation = await tx.association.create({
        data: {
          name,
          type,
          state,
          parent_id: type === 'district' ? parentAssociationId : undefined,
          data_sharing_signed: true,
          // Explicit, not the schema default — this is the one field this
          // whole feature exists to get right.
          verification_status: 'pending',
        },
      })

      const createdUser = await tx.user.create({
        data: {
          email,
          password_hash: passwordHash,
          role: 'association',
        },
      })

      await tx.associationStaff.create({
        data: {
          association_id: createdAssociation.id,
          user_id: createdUser.id,
          is_lead: true,
        },
      })

      return { user: createdUser, association: createdAssociation }
    })

    const res = NextResponse.json({ associationId: association.id })
    const token = await encodeSessionToken({ id: user.id, email: user.email, role: user.role })
    return applySessionCookie(res, token)
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
    }
    throw err
  }
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002'
}
