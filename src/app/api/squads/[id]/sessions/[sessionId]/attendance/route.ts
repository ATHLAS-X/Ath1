import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/require-auth'
import { canAccessSquad } from '@/lib/squad-access'

export const dynamic = 'force-dynamic'

// Bulk-marks attendance for a training session. Body: { records: [{playerId, present}, ...] }
export async function POST(req: NextRequest, { params }: { params: { id: string; sessionId: string } }) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  if (!(await canAccessSquad(auth.user, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const session = await db.trainingSession.findUnique({ where: { id: params.sessionId } })
  if (!session || session.squad_id !== params.id) {
    return NextResponse.json({ error: 'Training session not found for this squad' }, { status: 404 })
  }

  const { records } = await req.json()
  if (!Array.isArray(records) || records.length === 0) {
    return NextResponse.json({ error: 'records is required and must be a non-empty array' }, { status: 400 })
  }

  await db.$transaction(
    records.map((r: { playerId: string; present: boolean }) =>
      db.sessionAttendance.upsert({
        where: { training_session_id_player_id: { training_session_id: params.sessionId, player_id: r.playerId } },
        create: { training_session_id: params.sessionId, player_id: r.playerId, present: !!r.present },
        update: { present: !!r.present },
      })
    )
  )

  return NextResponse.json({ marked: records.length })
}

export async function GET(req: NextRequest, { params }: { params: { id: string; sessionId: string } }) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  if (!(await canAccessSquad(auth.user, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const attendance = await db.sessionAttendance.findMany({
    where: { training_session_id: params.sessionId },
    include: { player: { select: { id: true, full_name: true } } },
  })

  return NextResponse.json({ attendance })
}
