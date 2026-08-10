import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cycles = await db.trialCycle.findMany({
    include: { venues: true, _count: { select: { registrations: true } } },
    orderBy: { created_at: 'desc' },
  })

  return NextResponse.json({
    cycles: cycles.map(c => ({
      id: c.id,
      age_category: c.age_category,
      dob_window_start: c.dob_window_start,
      dob_window_end: c.dob_window_end,
      fee_amount: c.fee_amount,
      registration_opens: c.registration_opens,
      registration_closes: c.registration_closes,
      status: c.status,
      venues: c.venues,
      registrations: c._count.registrations,
      dossiers_ready: 0, // dossier generation not implemented yet
    })),
  })
}

export async function POST(req: NextRequest) {
  const { associationId, ageCategory, dobStart, dobEnd, feeAmount, regOpens, regCloses, venues } = await req.json()

  if (!associationId || !ageCategory || !dobStart || !dobEnd || !regOpens || !regCloses) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const cycle = await db.trialCycle.create({
    data: {
      association_id: associationId,
      age_category: ageCategory,
      dob_window_start: new Date(dobStart),
      dob_window_end: new Date(dobEnd),
      fee_amount: feeAmount ?? 0,
      registration_opens: new Date(regOpens),
      registration_closes: new Date(regCloses),
      status: 'registration_open',
      venues: {
        create: (venues ?? []).map((v: { name: string; district: string; date: string }) => ({
          name: v.name, district: v.district, date: new Date(v.date),
        })),
      },
    },
    include: { venues: true },
  })

  return NextResponse.json({ cycle })
}
