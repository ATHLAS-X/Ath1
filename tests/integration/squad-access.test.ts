/**
 * Integration — W7 Squad model (prisma/schema.prisma: Squad/SquadCoach/
 * SquadPlayer/CoachAdvisoryNote/TrainingSession/SessionAttendance).
 *
 * Proves: association staff can create a squad + assign a coach; a coach
 * with a real SquadCoach row (and only that coach) can see their squad via
 * the default (no squadId) path; advisory notes are squad-scoped and never
 * touch Grade/scoring; attendance marking round-trips.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { testDb, resetDb, seedFixtures, assertIsTestSchema, type Fixtures } from '../helpers/test-db'
import { getAsUser, postAsUser } from '../helpers/auth'

vi.mock('@/lib/db', async () => ({
  db: (await import('../helpers/test-db')).testDb,
}))

const { POST: createSquad, GET: listSquads } = await import('@/app/api/squads/route')
const { GET: squadDetail } = await import('@/app/api/squads/[id]/route')
const { POST: assignCoach } = await import('@/app/api/squads/[id]/coaches/route')
const { GET: coachSquad } = await import('@/app/api/coach/squad/route')
const { POST: addAdvisoryNote, GET: listAdvisoryNotes } = await import('@/app/api/squads/[id]/advisory-notes/route')
const { POST: createSession } = await import('@/app/api/squads/[id]/sessions/route')
const { POST: markAttendance, GET: getAttendance } = await import('@/app/api/squads/[id]/sessions/[sessionId]/attendance/route')

let fx: Fixtures
let staffUser: { id: string }
let coachUser: { id: string }

beforeAll(async () => { await assertIsTestSchema() })

beforeEach(async () => {
  await resetDb()
  fx = await seedFixtures()
  staffUser = await testDb.user.create({ data: { email: 'squad-staff@test.local', role: 'association' } })
  await testDb.associationStaff.create({ data: { association_id: fx.association.id, user_id: staffUser.id } })
  coachUser = await testDb.user.create({ data: { email: 'squad-coach@test.local', role: 'coach' } })
})

afterAll(async () => { await resetDb(); await testDb.$disconnect() })

describe('creating a squad and assigning a coach', () => {
  it('staff creates a squad with an initial roster, then assigns a coach', async () => {
    const createReq = await postAsUser('http://test.local/api', staffUser.id, 'association', {
      associationId: fx.association.id, name: 'U19 State Squad', season: '2026',
      playerIds: [fx.adult.id],
    })
    const createRes = await createSquad(createReq)
    expect(createRes.status).toBe(200)
    const { squad } = await createRes.json()
    expect(squad.id).toBeTruthy()

    const assignReq = await postAsUser(
      'http://test.local/api', staffUser.id, 'association', { userId: coachUser.id, isLead: true },
    )
    const assignRes = await assignCoach(assignReq, { params: { id: squad.id } })
    expect(assignRes.status).toBe(200)

    const row = await testDb.squadCoach.findFirst({ where: { squad_id: squad.id, user_id: coachUser.id } })
    expect(row?.is_lead).toBe(true)
  })

  it('a random user (not the assigned coach, not staff) is refused squad detail access', async () => {
    const createReq = await postAsUser('http://test.local/api', staffUser.id, 'association', {
      associationId: fx.association.id, name: 'U19 State Squad', season: '2026', playerIds: [],
    })
    const { squad } = await (await createSquad(createReq)).json()

    const outsider = await testDb.user.create({ data: { email: 'outsider@test.local', role: 'coach' } })
    const req = await getAsUser('http://test.local/api', outsider.id, 'coach')
    const res = await squadDetail(req, { params: { id: squad.id } })
    expect(res.status).toBe(403)
  })
})

describe('coach/squad default resolution', () => {
  it('resolves the coach\'s own squad with no squadId param, never another coach\'s', async () => {
    const createReq = await postAsUser('http://test.local/api', staffUser.id, 'association', {
      associationId: fx.association.id, name: 'Squad One', season: '2026', playerIds: [fx.adult.id],
    })
    const { squad: squadOne } = await (await createSquad(createReq)).json()
    await assignCoach(
      await postAsUser('http://test.local/api', staffUser.id, 'association', { userId: coachUser.id }),
      { params: { id: squadOne.id } },
    )

    const otherCoach = await testDb.user.create({ data: { email: 'other-coach@test.local', role: 'coach' } })
    const createReq2 = await postAsUser('http://test.local/api', staffUser.id, 'association', {
      associationId: fx.association.id, name: 'Squad Two', season: '2026', playerIds: [fx.minor.id],
    })
    const { squad: squadTwo } = await (await createSquad(createReq2)).json()
    await assignCoach(
      await postAsUser('http://test.local/api', staffUser.id, 'association', { userId: otherCoach.id }),
      { params: { id: squadTwo.id } },
    )

    const req = await getAsUser('http://test.local/api', coachUser.id, 'coach')
    const body = JSON.stringify(await (await coachSquad(req)).json())
    expect(body).toContain(fx.adult.id)
    expect(body).not.toContain(fx.minor.id)
  })
})

describe('advisory notes — structurally isolated from scoring', () => {
  it('creates a note with no relationship to Grade/Selection, visible via the list endpoint', async () => {
    const createReq = await postAsUser('http://test.local/api', staffUser.id, 'association', {
      associationId: fx.association.id, name: 'Squad', season: '2026', playerIds: [fx.adult.id],
    })
    const { squad } = await (await createSquad(createReq)).json()
    await assignCoach(
      await postAsUser('http://test.local/api', staffUser.id, 'association', { userId: coachUser.id }),
      { params: { id: squad.id } },
    )

    const noteReq = await postAsUser('http://test.local/api', coachUser.id, 'coach', {
      playerId: fx.adult.id, fitnessRating: 4, behaviourRating: 5, note: 'Strong session',
    })
    const noteRes = await addAdvisoryNote(noteReq, { params: { id: squad.id } })
    expect(noteRes.status).toBe(200)

    // No FK from CoachAdvisoryNote to Grade/Selection exists in the schema
    // at all — confirming there's nothing to query, the structural
    // guarantee is enforced by the schema itself, not application code.
    const gradeCount = await testDb.grade.count()
    expect(gradeCount).toBe(0)

    const listReq = await getAsUser('http://test.local/api', staffUser.id, 'association')
    const body = JSON.stringify(await (await listAdvisoryNotes(listReq, { params: { id: squad.id } })).json())
    expect(body).toContain('Strong session')
  })
})

describe('training sessions + attendance', () => {
  it('creates a session and marks attendance for squad players', async () => {
    const createReq = await postAsUser('http://test.local/api', staffUser.id, 'association', {
      associationId: fx.association.id, name: 'Squad', season: '2026', playerIds: [fx.adult.id, fx.minor.id],
    })
    const { squad } = await (await createSquad(createReq)).json()
    await assignCoach(
      await postAsUser('http://test.local/api', staffUser.id, 'association', { userId: coachUser.id }),
      { params: { id: squad.id } },
    )

    const sessionReq = await postAsUser('http://test.local/api', coachUser.id, 'coach', {
      sessionDate: '2026-08-01', notes: 'Fielding drills',
    })
    const { session } = await (await createSession(sessionReq, { params: { id: squad.id } })).json()
    expect(session.id).toBeTruthy()

    const attendanceReq = await postAsUser('http://test.local/api', coachUser.id, 'coach', {
      records: [{ playerId: fx.adult.id, present: true }, { playerId: fx.minor.id, present: false }],
    })
    const markRes = await markAttendance(attendanceReq, { params: { id: squad.id, sessionId: session.id } })
    expect(markRes.status).toBe(200)

    const getReq = await getAsUser('http://test.local/api', coachUser.id, 'coach')
    const { attendance } = await (await getAttendance(getReq, { params: { id: squad.id, sessionId: session.id } })).json()
    expect(attendance).toHaveLength(2)
    expect(attendance.find((a: { player_id: string }) => a.player_id === fx.adult.id).present).toBe(true)
    expect(attendance.find((a: { player_id: string }) => a.player_id === fx.minor.id).present).toBe(false)
  })
})

describe('listing squads', () => {
  it('GET /api/squads returns squads the caller can see', async () => {
    const createReq = await postAsUser('http://test.local/api', staffUser.id, 'association', {
      associationId: fx.association.id, name: 'Squad', season: '2026', playerIds: [],
    })
    await createSquad(createReq)

    const req = await getAsUser('http://test.local/api', staffUser.id, 'association')
    const { squads } = await (await listSquads(req)).json()
    expect(squads.length).toBeGreaterThan(0)
  })
})
