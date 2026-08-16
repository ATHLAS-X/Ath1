import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/require-auth'
import { canAccessSquad } from '@/lib/squad-access'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  if (!(await canAccessSquad(auth.user, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sessions = await db.trainingSession.findMany({
    where: { squad_id: params.id },
    include: { _count: { select: { attendance: true } } },
    orderBy: { session_date: 'desc' },
  })

  return NextResponse.json({ sessions })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  if (!(await canAccessSquad(auth.user, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { sessionDate, notes } = await req.json()
  if (!sessionDate) return NextResponse.json({ error: 'sessionDate is required' }, { status: 400 })

  const session = await db.trainingSession.create({
    data: {
      squad_id: params.id,
      session_date: new Date(sessionDate),
      notes: notes ?? undefined,
      created_by: auth.user.id,
    },
  })

  return NextResponse.json({ session })
}
