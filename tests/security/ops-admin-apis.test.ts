/**
 * Security — athlasx_ops-only read APIs: users, associations, scouts,
 * academies.
 *
 * `athlasx_ops` is already the platform's established unrestricted role,
 * so these tests focus on the properties that are NOT automatically true
 * just because a route checks the role: role gating is enforced server
 * side, the response shape never leaks secrets, and pagination/filtering
 * actually works.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { testDb, resetDb, assertIsTestSchema } from '../helpers/test-db'
import { getAsUser } from '../helpers/auth'

vi.mock('@/lib/db', async () => ({
  db: (await import('../helpers/test-db')).testDb,
}))

const { GET: listUsers } = await import('@/app/api/ops/users/route')
const { GET: listAssociations } = await import('@/app/api/ops/associations/route')
const { GET: listScouts } = await import('@/app/api/ops/scouts/route')
const { GET: listAcademies } = await import('@/app/api/ops/academies/route')

const URL = 'http://test.local/api'

function get(url: string) {
  return new NextRequest(url)
}

let opsUser: string
let coachUser: string
let association: { id: string }
let academy: { id: string }
let scoutProfile: { id: string }

beforeAll(async () => { await assertIsTestSchema() })

beforeEach(async () => {
  await resetDb()

  const ops = await testDb.user.create({ data: { email: 'admin-ops@test.local', role: 'athlasx_ops', password_hash: 'super-secret-hash' } })
  opsUser = ops.id
  const coach = await testDb.user.create({ data: { email: 'admin-coach@test.local', role: 'coach', password_hash: 'x' } })
  coachUser = coach.id
  await testDb.user.create({ data: { email: 'admin-player@test.local', role: 'player', password_hash: 'x' } })

  association = await testDb.association.create({
    data: { name: 'Admin Test Assoc', type: 'state', state: 'Bihar', data_sharing_signed: true },
  })
  const academyAdmin = await testDb.user.create({ data: { email: 'admin-academy@test.local', role: 'academy_admin', password_hash: 'admin-academy-secret-hash' } })
  academy = await testDb.academy.create({
    data: { name: 'Admin Test Academy', district: 'Patna', state: 'Bihar', players_at_district_plus: 5, admin_user_id: academyAdmin.id },
  })
  const scoutUser = await testDb.user.create({ data: { email: 'admin-scout@test.local', role: 'scout', password_hash: 'x' } })
  scoutProfile = await testDb.scoutProfile.create({
    data: { user_id: scoutUser.id, org_name: 'Admin Test Franchise', org_type: 'franchise' },
  })
})

afterAll(async () => { await resetDb(); await testDb.$disconnect() })

describe('GET /api/ops/users', () => {
  it('1. rejects anonymous', async () => {
    expect((await listUsers(get(URL))).status).toBe(401)
  })
  it('2. rejects a non-ops role', async () => {
    const res = await listUsers(await getAsUser(URL, coachUser, 'coach'))
    expect(res.status).toBe(403)
  })
  it('3. athlasx_ops succeeds', async () => {
    const res = await listUsers(await getAsUser(URL, opsUser, 'athlasx_ops'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBeGreaterThanOrEqual(3)
  })
  it('4. never exposes password_hash or phone numbers, however they are spelled', async () => {
    const res = await listUsers(await getAsUser(URL, opsUser, 'athlasx_ops'))
    const raw = JSON.stringify(await res.json())
    expect(raw).not.toMatch(/password/i)
    expect(raw).not.toMatch(/super-secret-hash/)
    expect(raw).not.toMatch(/phone/i)
  })
  it('5. filters by role and paginates', async () => {
    const res = await listUsers(await getAsUser(`${URL}?role=coach&limit=1`, opsUser, 'athlasx_ops'))
    const body = await res.json()
    expect(body.users).toHaveLength(1)
    expect(body.users[0].role).toBe('coach')
    expect(body.limit).toBe(1)
  })
  it('6. clamps an oversized limit to the hard cap of 50 rather than returning an unbounded list', async () => {
    const res = await listUsers(await getAsUser(`${URL}?limit=999999`, opsUser, 'athlasx_ops'))
    expect((await res.json()).limit).toBe(50)
  })
})

describe('GET /api/ops/associations', () => {
  it('1. rejects anonymous', async () => {
    expect((await listAssociations(get(URL))).status).toBe(401)
  })
  it('2. rejects a non-ops role', async () => {
    expect((await listAssociations(await getAsUser(URL, coachUser, 'coach'))).status).toBe(403)
  })
  it('3. athlasx_ops succeeds and includes verification status', async () => {
    const res = await listAssociations(await getAsUser(URL, opsUser, 'athlasx_ops'))
    expect(res.status).toBe(200)
    const body = await res.json()
    const row = body.associations.find((a: { id: string }) => a.id === association.id)
    expect(row).toMatchObject({ name: 'Admin Test Assoc', verification_status: 'approved' })
  })
  it('4. does not expose staff details beyond a count', async () => {
    const res = await listAssociations(await getAsUser(URL, opsUser, 'athlasx_ops'))
    const body = await res.json()
    const raw = JSON.stringify(body)
    expect(raw).not.toMatch(/password/i)
    expect(body.associations[0]).not.toHaveProperty('staff')
  })
  it('5. filters by verification_status', async () => {
    const res = await listAssociations(await getAsUser(`${URL}?verification_status=pending`, opsUser, 'athlasx_ops'))
    const body = await res.json()
    expect(body.associations.find((a: { id: string }) => a.id === association.id)).toBeUndefined()
  })
})

describe('GET /api/ops/scouts', () => {
  it('1. rejects anonymous', async () => {
    expect((await listScouts(get(URL))).status).toBe(401)
  })
  it('2. rejects a non-ops role', async () => {
    expect((await listScouts(await getAsUser(URL, coachUser, 'coach'))).status).toBe(403)
  })
  it('3. athlasx_ops succeeds', async () => {
    const res = await listScouts(await getAsUser(URL, opsUser, 'athlasx_ops'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.scouts.find((s: { id: string }) => s.id === scoutProfile.id)).toBeTruthy()
  })
  it('4. never exposes password_hash or phone numbers', async () => {
    const res = await listScouts(await getAsUser(URL, opsUser, 'athlasx_ops'))
    const raw = JSON.stringify(await res.json())
    expect(raw).not.toMatch(/password/i)
    expect(raw).not.toMatch(/phone/i)
  })
  it('5. filters by verification_status', async () => {
    const res = await listScouts(await getAsUser(`${URL}?verification_status=approved`, opsUser, 'athlasx_ops'))
    const body = await res.json()
    expect(body.scouts.find((s: { id: string }) => s.id === scoutProfile.id)).toBeUndefined()
  })
})

// Every role other than athlasx_ops must be refused by all four endpoints —
// checked against real users in the DB, since privileged roles are
// re-verified against it (src/lib/session-role-refresh.ts) and an unknown
// user would 401 rather than reach the role check.
const OPS_LIST_ROUTES = [
  ['users', () => listUsers],
  ['associations', () => listAssociations],
  ['scouts', () => listScouts],
  ['academies', () => listAcademies],
] as const
const NON_OPS_ROLES = ['player', 'scout', 'coach', 'association', 'academy_admin', 'selection_panel'] as const

describe('role matrix — only athlasx_ops may read the ops lists', () => {
  for (const [name, handler] of OPS_LIST_ROUTES) {
    for (const role of NON_OPS_ROLES) {
      it(`${name}: ${role} gets 403`, async () => {
        const user = await testDb.user.create({ data: { email: `matrix-${name}-${role}@test.local`, role, password_hash: 'x' } })
        const res = await handler()(await getAsUser(URL, user.id, role))
        expect(res.status).toBe(403)
        expect(JSON.stringify(await res.json())).not.toMatch(/@test\.local/)
      })
    }
    it(`${name}: anonymous gets 401`, async () => {
      expect((await handler()(get(URL))).status).toBe(401)
    })
  }
})

describe('GET /api/ops/academies', () => {
  it('1. rejects anonymous', async () => {
    expect((await listAcademies(get(URL))).status).toBe(401)
  })
  it('2. rejects a non-ops role', async () => {
    expect((await listAcademies(await getAsUser(URL, coachUser, 'coach'))).status).toBe(403)
  })
  it('3. athlasx_ops succeeds and shows the admin by id/email only', async () => {
    const res = await listAcademies(await getAsUser(URL, opsUser, 'athlasx_ops'))
    expect(res.status).toBe(200)
    const body = await res.json()
    const row = body.academies.find((a: { id: string }) => a.id === academy.id)
    expect(row).toMatchObject({ name: 'Admin Test Academy', verified: false })
    expect(Object.keys(row.admin).sort()).toEqual(['email', 'id'])
  })
  it('4. never exposes the linked admin user\'s password hash', async () => {
    const res = await listAcademies(await getAsUser(URL, opsUser, 'athlasx_ops'))
    const raw = JSON.stringify(await res.json())
    expect(raw).not.toMatch(/password/i)
    expect(raw).not.toMatch(/admin-academy-secret-hash/)
  })
  it('5. filters by verified status', async () => {
    const res = await listAcademies(await getAsUser(`${URL}?verified=true`, opsUser, 'athlasx_ops'))
    const body = await res.json()
    expect(body.academies.find((a: { id: string }) => a.id === academy.id)).toBeUndefined()
  })
})
