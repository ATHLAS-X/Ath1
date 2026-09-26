import { NextRequest, NextResponse } from 'next/server'
import type { ScoutVerificationStatus } from '@prisma/client'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/require-auth'

export const dynamic = 'force-dynamic'

const STATUSES = new Set<ScoutVerificationStatus>(['pending', 'approved', 'rejected'])
const DEFAULT_LIMIT = 25
const MAX_LIMIT = 50

// General scout list for athlasx_ops, extending (not replacing)
// GET /api/ops/scouts/pending, which stays exactly as-is for the existing
// Ops queue page.
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['athlasx_ops'])
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || DEFAULT_LIMIT, 1), MAX_LIMIT)
  const offset = Math.max(Number(searchParams.get('offset')) || 0, 0)
  const statusParam = searchParams.get('verification_status')
  const search = searchParams.get('search')?.trim()

  const where: Record<string, unknown> = {}
  if (statusParam && STATUSES.has(statusParam as ScoutVerificationStatus)) {
    where.verification_status = statusParam as ScoutVerificationStatus
  }
  if (search) {
    where.org_name = { contains: search, mode: 'insensitive' }
  }

  const [scouts, total] = await Promise.all([
    db.scoutProfile.findMany({
      where,
      select: {
        id: true,
        org_name: true,
        org_type: true,
        contact_name: true,
        verification_status: true,
        created_at: true,
        user: { select: { id: true, email: true } },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    db.scoutProfile.count({ where }),
  ])

  return NextResponse.json({ scouts, total, limit, offset })
}
