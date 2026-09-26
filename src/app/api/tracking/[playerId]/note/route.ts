import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/require-auth'
import { canAccessPlayer } from '@/lib/squad-access'

// Coach note is advisory only, 200 char max — enforced here, not just in
// the UI, since this is a value selectors read as-is.
export async function POST(req: NextRequest, { params }: { params: { playerId: string } }) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  // T-NOTE-AUTH: requireAuth alone let ANY authenticated user overwrite
  // any player's coach note — same fix as evaluate/route.ts, reusing
  // canAccessSquad's existing membership discipline via canAccessPlayer.
  if (!(await canAccessPlayer(auth.user, params.playerId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { note } = await req.json()
  if (typeof note !== 'string' || note.length > 200) {
    return NextResponse.json({ error: 'note must be a string of 200 characters or fewer' }, { status: 400 })
  }

  const latestWeek = await db.playerWeek.findFirst({
    where: { player_id: params.playerId },
    orderBy: { week_start: 'desc' },
  })
  if (!latestWeek) return NextResponse.json({ error: 'No tracking week found for this player' }, { status: 404 })

  await db.playerWeek.update({
    where: { id: latestWeek.id },
    data: { coach_note: note, coach_note_at: new Date() },
  })

  return NextResponse.json({ saved: true })
}
