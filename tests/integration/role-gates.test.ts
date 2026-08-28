/**
 * Player sessions are real JWTs. Staff write/read routes must not treat
 * "logged in" as "may ingest / grade / read the association dashboard".
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { GET as dashboard } from '@/app/api/dashboard/route'
import { GET as ingestGet } from '@/app/api/ingest/route'
import { POST as ingestDecide } from '@/app/api/ingest/[id]/decide/route'
import { POST as submitGrade } from '@/app/api/grading/[sessionId]/grade/route'
import { GET as gradingSession } from '@/app/api/grading/session/route'
import {
  testDb,
  resetDb,
  seedFixtures,
  assertIsTestSchema,
  type Fixtures,
} from '../helpers/test-db'
import { getAsUser, postAsUser } from '../helpers/auth'

vi.mock('@/lib/db', async () => ({
  db: (await import('../helpers/test-db')).testDb,
}))

const URL = 'http://test.local/api'

let fx: Fixtures

beforeAll(async () => {
  await assertIsTestSchema()
})
beforeEach(async () => {
  await resetDb()
  fx = await seedFixtures()
})
afterAll(async () => {
  await resetDb()
  await testDb.$disconnect()
})

describe('player sessions cannot use staff APIs', () => {
  it('GET /api/dashboard is 403 for a player', async () => {
    const res = await dashboard(await getAsUser(URL, fx.adult.id, 'player'))
    expect(res.status).toBe(403)
  })

  it('GET /api/ingest is 403 for a player', async () => {
    const res = await ingestGet(await getAsUser(URL, fx.adult.id, 'player'))
    expect(res.status).toBe(403)
  })

  it('POST /api/ingest/:id/decide is 403 for a player', async () => {
    const job = await testDb.ingestJob.create({
      data: {
        association_id: fx.association.id,
        source: 'api_sync',
        method: 'api_sync',
        tournament: 'Role gate',
        match_count: 1,
        player_rows: 0,
        status: 'pending_review',
        confidence: 0.9,
      },
    })
    const res = await ingestDecide(
      await postAsUser(URL, fx.adult.id, 'player', { decision: 'approved' }),
      { params: { id: job.id } },
    )
    expect(res.status).toBe(403)
  })

  it('POST grade is 403 for association staff', async () => {
    const res = await submitGrade(
      await postAsUser(URL, fx.associationStaffUser.id, 'association', {
        playerId: fx.adult.id,
        grade: 7,
      }),
      { params: { sessionId: fx.session.id } },
    )
    expect(res.status).toBe(403)
  })

  it('GET grading session is 403 for a player', async () => {
    const res = await gradingSession(await getAsUser(URL, fx.adult.id, 'player'))
    expect(res.status).toBe(403)
  })
})
