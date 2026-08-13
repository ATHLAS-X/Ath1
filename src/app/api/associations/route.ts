import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const associations = await db.association.findMany({ select: { id: true, name: true, state: true } })
  return NextResponse.json({ associations })
}
