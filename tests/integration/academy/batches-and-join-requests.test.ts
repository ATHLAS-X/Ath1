/**
 * Integration — academy batches / roster / join-requests / attendance-flags
 * subsystem (prisma/schema.prisma: AcademyBatch/AcademyBatchMembership/
 * AcademyJoinRequest/AcademyAttendanceFlag), ported from
 * origin/v1-features-sparsh onto main's src/+Prisma shape.
 *
 * Proves: an academy_admin can create a batch, roster/unroster a player
 * into it; a join request can be approved into a batch (creating a real
 * PlayerProfile + membership) or rejected; attendance-flag dismiss/snooze
 * state round-trips and is scoped to the caller's own academy.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { testDb, resetDb, seedFixtures, assertIsTestSchema, type Fixtures } from '../../helpers/test-db'
import { getAsUser, postAsUser } from '../../helpers/auth'

vi.mock('@/lib/db', async () => ({
  db: (await import('../../helpers/test-db')).testDb,
}))

// This whole subsystem is gated behind ACADEMY_SELF_SERVE_ENABLED
// (academyGate() 404s every route under src/app/api/academy/** when it's
// off). The flag's real default is false — mocked true here so this
// suite's pass/fail doesn't depend on whatever the live flag happens to
// be set to when tests run.
vi.mock('@/lib/feature-flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/feature-flags')>()),
  ACADEMY_SELF_SERVE_ENABLED: true,
}))

const { GET: listBatches, POST: createBatch } = await import('@/app/api/academy/batches/route')
const { GET: listBatchPlayers, POST: addBatchPlayer } = await import(
  '@/app/api/academy/batches/[batchId]/players/route'
)
const { DELETE: removeBatchPlayer } = await import(
  '@/app/api/academy/batches/[batchId]/players/[playerId]/route'
)
const { GET: listJoinRequests } = await import('@/app/api/academy/join-requests/route')
const { POST: approveJoinRequest } = await import('@/app/api/academy/join-requests/[requestId]/approve/route')
const { POST: rejectJoinRequest } = await import('@/app/api/academy/join-requests/[requestId]/reject/route')
const { GET: getAttendanceFlag, POST: postAttendanceFlag } = await import(
  '@/app/api/academy/attendance-flags/[playerId]/route'
)

let fx: Fixtures
let adminUser: { id: string }
let academy: { id: string }

beforeAll(async () => {
  await assertIsTestSchema()
})

beforeEach(async () => {
  await resetDb()
  fx = await seedFixtures()
  adminUser = await testDb.user.create({
    data: { email: 'academy-admin@test.local', role: 'academy_admin' },
  })
  academy = await testDb.academy.create({
    data: {
      name: 'Test Academy',
      district: 'Kanpur',
      state: 'Uttar Pradesh',
      admin_user_id: adminUser.id,
    },
  })
})

afterAll(async () => {
  await resetDb()
  await testDb.$disconnect()
})

const VALID_SCHEDULE = [{ day: 'Mon', start: '06:00', end: '08:00' }]

describe('batch creation and roster management', () => {
  it('academy_admin creates a batch, adds and removes a player', async () => {
    const createReq = await postAsUser('http://test.local/api', adminUser.id, 'academy_admin', {
      name: 'Morning Batch',
      age_group: 'U-13',
      schedule: VALID_SCHEDULE,
    })
    const createRes = await createBatch(createReq)
    expect(createRes.status).toBe(201)
    const { batch } = await createRes.json()
    expect(batch.id).toBeTruthy()
    expect(batch.name).toBe('Morning Batch')
    expect(batch.status).toBe('active')

    const listReq = await getAsUser('http://test.local/api', adminUser.id, 'academy_admin')
    const { batches } = await (await listBatches(listReq)).json()
    expect(batches).toHaveLength(1)

    const addReq = await postAsUser('http://test.local/api', adminUser.id, 'academy_admin', {
      player_id: fx.adult.id,
    })
    const addRes = await addBatchPlayer(addReq, { params: { batchId: batch.id } })
    expect(addRes.status).toBe(200)
    const { added } = await addRes.json()
    expect(added).toBe(true)

    const rosterReq = await getAsUser('http://test.local/api', adminUser.id, 'academy_admin')
    const { players } = await (await listBatchPlayers(rosterReq, { params: { batchId: batch.id } })).json()
    expect(players).toHaveLength(1)
    expect(players[0].id).toBe(fx.adult.id)

    const removeReq = await getAsUser('http://test.local/api', adminUser.id, 'academy_admin')
    const removeRes = await removeBatchPlayer(removeReq, {
      params: { batchId: batch.id, playerId: fx.adult.id },
    })
    expect(removeRes.status).toBe(200)

    const rosterReq2 = await getAsUser('http://test.local/api', adminUser.id, 'academy_admin')
    const { players: after } = await (await listBatchPlayers(rosterReq2, { params: { batchId: batch.id } })).json()
    expect(after).toHaveLength(0)
  })

  it('rejects a schedule with mismatched per-day times', async () => {
    const createReq = await postAsUser('http://test.local/api', adminUser.id, 'academy_admin', {
      name: 'Bad Batch',
      schedule: [
        { day: 'Mon', start: '06:00', end: '08:00' },
        { day: 'Wed', start: '17:00', end: '18:00' },
      ],
    })
    const res = await createBatch(createReq)
    expect(res.status).toBe(400)
  })

  it('a non-academy_admin caller is refused', async () => {
    const req = await getAsUser('http://test.local/api', fx.chair.id, 'selection_panel')
    const res = await listBatches(req)
    expect(res.status).toBe(403)
  })

  it('an academy_admin with no academy yet gets a clear 400, not a crash', async () => {
    const otherAdmin = await testDb.user.create({
      data: { email: 'no-academy-admin@test.local', role: 'academy_admin' },
    })
    const req = await getAsUser('http://test.local/api', otherAdmin.id, 'academy_admin')
    const res = await listBatches(req)
    expect(res.status).toBe(400)
  })
})

describe('join requests', () => {
  it('approves a pending join request into a batch, creating a real player + membership', async () => {
    const createReq = await postAsUser('http://test.local/api', adminUser.id, 'academy_admin', {
      name: 'Batch A',
      schedule: VALID_SCHEDULE,
    })
    const { batch } = await (await createBatch(createReq)).json()

    const joinRequest = await testDb.academyJoinRequest.create({
      data: {
        academy_id: academy.id,
        candidate_name: 'New Candidate',
        candidate_phone: '9999999999',
      },
    })

    const listReq = await getAsUser('http://test.local/api', adminUser.id, 'academy_admin')
    const { requests } = await (await listJoinRequests(listReq)).json()
    expect(requests).toHaveLength(1)
    expect(requests[0].name).toBe('New Candidate')

    const approveReq = await postAsUser('http://test.local/api', adminUser.id, 'academy_admin', {
      batch_id: batch.id,
    })
    const approveRes = await approveJoinRequest(approveReq, { params: { requestId: joinRequest.id } })
    expect(approveRes.status).toBe(200)
    const { player_id } = await approveRes.json()
    expect(player_id).toBeTruthy()

    const membership = await testDb.academyBatchMembership.findUnique({
      where: { batch_id_player_id: { batch_id: batch.id, player_id } },
    })
    expect(membership?.status).toBe('active')

    const updated = await testDb.academyJoinRequest.findUnique({ where: { id: joinRequest.id } })
    expect(updated?.status).toBe('approved')
    expect(updated?.reviewed_by).toBe(adminUser.id)
  })

  it('rejects a pending join request', async () => {
    const joinRequest = await testDb.academyJoinRequest.create({
      data: { academy_id: academy.id, candidate_name: 'Someone Else' },
    })

    const req = await postAsUser('http://test.local/api', adminUser.id, 'academy_admin', {})
    const res = await rejectJoinRequest(req, { params: { requestId: joinRequest.id } })
    expect(res.status).toBe(200)

    const updated = await testDb.academyJoinRequest.findUnique({ where: { id: joinRequest.id } })
    expect(updated?.status).toBe('rejected')
  })

  it('double-approving the same request 404s the second time', async () => {
    const createReq = await postAsUser('http://test.local/api', adminUser.id, 'academy_admin', {
      name: 'Batch A',
      schedule: VALID_SCHEDULE,
    })
    const { batch } = await (await createBatch(createReq)).json()
    const joinRequest = await testDb.academyJoinRequest.create({
      data: { academy_id: academy.id, candidate_name: 'Candidate' },
    })

    const approveReq1 = await postAsUser('http://test.local/api', adminUser.id, 'academy_admin', {
      batch_id: batch.id,
    })
    await approveJoinRequest(approveReq1, { params: { requestId: joinRequest.id } })

    const approveReq2 = await postAsUser('http://test.local/api', adminUser.id, 'academy_admin', {
      batch_id: batch.id,
    })
    const res2 = await approveJoinRequest(approveReq2, { params: { requestId: joinRequest.id } })
    expect(res2.status).toBe(404)
  })
})

describe('attendance flags', () => {
  it('reports open when consecutive absences meet threshold with no prior state', async () => {
    const req = await getAsUser(
      'http://test.local/api?consecutive_absences=3&threshold=2',
      adminUser.id,
      'academy_admin',
    )
    const res = await getAttendanceFlag(req, { params: { playerId: fx.adult.id } })
    const body = await res.json()
    expect(body.status).toBe('open')
    expect(body.flagged).toBe(true)
  })

  it('dismiss then re-check reports dismissed, snooze then unsnooze round-trips', async () => {
    const dismissReq = await postAsUser('http://test.local/api', adminUser.id, 'academy_admin', {
      action: 'dismiss',
    })
    const dismissRes = await postAttendanceFlag(dismissReq, { params: { playerId: fx.adult.id } })
    expect(dismissRes.status).toBe(200)

    const checkReq = await getAsUser(
      'http://test.local/api?consecutive_absences=3&threshold=2',
      adminUser.id,
      'academy_admin',
    )
    const checkRes = await getAttendanceFlag(checkReq, { params: { playerId: fx.adult.id } })
    expect((await checkRes.json()).status).toBe('dismissed')

    const snoozeReq = await postAsUser('http://test.local/api', adminUser.id, 'academy_admin', {
      action: 'snooze',
      duration_days: 7,
    })
    const snoozeRes = await postAttendanceFlag(snoozeReq, { params: { playerId: fx.adult.id } })
    expect(snoozeRes.status).toBe(200)
    const snoozeBody = await snoozeRes.json()
    expect(snoozeBody.duration_days).toBe(7)

    const unsnoozeReq = await postAsUser('http://test.local/api', adminUser.id, 'academy_admin', {
      action: 'unsnooze',
    })
    const unsnoozeRes = await postAttendanceFlag(unsnoozeReq, { params: { playerId: fx.adult.id } })
    expect(unsnoozeRes.status).toBe(200)
  })

  it('rejects an invalid snooze duration', async () => {
    const req = await postAsUser('http://test.local/api', adminUser.id, 'academy_admin', {
      action: 'snooze',
      duration_days: 0,
    })
    const res = await postAttendanceFlag(req, { params: { playerId: fx.adult.id } })
    expect(res.status).toBe(400)
  })
})
