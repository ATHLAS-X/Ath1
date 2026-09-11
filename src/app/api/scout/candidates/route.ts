import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/require-auth'
import { FRANCHISE_SCOUT_ENABLED } from '@/lib/feature-flags'
import { franchiseScoutWhere } from '@/lib/player-visibility'
import { isScoutVerified } from '@/lib/scout/verification-gate'

export const dynamic = 'force-dynamic'

// Deliberately NOT the candidate_pool route's field list
// (src/app/api/candidate-pool/route.ts) — that shape is a selection
// panel's internal working view for one association's own
// SelectionSession (graded_by, flag, total_selectors are grading-workflow
// metadata, meaningless and inappropriate to hand to an external scout).
// This is a separate, deliberately smaller shape: public playing-profile
// fields only, no contact info (PlayerProfile has none of the player's own
// — guardian_phone belongs to a guardian, not the player), and no
// selection/grading internals.
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['scout', 'athlasx_ops'])
  if (auth instanceof NextResponse) return auth

  // Belt-and-suspenders with franchiseScoutWhere() itself (which already
  // degrades to an always-false clause when the flag is off) — short-
  // circuiting here too means a disabled flag returns an explicit empty
  // list rather than relying on a single query-shape to be the only thing
  // standing between "flag off" and "scout sees nobody".
  if (!FRANCHISE_SCOUT_ENABLED) return NextResponse.json({ candidates: [] })

  // Same "empty scope means see nothing" contract association-scoped
  // routes already follow (src/lib/association/verification-gate.ts) — a
  // scout whose ScoutProfile isn't yet approved gets an explicit empty
  // list here too, independent of the page-shell redirect in
  // scout/layout.tsx, in case this route is ever hit directly.
  if (!(await isScoutVerified(auth.user))) return NextResponse.json({ candidates: [] })

  const players = await db.playerProfile.findMany({
    where: {
      ...franchiseScoutWhere(),
      consent_status: { not: 'withdrawn' },
    },
    select: {
      id: true,
      full_name: true,
      dob: true,
      district: true,
      state: true,
      playing_role: true,
      batting_style: true,
      bowling_style: true,
      academy: true,
      athlasx_score: true,
      avatar_url: true,
    },
    orderBy: { athlasx_score: 'desc' },
  })

  const candidates = players.map((p) => ({
    id: p.id,
    name: p.full_name,
    age: Math.floor((Date.now() - p.dob.getTime()) / (365.25 * 24 * 3600 * 1000)),
    district: p.district,
    state: p.state,
    playing_role: p.playing_role,
    batting_style: p.batting_style,
    bowling_style: p.bowling_style,
    academy: p.academy,
    athlasx_score: p.athlasx_score,
    avatar_url: p.avatar_url,
  }))

  return NextResponse.json({ candidates })
}
