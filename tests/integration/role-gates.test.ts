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
import { POST as createSquad } from '@/app/api/squads/route'
import { POST as assignCoach } from '@/app/api/squads/[id]/coaches/route'
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

// Squads/coaches (W7): both routes use requireAuth + resolveAssociationScope
// rather than requireRole — access is derived from real AssociationStaff
// membership, not the role claim on the token. Proving this actually
// rejects a caller with no such membership (this had zero test coverage
// before, despite the code appearing correct on read).
describe('squads/coaches — association-scope gate, not just requireAuth', () => {
  it('POST /api/squads is 403 for a player with no AssociationStaff row', async () => {
    const res = await createSquad(
      await postAsUser(URL, fx.adult.id, 'player', {
        associationId: fx.association.id, name: 'Rogue Squad', season: '2026',
      }),
    )
    expect(res.status).toBe(403)
    expect(await testDb.squad.count()).toBe(0)
  })

  it('POST /api/squads succeeds for real association staff (positive control)', async () => {
    const res = await createSquad(
      await postAsUser(URL, fx.associationStaffUser.id, 'association', {
        associationId: fx.association.id, name: 'Real Squad', season: '2026',
      }),
    )
    expect(res.status).toBe(200)
    expect(await testDb.squad.count()).toBe(1)
  })

  it('POST /api/squads/:id/coaches is 403 for a player with no AssociationStaff row', async () => {
    const squad = await testDb.squad.create({
      data: { association_id: fx.association.id, name: 'Target Squad', season: '2026' },
    })
    const coachUser = await testDb.user.create({ data: { email: 'coach@test.local', role: 'coach' } })

    const res = await assignCoach(
      await postAsUser(URL, fx.adult.id, 'player', { userId: coachUser.id }),
      { params: { id: squad.id } },
    )
    expect(res.status).toBe(403)
    expect(await testDb.squadCoach.count()).toBe(0)
  })

  it('a coach with membership on a DIFFERENT squad cannot assign coaches to this one', async () => {
    const otherAssociation = await testDb.association.create({
      data: { name: 'Other Association', type: 'district', state: 'Bihar' },
    })
    const otherSquad = await testDb.squad.create({
      data: { association_id: otherAssociation.id, name: 'Other Squad', season: '2026' },
    })
    const targetSquad = await testDb.squad.create({
      data: { association_id: fx.association.id, name: 'Target Squad', season: '2026' },
    })
    const outsiderCoach = await testDb.user.create({ data: { email: 'outsider-coach@test.local', role: 'coach' } })
    await testDb.squadCoach.create({ data: { squad_id: otherSquad.id, user_id: outsiderCoach.id } })

    const res = await assignCoach(
      await postAsUser(URL, outsiderCoach.id, 'coach', { userId: outsiderCoach.id }),
      { params: { id: targetSquad.id } },
    )
    expect(res.status).toBe(403)
    expect(await testDb.squadCoach.count({ where: { squad_id: targetSquad.id } })).toBe(0)
  })
})
