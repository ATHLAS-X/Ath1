import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/require-auth'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if (auth instanceof NextResponse) return auth

  const candidate = await db.academyMatchCandidate.findUnique({ where: { id: params.id } })
  if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })

  await db.academyMatchCandidate.update({
    where: { id: params.id },
    data: { status: 'rejected', reviewed_at: new Date() },
  })

  return NextResponse.json({ rejected: true })
}
