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

  // Weekly tracking (W5) — 4 weeks per shadow player, one trending down
  // (triggers a form_drop TrendAlert), one trending up.
  const weekStarts = [21, 14, 7, 0].map(daysAgo => {
    const d = new Date()
    d.setDate(d.getDate() - daysAgo - d.getDay() + 1) // Monday of that week
    return d
  })

  const decliningScores = [73, 71, 68, 65]
  const risingScores = [68, 74, 77, 82]

  for (let i = 0; i < weekStarts.length; i++) {
    await db.playerWeek.create({
      data: {
        player_id: shadowPlayers[1].id, // Dev Patel — declining
        week_start: weekStarts[i],
        matches_played: 1,
        wickets_this_week: 3 - i,
        rolling_4week_average: decliningScores[i],
        score_delta: i === 0 ? 0 : decliningScores[i] - decliningScores[i - 1],
        flag_type: i === weekStarts.length - 1 ? 'form_drop' : 'none',
      },
    })
    await db.playerWeek.create({
      data: {
        player_id: shadowPlayers[0].id, // Arjun Sharma — on form
        week_start: weekStarts[i],
        matches_played: 1,
        runs_this_week: 34 + i * 18,
        rolling_4week_average: risingScores[i],
        score_delta: i === 0 ? 0 : risingScores[i] - risingScores[i - 1],
        flag_type: i === weekStarts.length - 1 ? 'on_form' : 'none',
      },
    })
  }

  await db.trendAlert.create({
    data: {
      player_id: shadowPlayers[1].id,
      triggered_at: new Date(),
      flag_type: 'form_drop',
      consecutive_declining_weeks: 3,
      skill_dimension: 'Bowling economy',
      notified_coach: true,
      notified_selector: true,
    },
  })
  await db.trendAlert.create({
    data: {
      player_id: shadowPlayers[0].id,
      triggered_at: new Date(),
      flag_type: 'on_form',
      notified_coach: false,
      notified_selector: true,
    },
  })

  // Ingest jobs (W1)
  await db.ingestJob.createMany({
    data: [
      { source: 'CricHeroes', method: 'api_sync', tournament: 'UPCA U-19 District League 2025–26', match_count: 34, player_rows: 412, status: 'pending_review', confidence: 0.97, conflicts: 3 },
      { source: 'Scorecard PDF', method: 'structured_parser', tournament: 'Kanpur District T20 Cup 2025', match_count: 12, player_rows: 148, status: 'pending_review', confidence: 0.84, conflicts: 9 },
      { source: 'CricHeroes', method: 'api_sync', tournament: 'UPCA U-16 District League 2025–26', match_count: 28, player_rows: 310, status: 'approved', confidence: 0.98, conflicts: 0 },
      { source: 'Excel Upload', method: 'excel_mapper', tournament: 'Lucknow Club T20 Series 2025', match_count: 8, player_rows: 96, status: 'rejected', confidence: 0.61, conflicts: 21 },
    ],
  })

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
