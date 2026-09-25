/**
 * T-EVAL-AUTH / T-NOTE-AUTH — regression tests for two IDOR fixes:
 *
 *   POST /api/coach/[playerId]/evaluate and POST /api/tracking/[playerId]/note
 *   previously called requireAuth only, with no check that the caller was
 *   actually the assigned coach (or association staff, or athlasx_ops) for
 *   the target player's squad. Any authenticated user — including an
 *   unrelated coach, or a player/scout account — could write fitness/
 *   behaviour ratings or overwrite a coach note on any player in the system.
 *
 *   Both routes now call canAccessPlayer (src/lib/squad-access.ts), which
 *   reuses canAccessSquad's existing real-membership discipline (a
 *   SquadCoach row, AssociationStaff row, or athlasx_ops role) resolved via
 *   the player's actual SquadPlayer row(s) — never a client-supplied ID.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { testDb, resetDb, seedFixtures, assertIsTestSchema, type Fixtures } from '../helpers/test-db'
import { getAsUser, postAsUser } from '../helpers/auth'

vi.mock('@/lib/db', async () => ({
  db: (await import('../helpers/test-db')).testDb,
}))

const { POST: createSquad } = await import('@/app/api/squads/route')
const { POST: assignCoach } = await import('@/app/api/squads/[id]/coaches/route')
const { POST: evaluate } = await import('@/app/api/coach/[playerId]/evaluate/route')
const { POST: trackingNote } = await import('@/app/api/tracking/[playerId]/note/route')

let fx: Fixtures
let staffUser: { id: string }
let assignedCoach: { id: string }
let outsiderCoach: { id: string }
let squadId: string

beforeAll(async () => { await assertIsTestSchema() })

beforeEach(async () => {
  await resetDb()
  fx = await seedFixtures()

  staffUser = await testDb.user.create({ data: { email: 'idor-staff@test.local', role: 'association' } })
  await testDb.associationStaff.create({ data: { association_id: fx.association.id, user_id: staffUser.id } })

  assignedCoach = await testDb.user.create({ data: { email: 'idor-assigned-coach@test.local', role: 'coach' } })
  outsiderCoach = await testDb.user.create({ data: { email: 'idor-outsider-coach@test.local', role: 'coach' } })

  const createReq = await postAsUser('http://test.local/api', staffUser.id, 'association', {
    associationId: fx.association.id, name: 'IDOR Test Squad', season: '2026', playerIds: [fx.adult.id],
  })
  const { squad } = await (await createSquad(createReq)).json()
  squadId = squad.id

  await assignCoach(
    await postAsUser('http://test.local/api', staffUser.id, 'association', { userId: assignedCoach.id }),
    { params: { id: squadId } },
  )

  // A PlayerWeek row must already exist for the tracking-note route (it
  // updates the latest week, it doesn't create one).
  await testDb.playerWeek.create({
    data: { player_id: fx.adult.id, week_start: new Date('2026-01-05'), matches_played: 1 },
  })
})

afterAll(async () => { await resetDb(); await testDb.$disconnect() })

describe('POST /api/coach/[playerId]/evaluate — access control', () => {
  it('refuses a coach with no SquadCoach row for the player\'s squad', async () => {
    const req = await postAsUser(
      'http://test.local/api', outsiderCoach.id, 'coach', { fitness: 5, behaviour: 5 },
    )
    const res = await evaluate(req, { params: { playerId: fx.adult.id } })
    expect(res.status).toBe(403)
  })

  it('allows the assigned coach', async () => {
    const req = await postAsUser(
      'http://test.local/api', assignedCoach.id, 'coach', { fitness: 4, behaviour: 4 },
    )
    const res = await evaluate(req, { params: { playerId: fx.adult.id } })
    expect(res.status).toBe(200)
  })

  it('allows athlasx_ops regardless of squad membership', async () => {
    const opsUser = await testDb.user.create({ data: { email: 'idor-ops@test.local', role: 'athlasx_ops' } })
    const req = await postAsUser(
      'http://test.local/api', opsUser.id, 'athlasx_ops', { fitness: 3, behaviour: 3 },
    )
    const res = await evaluate(req, { params: { playerId: fx.adult.id } })
    expect(res.status).toBe(200)
  })
})

describe('POST /api/tracking/[playerId]/note — access control', () => {
  it('refuses a coach with no SquadCoach row for the player\'s squad', async () => {
    const req = await postAsUser(
      'http://test.local/api', outsiderCoach.id, 'coach', { note: 'unauthorized note' },
    )
    const res = await trackingNote(req, { params: { playerId: fx.adult.id } })
    expect(res.status).toBe(403)

    const week = await testDb.playerWeek.findFirst({ where: { player_id: fx.adult.id }, orderBy: { week_start: 'desc' } })
    expect(week?.coach_note ?? null).not.toBe('unauthorized note')
  })

  it('allows the assigned coach', async () => {
    const req = await postAsUser(
      'http://test.local/api', assignedCoach.id, 'coach', { note: 'legitimate note' },
    )
    const res = await trackingNote(req, { params: { playerId: fx.adult.id } })
    expect(res.status).toBe(200)

    const week = await testDb.playerWeek.findFirst({ where: { player_id: fx.adult.id }, orderBy: { week_start: 'desc' } })
    expect(week?.coach_note).toBe('legitimate note')
  })
})
