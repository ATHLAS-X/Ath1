import { NextRequest, NextResponse } from 'next/server'
import type { AssociationType } from '@prisma/client'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/password'
import { requireRole } from '@/lib/require-auth'

const ASSOCIATION_TYPES = new Set<AssociationType>(['state', 'district'])

// Was public self-serve association onboarding — removed 2026-09-06
// (docs/AthlasX_Pivot_Compliance_Audit_and_Role_Prompts.md's Prompt A-1,
// decision: path (a)). It let anyone self-attest a "data-sharing consent"
// checkbox and immediately receive a real AssociationStaff row with the
// same privileges every association-scope.ts chokepoint trusts — inverting
// the pivot doc's W1 workflow, where AthlasX Ops verifies a signed
// data-sharing agreement first.
//
// Now an AthlasX-Ops-only internal tool (src/app/(dashboard)/ops/associations/new)
// hits this same endpoint after that verification happens offline — gated
// on requireRole(["athlasx_ops"]) rather than public. The new staff member
// is NOT signed in as themselves here (unlike the old self-serve flow,
// where the creator and the new staff account were the same person) — Ops
// creates the account, the association's own nominated staff member signs
// in separately with credentials Ops hands them.
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['athlasx_ops'])
  if (auth instanceof NextResponse) return auth

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

  // Renamed in spirit, not in wire shape: this now attests that the calling
  // Ops user has verified a real, offline-signed data-sharing agreement —
  // not that the association self-attested one. Still required explicitly,
  // still not defaulted to true.
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

    // Does NOT sign in as the new staff account (unlike the old self-serve
    // flow) — the calling user is an Ops staffer, not the association's own
    // nominated staff member. Ops hands the new staff member their
    // credentials out of band; they sign in themselves at /auth.
    return NextResponse.json({ associationId: association.id, staffUserId: user.id })
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
