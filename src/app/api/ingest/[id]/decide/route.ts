import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { decision } = await req.json()
  if (decision !== 'approved' && decision !== 'rejected') {
    return NextResponse.json({ error: 'decision must be "approved" or "rejected"' }, { status: 400 })
  }

  const job = await db.ingestJob.findUnique({ where: { id: params.id } })
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  if (job.status !== 'pending_review') {
    return NextResponse.json({ error: 'Job is not pending review' }, { status: 409 })
  }

  const updated = await db.ingestJob.update({
    where: { id: params.id },
    data: { status: decision, reviewed_at: new Date() },
  })

  return NextResponse.json({ job: updated })
}
