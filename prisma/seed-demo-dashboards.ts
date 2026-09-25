// One-off script (not part of the app) that fills every role's dashboard
// with realistic dummy data, for visual QA of stats/graphs/lists after the
// mobile-design-audit session's onboarding walkthroughs. Targets the actual
// test accounts created during that walkthrough (see
// docs/AthlasX_Mobile_App_Design_Context.md) plus prisma/seed.ts's UPCA
// association/selection accounts. Idempotent-ish: re-running adds more
// rows rather than erroring, since none of this is meant to be precise —
// it only needs to make every chart/list non-empty.
// Run with: npx tsx prisma/seed-demo-dashboards.ts
import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/password'

const db = new PrismaClient()
const PW = 'Zq9vXk4mPr7wLj2'

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}
function weeksAgoMonday(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n * 7 - d.getDay() + 1)
  d.setHours(0, 0, 0, 0)
  return d
}

async function ensureUser(email: string, role: 'player' | 'coach' | 'association' | 'athlasx_ops' | 'academy_admin' | 'scout') {
  const existing = await db.user.findUnique({ where: { email } })
  if (existing) return existing
  return db.user.create({ data: { email, role, password_hash: await hashPassword(PW) } })
}

async function main() {
  // ─── 0. Resolve the association everyone hangs off ────────────────────
  let association = await db.association.findFirst({ where: { name: 'UPCA' }, orderBy: { created_at: 'asc' } })
  if (!association) {
    association = await db.association.create({
      data: { name: 'UPCA', type: 'state', state: 'Uttar Pradesh', data_sharing_signed: true, verification_status: 'approved' },
    })
  } else if (association.verification_status !== 'approved') {
    association = await db.association.update({ where: { id: association.id }, data: { verification_status: 'approved' } })
  }
  console.log('Association:', association.id, association.name)

  // ─── 1. Selection panel — chair/selector2, rich multi-player grading ──
  const chair = await ensureUser('chair@upca.example', 'selection_panel')
  const selector2 = await ensureUser('selector2@upca.example', 'selection_panel')
  for (const u of [chair, selector2]) {
    const existing = await db.selectorProfile.findUnique({ where: { user_id: u.id } })
    if (!existing) await db.selectorProfile.create({ data: { user_id: u.id, full_name: u.email.split('@')[0], association_id: association.id } })
  }

  let trialCycle = await db.trialCycle.findFirst({ where: { association_id: association.id }, orderBy: { created_at: 'asc' } })
  if (!trialCycle) {
    trialCycle = await db.trialCycle.create({
      data: {
        association_id: association.id, age_category: 'U-19',
        dob_window_start: new Date('2007-01-01'), dob_window_end: new Date('2010-12-31'),
        fee_amount: 200, registration_opens: new Date('2026-07-01'), registration_closes: new Date('2026-07-25'),
        status: 'in_progress',
      },
    })
  }

  let session = await db.selectionSession.findFirst({ where: { trial_cycle_id: trialCycle.id } })
  if (!session) {
    session = await db.selectionSession.create({
      data: { trial_cycle_id: trialCycle.id, association_id: association.id, status: 'grading', chair_id: chair.id, squad_size_target: 15 },
    })
  }
  // Unlock convergence so /convergence has real aggregated data to show.
  if (!session.convergence_unlocked_at) {
    session = await db.selectionSession.update({ where: { id: session.id }, data: { convergence_unlocked_at: new Date() } })
  }

  // 8 candidate players for the grading pool — mix of unanimous/split/contested.
  const candidateSeed = [
    { name: 'Arjun Sharma', district: 'Kanpur', role: 'Batsman' as const, grades: [8, 8] },      // unanimous high
    { name: 'Dev Patel', district: 'Agra', role: 'Bowler' as const, grades: [3, 3] },             // unanimous low
    { name: 'Rohan Verma', district: 'Lucknow', role: 'All_rounder' as const, grades: [9, 4] },   // contested
    { name: 'Vihaan Naik', district: 'Lucknow', role: 'Bowler' as const, grades: [6, 7] },        // split (close)
    { name: 'Ananya Shetty', district: 'Kanpur', role: 'Batsman' as const, grades: [7, 7] },      // unanimous
    { name: 'Kabir Rao', district: 'Varanasi', role: 'All_rounder' as const, grades: [5, 8] },    // contested
    { name: 'Tanvi Joshi', district: 'Meerut', role: 'Wicket_keeper_Batsman' as const, grades: [8, 9] }, // unanimous high
    { name: 'Sahil Khan', district: 'Kanpur', role: 'Bowler' as const, grades: [2, 3] },          // unanimous low
  ]

  const candidatePlayers: { id: string; role: string }[] = []
  for (const c of candidateSeed) {
    let p = await db.playerProfile.findFirst({ where: { full_name: c.name, district: c.district } })
    if (!p) {
      p = await db.playerProfile.create({
        data: {
          full_name: c.name, dob: new Date('2009-05-01'), district: c.district, state: 'Uttar Pradesh',
          playing_role: c.role, profile_source: 'ingest', association_id: association.id,
          claim_status: 'unclaimed', consent_status: 'not_required',
        },
      })
    }
    candidatePlayers.push({ id: p.id, role: c.role })
    for (const [i, selectorUser] of [chair, selector2].entries()) {
      const g = c.grades[i]
      await db.grade.upsert({
        where: { selection_session_id_selector_id_player_id: { selection_session_id: session.id, selector_id: selectorUser.id, player_id: p.id } },
        update: { overall_grade: g, status: 'submitted', submitted_at: new Date() },
        create: { selection_session_id: session.id, selector_id: selectorUser.id, player_id: p.id, overall_grade: g, status: 'submitted', submitted_at: new Date() },
      })
    }
  }
  console.log('Grading pool:', candidatePlayers.length, 'players, both selectors graded')

  // ─── 2. Association dashboard extras — ingest jobs, identity exceptions, tracking ──
  const ingestCount = await db.ingestJob.count({ where: { association_id: association.id } })
  if (ingestCount < 3) {
    await db.ingestJob.createMany({
      data: [
        { association_id: association.id, source: 'CricHeroes', method: 'api_sync', tournament: 'UPCA U-19 District League 2025–26', match_count: 34, player_rows: 412, status: 'pending_review', confidence: 0.97, conflicts: 3 },
        { association_id: association.id, source: 'Scorecard PDF', method: 'structured_parser', tournament: 'Kanpur District T20 Cup 2025', match_count: 12, player_rows: 148, status: 'pending_review', confidence: 0.84, conflicts: 9 },
        { association_id: association.id, source: 'CricHeroes', method: 'api_sync', tournament: 'UPCA U-16 District League 2025–26', match_count: 28, player_rows: 310, status: 'approved', confidence: 0.98, conflicts: 0 },
      ],
    })
  }

  const identityExCount = await db.identityException.count({ where: { association_id: association.id } })
  if (identityExCount < 2) {
    // IdentityException needs a Match row to reference — create a small throwaway tournament/match.
    const tRef = await db.tournament.create({
      data: { association_id: association.id, name: 'UPCA Referee Cup 2026', season: '2026', format: 'T20', age_category: 'U-19', level: 'district', start_date: new Date('2026-02-01') },
    })
    const mRef = await db.match.create({
      data: { tournament_id: tRef.id, date: new Date('2026-02-05'), home_team: 'Kanpur XI', away_team: 'Agra XI', venue: 'Green Park', source: 'excel_mapper', confidence: 0.7, ingest_method: 'excel_mapper', association_approval_status: 'pending' },
    })
    await db.identityException.createMany({
      data: [
        { match_id: mRef.id, association_id: association.id, raw_name: 'A. Sharma', raw_district: 'Kanpur', reason: 'MULTIPLE_CANDIDATES', candidate_player_ids: candidatePlayers.slice(0, 2).map(p => p.id), status: 'OPEN' },
        { match_id: mRef.id, association_id: association.id, raw_name: 'R. Verma', raw_district: 'Lucknow', reason: 'AMBIGUOUS_MATCH', candidate_player_ids: [], status: 'OPEN' },
      ],
    })
  }

  // Weekly tracking (W5) for a few of the candidate players — 8 weeks each, mixed trends.
  const trendPlayers = candidatePlayers.slice(0, 4)
  for (const [idx, p] of trendPlayers.entries()) {
    const existingWeeks = await db.playerWeek.count({ where: { player_id: p.id } })
    if (existingWeeks >= 8) continue
    const rising = idx % 2 === 0
    const base = 60 + idx * 3
    for (let w = 7; w >= 0; w--) {
      const score = rising ? base + (7 - w) * 2.5 : base + w * 2
      await db.playerWeek.create({
        data: {
          player_id: p.id, week_start: weeksAgoMonday(w), matches_played: 1,
          runs_this_week: p.role === 'Bowler' ? undefined : Math.round(20 + Math.random() * 40),
          wickets_this_week: p.role === 'Bowler' || p.role === 'All_rounder' ? Math.round(Math.random() * 3) : undefined,
          rolling_4week_average: Math.round(score * 10) / 10,
          score_delta: w === 7 ? 0 : (rising ? 2.5 : -2),
          flag_type: w === 0 ? (rising ? 'on_form' : 'form_drop') : 'none',
        },
      })
    }
    const flagType = rising ? 'on_form' : 'form_drop'
    const already = await db.trendAlert.findFirst({ where: { player_id: p.id, flag_type: flagType } })
    if (!already) {
      await db.trendAlert.create({
        data: { player_id: p.id, triggered_at: new Date(), flag_type: flagType, consecutive_declining_weeks: rising ? 0 : 3, skill_dimension: p.role === 'Bowler' ? 'Bowling economy' : 'Batting strike rate', notified_coach: true, notified_selector: true },
      })
    }
  }
  console.log('Tracking: 8-week trend for', trendPlayers.length, 'players')

  // ─── 3. Player — real verified match history for /record's graphs ─────
  const demoPlayerUser = await db.user.findUnique({ where: { email: 'e2e-mobileplayer@test.local' } })
  if (demoPlayerUser?.linked_player_id) {
    const playerId = demoPlayerUser.linked_player_id
    const existingPerfs = await db.performance.count({ where: { player_id: playerId } })
    if (existingPerfs === 0) {
      const tournament = await db.tournament.create({
        data: { association_id: association.id, name: 'UPCA U-19 District League 2025–26', season: '2025-26', format: 'T20', age_category: 'U-19', level: 'district', start_date: new Date('2025-11-01') },
      })
      const opponents = ['Agra XI', 'Varanasi Tigers', 'Lucknow XI', 'Meerut Strikers', 'Allahabad Kings']
      for (let i = 0; i < 14; i++) {
        const match = await db.match.create({
          data: {
            tournament_id: tournament.id, date: daysAgo((14 - i) * 9), home_team: 'Kanpur XI', away_team: opponents[i % opponents.length],
            venue: 'Green Park', source: 'api_sync', confidence: 0.95, ingest_method: 'api_sync', association_approval_status: 'approved',
          },
        })
        const runs = Math.round(15 + Math.random() * 45)
        const balls = Math.round(20 + Math.random() * 25)
        await db.performance.create({
          data: {
            match_id: match.id, player_id: playerId, batting_runs: runs, batting_balls: balls, batting_fours: Math.round(runs / 12),
            batting_sixes: Math.round(runs / 30), batting_dismissed: Math.random() > 0.25, source: 'api_sync', ingest_method: 'api_sync',
            confidence_score: 0.95, association_approval_status: 'approved',
          },
        })
      }
      // 8-week score trend for this player too (rolling_4week_average feeds /record's scoreTrend chart).
      const existingPlayerWeeks = await db.playerWeek.count({ where: { player_id: playerId } })
      if (existingPlayerWeeks === 0) {
        for (let w = 7; w >= 0; w--) {
          await db.playerWeek.create({
            data: { player_id: playerId, week_start: weeksAgoMonday(w), matches_played: 1, runs_this_week: Math.round(20 + Math.random() * 40), rolling_4week_average: Math.round((55 + (7 - w) * 3) * 10) / 10, score_delta: w === 7 ? 0 : 3, flag_type: w === 0 ? 'on_form' : 'none' },
          })
        }
      }
      await db.playerProfile.update({ where: { id: playerId }, data: { athlasx_score: 78, visibility_tier: 'cross_association' } })
      console.log('Player /record: 14 verified matches + 8-week trend seeded for', playerId)
    } else {
      console.log('Player /record: already has performances, skipping')
    }
  } else {
    console.log('Player e2e-mobileplayer@test.local not found or has no linked_player_id — skipping /record seed')
  }

  // ─── 4. Coach — real Squad with a roster + weekly trend ────────────────
  const coachUser = await db.user.findUnique({ where: { email: 'e2e-authflow-coach@test.local' } })
  if (coachUser) {
    let coachProfile = await db.coachProfile.findUnique({ where: { user_id: coachUser.id } })
    if (!coachProfile) {
      coachProfile = await db.coachProfile.create({ data: { user_id: coachUser.id, full_name: 'E2E Verify Coach', association_id: association.id } })
    } else {
      // coachProfile.association_id can point at a since-deleted Association
      // row from an earlier seed run — re-point it at the real one this run
      // resolved, rather than letting the stale FK break the squad create.
      const stillExists = await db.association.findUnique({ where: { id: coachProfile.association_id }, select: { id: true } })
      if (!stillExists) {
        coachProfile = await db.coachProfile.update({ where: { id: coachProfile.id }, data: { association_id: association.id } })
      }
    }
    let squad = await db.squad.findFirst({ where: { association_id: coachProfile.association_id }, orderBy: { created_at: 'asc' } })
    if (!squad) {
      squad = await db.squad.create({ data: { association_id: coachProfile.association_id, trial_cycle_id: trialCycle.id, name: 'U-19 Squad A', season: '2025-26', status: 'draft' } })
    }
    await db.squadCoach.upsert({
      where: { squad_id_user_id: { squad_id: squad.id, user_id: coachUser.id } },
      update: {}, create: { squad_id: squad.id, user_id: coachUser.id, is_lead: true },
    })
    // Put the candidate-pool players onto this squad's roster too, so the coach sees a populated, chart-backed roster.
    for (const p of candidatePlayers) {
      await db.squadPlayer.upsert({
        where: { squad_id_player_id: { squad_id: squad.id, player_id: p.id } },
        update: {}, create: { squad_id: squad.id, player_id: p.id },
      })
    }
    console.log('Coach roster: squad', squad.id, 'with', candidatePlayers.length, 'players')
  } else {
    console.log('Coach e2e-authflow-coach@test.local not found — skipping /coach seed')
  }

  // ─── 5. Academy — batches, memberships (drives player count + trend), join requests ──
  const academyAdmin = await db.user.findUnique({ where: { email: 'e2e-mobileacademy@test.local' } })
  if (academyAdmin) {
    const academy = await db.academy.findUnique({ where: { admin_user_id: academyAdmin.id } })
    if (academy) {
      const existingBatches = await db.academyBatch.count({ where: { academy_id: academy.id } })
      let batches = await db.academyBatch.findMany({ where: { academy_id: academy.id } })
      if (existingBatches === 0) {
        const created = await Promise.all([
          db.academyBatch.create({ data: { academy_id: academy.id, batch_name: 'Morning U-14', age_group: 'U-13', schedule_days: ['Mon', 'Wed', 'Fri'], schedule_time: '06:00-08:00', max_players: 20, created_by_user_id: academyAdmin.id } }),
          db.academyBatch.create({ data: { academy_id: academy.id, batch_name: 'Evening U-17', age_group: 'U-17', schedule_days: ['Tue', 'Thu', 'Sat'], schedule_time: '16:00-18:00', max_players: 18, created_by_user_id: academyAdmin.id } }),
          db.academyBatch.create({ data: { academy_id: academy.id, batch_name: 'Senior Squad', age_group: 'Senior', schedule_days: ['Sat', 'Sun'], schedule_time: '07:00-10:00', max_players: 15, created_by_user_id: academyAdmin.id } }),
        ])
        batches = created
      }
      const namePool = ['Aarav', 'Vivaan', 'Aditya', 'Krishna', 'Ishaan', 'Reyansh', 'Shaurya', 'Atharv', 'Kabir', 'Advait', 'Sai', 'Ayaan', 'Vihaan', 'Arjun', 'Rudra', 'Yuvan', 'Dhruv', 'Kian']
      let created = 0
      for (const batch of batches) {
        const already = await db.academyBatchMembership.count({ where: { batch_id: batch.id } })
        if (already >= 5) continue
        for (let i = 0; i < 6; i++) {
          const name = `${namePool[(created + i) % namePool.length]} ${['Sharma', 'Verma', 'Gupta', 'Yadav', 'Singh'][(created + i) % 5]}`
          const player = await db.playerProfile.create({
            data: {
              full_name: name, dob: new Date(2012 - Math.floor(Math.random() * 5), Math.floor(Math.random() * 12), 10),
              district: 'Kanpur', state: 'Uttar Pradesh', playing_role: ['Batsman', 'Bowler', 'All_rounder'][i % 3] as 'Batsman' | 'Bowler' | 'All_rounder',
              profile_source: 'ingest', claim_status: 'unclaimed', consent_status: 'not_required', academy: academy.name, batch_id: batch.id,
            },
          })
          await db.academyBatchMembership.create({ data: { batch_id: batch.id, player_id: player.id, status: 'active', joined_at: daysAgo(Math.floor(Math.random() * 55)) } })
          created++
        }
      }
      const joinReqCount = await db.academyJoinRequest.count({ where: { academy_id: academy.id, status: 'pending' } })
      if (joinReqCount === 0) {
        await db.academyJoinRequest.createMany({
          data: [
            { academy_id: academy.id, candidate_name: 'Rehan Ali', candidate_phone: '9812345671', candidate_dob: new Date('2013-04-12'), status: 'pending' },
            { academy_id: academy.id, candidate_name: 'Nikhil Rawat', candidate_phone: '9812345672', candidate_dob: new Date('2011-09-03'), status: 'pending' },
          ],
        })
      }
      console.log('Academy:', academy.name, '—', batches.length, 'batches,', created, 'new players enrolled')
    } else {
      console.log('No Academy row found for e2e-mobileacademy@test.local — run academy onboarding first')
    }
  } else {
    console.log('Academy admin e2e-mobileacademy@test.local not found — skipping /academy seed')
  }

  // ─── 6. Scout — approve profile + real franchise_scout-tier adult candidates ──
  const scoutUser = await db.user.findUnique({ where: { email: 'e2e-mobilescout2@test.local' } })
  if (scoutUser) {
    await db.scoutProfile.updateMany({ where: { user_id: scoutUser.id }, data: { verification_status: 'approved' } })
    const scoutCandidateSeed = [
      { name: 'Karan Mehta', district: 'Kanpur', role: 'Batsman' as const, score: 91 },
      { name: 'Aditya Rathore', district: 'Lucknow', role: 'Bowler' as const, score: 88 },
      { name: 'Yash Malhotra', district: 'Agra', role: 'All_rounder' as const, score: 85 },
      { name: 'Ravi Chauhan', district: 'Varanasi', role: 'Wicket_keeper_Batsman' as const, score: 82 },
      { name: 'Siddharth Nair', district: 'Meerut', role: 'Batsman' as const, score: 76 },
      { name: 'Manav Kapoor', district: 'Kanpur', role: 'Bowler' as const, score: 71 },
    ]
    let scoutCount = 0
    for (const s of scoutCandidateSeed) {
      const existing = await db.playerProfile.findFirst({ where: { full_name: s.name, district: s.district } })
      if (existing) continue
      await db.playerProfile.create({
        data: {
          full_name: s.name, dob: new Date('2004-06-15'), district: s.district, state: 'Uttar Pradesh',
          playing_role: s.role, profile_source: 'self_registered', claim_status: 'claimed', consent_status: 'granted',
          visibility_tier: 'franchise_scout', athlasx_score: s.score, academy: 'Tara Cricket Academy',
        },
      })
      scoutCount++
    }
    console.log('Scout pool: approved profile,', scoutCount, 'new franchise_scout candidates')
  } else {
    console.log('Scout e2e-mobilescout2@test.local not found — skipping /scout seed')
  }

  console.log('\nDone. Sign in and check:')
  console.log('  Player   e2e-mobileplayer@test.local        -> /record')
  console.log('  Coach    e2e-authflow-coach@test.local       -> /coach')
  console.log('  Academy  e2e-mobileacademy@test.local        -> /academy')
  console.log('  Scout    e2e-mobilescout2@test.local          -> /scout')
  console.log('  Assoc.   staff@upca.example (pw: athlasx-dev-password) -> /association, /dashboard, /ingest, /tracking, /identity-exceptions')
  console.log('  Selector chair@upca.example (pw: athlasx-dev-password) -> /grading, /convergence')
  console.log('  All onboarding accounts use password: Zq9vXk4mPr7wLj2')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
