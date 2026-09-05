import { NextRequest, NextResponse } from 'next/server'
import type { AssociationType } from '@prisma/client'
import { db } from '@/lib/db'
import { applySessionCookie, encodeSessionToken } from '@/lib/auth'
import { hashPassword } from '@/lib/password'

const ASSOCIATION_TYPES = new Set<AssociationType>(['state', 'district'])

// Self-serve association onboarding — the first real path to creating an
// Association row and its first AssociationStaff member. Previously
// associations existed only as seeded rows (prisma/seed.ts) with staff
// membership inserted directly — there was no application-level way to
// create either. Signs the new staff member in the same way
// claim/verify and player/onboard already do (encodeSessionToken +
// applySessionCookie), not a third session-minting mechanism.
export async function POST(req: NextRequest) {
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

  // No `name` field exists on the User model anywhere in this schema
  // (checked directly) — email is the only identifying field a staff
  // account carries today, so a display name is deliberately not
  // collected here rather than accepted and silently discarded.
  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')

  const dataSharingSigned = body.dataSharingSigned === true

  if (!name || !type || !state || !email || !password) {
    return NextResponse.json({ error: 'Association identity and staff account details are required' }, { status: 400 })
  }
  // Type 'district' may optionally nest under a parent state association —
  // never required, since not every district association has one on file
  // yet (per docs/AthlasX_System_Design_and_Functionality_Reference.md,
  // UP alone has ~40 district associations, many pre-dating this platform).
  if (type === 'district' && parentAssociationId) {
    const parent = await db.association.findUnique({ where: { id: parentAssociationId }, select: { id: true, type: true } })
    if (!parent || parent.type !== 'state') {
      return NextResponse.json({ error: 'parentAssociationId must reference an existing state association' }, { status: 400 })
    }
  }

  // This is the literal field the pivot document's own validation backlog
  // names as blocking everything ("Will an association actually share? ...
  // blocks: everything") — it must be an explicit, informed agreement, not
  // a decorative checkbox defaulted to true.
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
