import { NextRequest, NextResponse } from 'next/server'
import type { AssociationVerificationStatus } from '@prisma/client'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/require-auth'

export const dynamic = 'force-dynamic'

const STATUSES = new Set<AssociationVerificationStatus>(['pending', 'approved', 'rejected'])
const DEFAULT_LIMIT = 25
const MAX_LIMIT = 50

// General association list for athlasx_ops, extending (not replacing)
// GET /api/ops/associations/pending, which stays exactly as-is for the
// existing Ops queue page. Staff appear only as a count — no staff PII.
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['athlasx_ops'])
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || DEFAULT_LIMIT, 1), MAX_LIMIT)
  const offset = Math.max(Number(searchParams.get('offset')) || 0, 0)
  const statusParam = searchParams.get('verification_status')
  const search = searchParams.get('search')?.trim()

  const where: Record<string, unknown> = {}
  if (statusParam && STATUSES.has(statusParam as AssociationVerificationStatus)) {
    where.verification_status = statusParam as AssociationVerificationStatus
  }
  if (search) {
    where.name = { contains: search, mode: 'insensitive' }
  }

  const [associations, total] = await Promise.all([
    db.association.findMany({
      where,
      select: {
        id: true,
        name: true,
        type: true,
        state: true,
        parent_id: true,
        parent: { select: { id: true, name: true } },
        verification_status: true,
        data_sharing_signed: true,
        created_at: true,
        _count: { select: { staff: true } },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    db.association.count({ where }),
  ])

  return NextResponse.json({ associations, total, limit, offset })
}
