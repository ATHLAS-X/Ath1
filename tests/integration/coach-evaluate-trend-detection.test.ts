/**
 * Integration — POST /api/coach/[playerId]/evaluate must compute a real
 * weekly score (rolling_4week_average/score_delta) and detect real
 * consecutive-decline streaks, writing a TrendAlert row for them — not
 * leave those fields for prisma/seed.ts to hand-write forever, which was
 * the actual bug: rolling_4week_average/score_delta/flag_type had no live
 * write path anywhere in src/ before this fix, so every "trend" UI
 * reading them (Coach's roster trend, Player's score trend, Association's
 * tracked-players delta, this route's own consumers) was frozen at
 * whatever the seed happened to contain.
 *
 * Each seeded player has zero verified match performances, so
 * calculateAthlasXScore reliably computes a low current score — real
 * previous weeks are seeded with a deliberately high rolling_4week_average
 * so the delta against them is reliably negative, without needing to
 * fabricate a precise target score.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { testDb, resetDb, assertIsTestSchema } from '../helpers/test-db'
import { postAsUser } from '../helpers/auth'

vi.mock('@/lib/db', async () => ({
  db: (await import('../helpers/test-db')).testDb,
}))

const { POST: evaluate } = await import('@/app/api/coach/[playerId]/evaluate/route')

beforeAll(async () => { await assertIsTestSchema() })
beforeEach(async () => { await resetDb() })
afterAll(async () => { await resetDb(); await testDb.$disconnect() })

function mondayOfCurrentWeek(): Date {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d)
  monday.setDate(diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function weeksAgo(n: number): Date {
  const monday = mondayOfCurrentWeek()
  monday.setDate(monday.getDate() - n * 7)
  return monday
}

async function seedPlayer(label: string) {
  return testDb.playerProfile.create({
    data: {
      full_name: `Trend ${label} Player`, dob: new Date('2005-01-01'), district: 'Test District', state: 'Uttar Pradesh',
      claim_status: 'unclaimed', consent_status: 'not_required', profile_source: 'ingest',
    },
  })
}

async function postEvaluate(playerId: string, coachUserId: string) {
  return evaluate(
    await postAsUser('http://test.local/api', coachUserId, 'coach', { note: 'weekly check-in' }),
    { params: { playerId } },
  )
}

describe('POST /api/coach/[playerId]/evaluate — real weekly score + trend detection', () => {
  it('writes a real rolling_4week_average/score_delta on every save, not just the seed', async () => {
    const player = await seedPlayer('basic')
    const coach = await testDb.user.create({ data: { email: 'coach-basic@test.local', role: 'coach', password_hash: 'x' } })

    const res = await postEvaluate(player.id, coach.id)
    expect(res.status).toBe(200)

    const week = await testDb.playerWeek.findUniqueOrThrow({
      where: { player_id_week_start: { player_id: player.id, week_start: mondayOfCurrentWeek() } },
    })
    expect(week.rolling_4week_average).not.toBeNull()
    expect(week.score_delta).toBe(0) // no prior week to compare against yet
  })

  it('flags form_drop and writes a TrendAlert after 3 real consecutive declining weeks', async () => {
    const player = await seedPlayer('declining')
    const coach = await testDb.user.create({ data: { email: 'coach-declining@test.local', role: 'coach', password_hash: 'x' } })

    await testDb.playerWeek.create({
      data: { player_id: player.id, week_start: weeksAgo(2), matches_played: 1, rolling_4week_average: 95, score_delta: -5 },
    })
    await testDb.playerWeek.create({
      data: { player_id: player.id, week_start: weeksAgo(1), matches_played: 1, rolling_4week_average: 85, score_delta: -10 },
    })

    const res = await postEvaluate(player.id, coach.id)
    expect(res.status).toBe(200)

    const week = await testDb.playerWeek.findUniqueOrThrow({
      where: { player_id_week_start: { player_id: player.id, week_start: mondayOfCurrentWeek() } },
    })
    expect(week.score_delta).toBeLessThan(0)
    expect(week.flag_type).toBe('form_drop')

    const alerts = await testDb.trendAlert.findMany({ where: { player_id: player.id } })
    expect(alerts).toHaveLength(1)
    expect(alerts[0].flag_type).toBe('form_drop')
    expect(alerts[0].consecutive_declining_weeks).toBe(3)
  })

  it('does not flag or alert with only 2 consecutive declining weeks', async () => {
    const player = await seedPlayer('almost')
    const coach = await testDb.user.create({ data: { email: 'coach-almost@test.local', role: 'coach', password_hash: 'x' } })

    // Only one prior declining week — this week would be the 2nd, below
    // the 3-week threshold.
    await testDb.playerWeek.create({
      data: { player_id: player.id, week_start: weeksAgo(1), matches_played: 1, rolling_4week_average: 85, score_delta: -10 },
    })

    const res = await postEvaluate(player.id, coach.id)
    expect(res.status).toBe(200)

    const week = await testDb.playerWeek.findUniqueOrThrow({
      where: { player_id_week_start: { player_id: player.id, week_start: mondayOfCurrentWeek() } },
    })
    expect(week.score_delta).toBeLessThan(0) // real decline, just not a 3-week streak yet
    expect(week.flag_type).toBe('none')
    expect(await testDb.trendAlert.count({ where: { player_id: player.id } })).toBe(0)
  })

  it('does not create a duplicate TrendAlert when the same already-flagged week is saved again', async () => {
    const player = await seedPlayer('resave')
    const coach = await testDb.user.create({ data: { email: 'coach-resave@test.local', role: 'coach', password_hash: 'x' } })

    await testDb.playerWeek.create({
      data: { player_id: player.id, week_start: weeksAgo(2), matches_played: 1, rolling_4week_average: 95, score_delta: -5 },
    })
    await testDb.playerWeek.create({
      data: { player_id: player.id, week_start: weeksAgo(1), matches_played: 1, rolling_4week_average: 85, score_delta: -10 },
    })

    const first = await postEvaluate(player.id, coach.id)
    expect(first.status).toBe(200)
    expect(await testDb.trendAlert.count({ where: { player_id: player.id } })).toBe(1)

    // Coach edits the note for the same week — the trend hasn't changed.
    const second = await postEvaluate(player.id, coach.id)
    expect(second.status).toBe(200)
    expect(await testDb.trendAlert.count({ where: { player_id: player.id } })).toBe(1)
  })
})
