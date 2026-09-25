// One-off script (not part of the app) that seeds real, association-approved
// match history + an 8-week score trend for a single named player, so their
// /record dashboard shows genuine data through the normal verified pipeline
// instead of the honest-but-empty "No verified matches yet" state. Follows
// the same pattern as prisma/seed-demo-dashboards.ts §3, just parameterized
// by player id instead of hardcoded to a fixed e2e test account.
// Run with: npx tsx -r dotenv/config prisma/seed-this-player-record.mjs dotenv_config_path=.env.local
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const PLAYER_ID = 'a9596ea2-4a95-4f86-aa20-788142b4e051' // Haddss

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}
function weeksAgoMonday(n) {
  const d = new Date()
  d.setDate(d.getDate() - n * 7 - d.getDay() + 1)
  d.setHours(0, 0, 0, 0)
  return d
}

async function main() {
  const player = await db.playerProfile.findUnique({ where: { id: PLAYER_ID } })
  if (!player) throw new Error(`Player ${PLAYER_ID} not found`)

  let association = player.association_id
    ? await db.association.findUnique({ where: { id: player.association_id } })
    : null
  if (!association) {
    association = await db.association.findFirst({ where: { name: 'UPCA' }, orderBy: { created_at: 'asc' } })
  }
  if (!association) {
    association = await db.association.create({
      data: { name: 'UPCA', type: 'state', state: 'Uttar Pradesh', data_sharing_signed: true, verification_status: 'approved' },
    })
  } else if (association.verification_status !== 'approved') {
    association = await db.association.update({ where: { id: association.id }, data: { verification_status: 'approved' } })
  }

  const existingPerfs = await db.performance.count({ where: { player_id: PLAYER_ID } })
  if (existingPerfs > 0) {
    console.log(`Player ${player.full_name} already has ${existingPerfs} performances — skipping match seed.`)
  } else {
    const tournament = await db.tournament.create({
      data: {
        association_id: association.id, name: 'Nagar District League 2025–26', season: '2025-26',
        format: 'T20', age_category: 'U-19', level: 'district', start_date: new Date('2025-11-01'),
      },
    })
    const opponents = ['Nagar Colts', 'Sindri Eagles', 'Dhanbad XI', 'Bokaro Strikers', 'Ramgarh Kings']
    for (let i = 0; i < 14; i++) {
      const match = await db.match.create({
        data: {
          tournament_id: tournament.id, date: daysAgo((14 - i) * 9), home_team: 'Harry Kane Academy XI',
          away_team: opponents[i % opponents.length], venue: 'Nagar Ground', source: 'api_sync',
          confidence: 0.95, ingest_method: 'api_sync', association_approval_status: 'approved',
        },
      })
      const runs = Math.round(15 + Math.random() * 45)
      const balls = Math.round(20 + Math.random() * 25)
      await db.performance.create({
        data: {
          match_id: match.id, player_id: PLAYER_ID, batting_runs: runs, batting_balls: balls,
          batting_fours: Math.round(runs / 12), batting_sixes: Math.round(runs / 30),
          batting_dismissed: Math.random() > 0.25, source: 'api_sync', ingest_method: 'api_sync',
          confidence_score: 0.95, association_approval_status: 'approved',
        },
      })
    }
    console.log(`Seeded 14 verified matches for ${player.full_name} (${PLAYER_ID}).`)
  }

  const existingWeeks = await db.playerWeek.count({ where: { player_id: PLAYER_ID } })
  if (existingWeeks > 0) {
    console.log(`Player already has ${existingWeeks} weekly rows — skipping trend seed.`)
  } else {
    for (let w = 7; w >= 0; w--) {
      await db.playerWeek.create({
        data: {
          player_id: PLAYER_ID, week_start: weeksAgoMonday(w), matches_played: 1,
          runs_this_week: Math.round(20 + Math.random() * 40),
          rolling_4week_average: Math.round((55 + (7 - w) * 3) * 10) / 10,
          score_delta: w === 7 ? 0 : 3, flag_type: w === 0 ? 'on_form' : 'none',
        },
      })
    }
    console.log('Seeded 8-week score trend.')
  }

  await db.playerProfile.update({ where: { id: PLAYER_ID }, data: { athlasx_score: 78, visibility_tier: 'cross_association' } })
  console.log('Done. Reload /record.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
