import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const candidate = await db.academyMatchCandidate.findUnique({ where: { id: params.id } })
  if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })

  await db.academyMatchCandidate.update({
    where: { id: params.id },
    data: { status: 'rejected', reviewed_at: new Date() },
  })

  return NextResponse.json({ rejected: true })
}
