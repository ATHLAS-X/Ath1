// One-off seed for the athlasx schema — creates enough real rows to exercise
// the W2 claim flow, blind grading, and W8 academy matching end to end.
// Run with: npx tsx prisma/seed.ts
import { PrismaClient } from '@prisma/client'
import { bestSimilarity } from '../src/lib/string-similarity'

const db = new PrismaClient()

async function main() {
  const association = await db.association.create({
    data: { name: 'UPCA', type: 'state', state: 'Uttar Pradesh', data_sharing_signed: true },
  })

  const chair = await db.user.create({
    data: { email: 'chair@upca.example', role: 'selection_panel' },
  })
  const selector2 = await db.user.create({
    data: { email: 'selector2@upca.example', role: 'selection_panel' },
  })

  // Shadow profiles — never logged in, exist purely from ingest
  const shadowPlayers = await Promise.all([
    db.playerProfile.create({
      data: {
        full_name: 'Arjun Sharma', dob: new Date('2009-03-14'), district: 'Kanpur', state: 'Uttar Pradesh',
        playing_role: 'Batsman', profile_source: 'ingest', association_id: association.id,
        claim_status: 'unclaimed', consent_status: 'not_required',
      },
    }),
    db.playerProfile.create({
      data: {
        full_name: 'Dev Patel', dob: new Date('2010-07-02'), district: 'Agra', state: 'Uttar Pradesh',
        playing_role: 'Bowler', profile_source: 'ingest', association_id: association.id,
        claim_status: 'unclaimed', consent_status: 'not_required',
      },
    }),
    db.playerProfile.create({
      data: {
        full_name: 'Rohan Verma', dob: new Date('2008-11-20'), district: 'Lucknow', state: 'Uttar Pradesh',
        playing_role: 'All_rounder', profile_source: 'self_registered', association_id: association.id,
        claim_status: 'claimed', consent_status: 'granted',
      },
    }),
  ])

  // Trial cycle + selection session for grading
  const trialCycle = await db.trialCycle.create({
    data: {
      association_id: association.id,
      age_category: 'U-19',
      dob_window_start: new Date('2007-01-01'),
      dob_window_end: new Date('2010-12-31'),
      fee_amount: 200,
      registration_opens: new Date('2026-07-01'),
      registration_closes: new Date('2026-07-25'),
      status: 'in_progress',
    },
  })

  const session = await db.selectionSession.create({
    data: {
      trial_cycle_id: trialCycle.id,
      association_id: association.id,
      status: 'grading',
      chair_id: chair.id,
      squad_size_target: 20,
    },
  })

  // One grade already in from the chair — demonstrates the blind boundary:
  // selector2 querying /api/grading/[id]/mine will never see this row.
  await db.grade.create({
    data: {
      selection_session_id: session.id,
      selector_id: chair.id,
      player_id: shadowPlayers[0].id,
      overall_grade: 8,
      status: 'submitted',
      submitted_at: new Date(),
    },
  })

  // Academy registry + raw ingested strings queued for W8 reconciliation
  const academy = await db.academy.create({
    data: {
      name: 'Tara Cricket Academy', name_variants: ['Tara Cricket Academy'],
      district: 'Kanpur', state: 'Uttar Pradesh', verified: true, players_at_district_plus: 4,
    },
  })

  const rawStrings = [
    { raw: 'Tara Cricket Acad., Kanpur', source: 'cricheroes' },
    { raw: 'tara cricket academy kanpur', source: 'manual' },
    { raw: 'Prime Sports Academy', source: 'excel_mapper' }, // no good match — stays unmatched
  ]

  for (const r of rawStrings) {
    const score = bestSimilarity(r.raw, academy.name, academy.name_variants)
    await db.academyMatchCandidate.create({
      data: {
        raw_string: r.raw,
        source: r.source,
        suggested_academy_id: score >= 0.55 ? academy.id : null,
        similarity_score: score,
        status: score >= 0.55 ? 'suggested' : 'unmatched',
      },
    })
  }

  console.log('Seeded:')
  console.log(`  association: ${association.id}`)
  console.log(`  chair user:  ${chair.id}`)
  console.log(`  selector2:   ${selector2.id}`)
  console.log(`  session:     ${session.id}`)
  console.log(`  players:     ${shadowPlayers.map(p => p.id).join(', ')}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
