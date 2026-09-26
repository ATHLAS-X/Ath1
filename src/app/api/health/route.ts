import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Public, unauthenticated readiness probe — uptime monitors and load
// balancers call it before any session exists. One cheap DB round trip; the
// body is deliberately two fixed strings and nothing else: no version, env
// var names, driver error text or connection detail can reach a caller.
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`
    return NextResponse.json({ status: 'ok', db: 'ok' }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ status: 'degraded', db: 'down' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
