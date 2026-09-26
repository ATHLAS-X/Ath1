import { NextRequest, NextResponse } from 'next/server'
import type { UserRole } from '@prisma/client'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/require-auth'

export const dynamic = 'force-dynamic'

const ROLES = new Set<UserRole>(['player', 'selection_panel', 'coach', 'association', 'athlasx_ops', 'academy_admin', 'scout'])
const DEFAULT_LIMIT = 25
const MAX_LIMIT = 50

// athlasx_ops-only read list of user accounts. Explicit field allowlist via
// `select` — never a bare findMany — so password_hash can never leak through
// this route even if the User model gains more sensitive columns later.
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['athlasx_ops'])
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || DEFAULT_LIMIT, 1), MAX_LIMIT)
  const offset = Math.max(Number(searchParams.get('offset')) || 0, 0)
  const roleParam = searchParams.get('role')
  const search = searchParams.get('search')?.trim()

  const where: Record<string, unknown> = {}
  if (roleParam && ROLES.has(roleParam as UserRole)) {
    where.role = roleParam as UserRole
  }
  if (search) {
    where.email = { contains: search, mode: 'insensitive' }
  }

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        role: true,
        linked_player_id: true,
        linked_staff_id: true,
        created_at: true,
        player_profile: { select: { id: true, full_name: true, claim_status: true } },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    db.user.count({ where }),
  ])

  return NextResponse.json({ users, total, limit, offset })
}
