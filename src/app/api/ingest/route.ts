import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const jobs = await db.ingestJob.findMany({ orderBy: { created_at: 'desc' } })
  return NextResponse.json({ jobs })
}
