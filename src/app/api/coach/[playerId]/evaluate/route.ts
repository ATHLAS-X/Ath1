import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/require-auth'

function mondayOfCurrentWeek(): Date {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d.setDate(diff))
  monday.setHours(0, 0, 0, 0)
  return monday
}

// Supervised evaluation only — fitness/behaviour ratings here are set by a
// coach viewing this form, never derived from player self-report. Upserts
// the current week's PlayerWeek row rather than overwriting history.
export async function POST(req: NextRequest, { params }: { params: { playerId: string } }) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const { fitness, behaviour, note } = await req.json()

  if (fitness !== undefined && (fitness < 1 || fitness > 5)) {
    return NextResponse.json({ error: 'fitness must be 1-5' }, { status: 400 })
  }
  if (behaviour !== undefined && (behaviour < 1 || behaviour > 5)) {
    return NextResponse.json({ error: 'behaviour must be 1-5' }, { status: 400 })
  }
  if (note !== undefined && (typeof note !== 'string' || note.length > 200)) {
    return NextResponse.json({ error: 'note must be a string of 200 characters or fewer' }, { status: 400 })
  }

  const weekStart = mondayOfCurrentWeek()

  const saved = await db.playerWeek.upsert({
    where: { player_id_week_start: { player_id: params.playerId, week_start: weekStart } },
    create: {
      player_id: params.playerId,
      week_start: weekStart,
      matches_played: 0,
      fitness_rating: fitness,
      behaviour_rating: behaviour,
      coach_note: note,
      coach_note_at: note ? new Date() : undefined,
    },
    update: {
      fitness_rating: fitness,
      behaviour_rating: behaviour,
      coach_note: note,
      coach_note_at: note ? new Date() : undefined,
    },
  })

  return NextResponse.json({ saved: true, id: saved.id })
}
