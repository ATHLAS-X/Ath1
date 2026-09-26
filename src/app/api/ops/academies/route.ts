import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/require-auth'

export const dynamic = 'force-dynamic'

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 50

// athlasx_ops read list of the Academy registry: identity, verified flag,
// admin ownership, player count. Distinct from the academy-matching
// reconciliation queue (raw ingested strings, not the registry itself).
// The linked admin user is exposed by id and email only.
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['athlasx_ops'])
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || DEFAULT_LIMIT, 1), MAX_LIMIT)
  const offset = Math.max(Number(searchParams.get('offset')) || 0, 0)
  const verifiedParam = searchParams.get('verified')
  const search = searchParams.get('search')?.trim()

  const where: Record<string, unknown> = {}
  if (verifiedParam === 'true' || verifiedParam === 'false') {
    where.verified = verifiedParam === 'true'
  }
  if (search) {
    where.name = { contains: search, mode: 'insensitive' }
  }

  const [academies, total] = await Promise.all([
    db.academy.findMany({
      where,
      select: {
        id: true,
        name: true,
        district: true,
        state: true,
        verified: true,
        players_at_district_plus: true,
        admin_user_id: true,
        admin: { select: { id: true, email: true } },
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    db.academy.count({ where }),
  ])

  return NextResponse.json({ academies, total, limit, offset })
}
