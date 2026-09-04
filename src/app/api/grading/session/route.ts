import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/require-auth'
import { resolveAssociationScope } from '@/lib/association-scope'
import { verifiedPerformancesByPlayer } from '@/lib/verified-performances'

export const dynamic = 'force-dynamic'

const sessionInclude = {
  association: {
    include: {
      players: { where: { consent_status: { not: 'withdrawn' as const } }, orderBy: { created_at: 'asc' as const } },
    },
  },
}

function serializeSession(
  session: {
    id: string
    chair_id: string
    convergence_unlocked_at: Date | null
    association: {
      players: { id: string; full_name: string; district: string; playing_role: string | null }[]
    }
  },
  callerId: string,
  performancesByPlayer: Awaited<ReturnType<typeof verifiedPerformancesByPlayer>>,
) {
  return {
    session: {
      id: session.id,
      chair_id: session.chair_id,
      convergence_unlocked_at: session.convergence_unlocked_at,
      players: session.association.players.map(p => ({
        id: p.id,
        full_name: p.full_name,
        district: p.district,
        playing_role: p.playing_role,
        performances: performancesByPlayer[p.id],
      })),
    },
    is_chair: session.chair_id === callerId,
  }
}

// Returns the most recently created selection session the caller may see,
// and its real players. is_chair is derived from the verified session so
// the grading screen can show the chair unlock control without an
// "acting as" selector picker. This route used to return every
// selection_panel user as a client-side impersonation pool; identity for
// grade/unlock/lock-squad is the caller's session, never a chosen id.
//
// AssociationStaff is the ops/staff scope. Selection-panel callers are a
// distinct identity — they often have no staff row (see convergence/
// route.ts). Without a second path, a real selector signing in sees no
// session and cannot grade as themselves. Scope them by SelectorProfile
// and by being this session's chair; never fall back to "any session".
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['selection_panel', 'association', 'athlasx_ops'])
  if (auth instanceof NextResponse) return auth

  const staffScope = await resolveAssociationScope(auth.user)
  const unrestricted = staffScope === null
  const selectorProfile = unrestricted
    ? null
    : await db.selectorProfile.findUnique({
        where: { user_id: auth.user.id },
        select: { association_id: true },
      })
  const associationIds = [
    ...(staffScope ?? []),
    ...(selectorProfile ? [selectorProfile.association_id] : []),
  ]

  const session = await db.selectionSession.findFirst({
    where: unrestricted
      ? undefined
      : {
          OR: [
            ...(associationIds.length > 0 ? [{ association_id: { in: associationIds } }] : []),
            { chair_id: auth.user.id },
          ],
        },
    orderBy: { created_at: 'desc' },
    include: sessionInclude,
  })

  if (!session) return NextResponse.json({ session: null })

  const performancesByPlayer = await verifiedPerformancesByPlayer(
    session.association.players.map(p => p.id),
  )

  return NextResponse.json(serializeSession(session, auth.user.id, performancesByPlayer))
}
