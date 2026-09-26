/**
 * Integration — an association adds a self-reported affiliated-academy
 * entry, it shows up on GET for that association, and is scoped so a
 * second, unrelated association can neither see it nor mutate it.
 *
 * seedFixtures() only creates one association; this suite creates a
 * second one inline (association + staff user + AssociationStaff row),
 * the same three-step pattern seedFixtures itself uses.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { testDb, resetDb, seedFixtures, assertIsTestSchema, type Fixtures } from '../helpers/test-db'
import { getAsUser, postAsUser, patchAsUser, sessionCookieFor } from '../helpers/auth'

vi.mock('@/lib/db', async () => ({
  db: (await import('../helpers/test-db')).testDb,
}))

const { GET, POST } = await import('@/app/api/association/affiliated-academies/route')
const { PATCH, DELETE } = await import('@/app/api/association/affiliated-academies/[id]/route')

async function deleteAsUser(url: string, userId: string, role: string): Promise<NextRequest> {
  return new NextRequest(url, { method: 'DELETE', headers: { cookie: await sessionCookieFor(userId, role) } })
}

let fx: Fixtures
let otherStaffUserId: string

beforeAll(async () => {
  await assertIsTestSchema()
})
beforeEach(async () => {
  await resetDb()
  fx = await seedFixtures()

  const otherAssociation = await testDb.association.create({
    data: { name: 'Other District CA', type: 'district', state: 'Karnataka' },
  })
  const otherStaff = await testDb.user.create({
    data: { email: 'other-staff@test.local', role: 'association', password_hash: 'x' },
  })
  await testDb.associationStaff.create({
    data: { association_id: otherAssociation.id, user_id: otherStaff.id, is_lead: true },
  })
  otherStaffUserId = otherStaff.id
})
afterAll(async () => {
  await resetDb()
  await testDb.$disconnect()
})

describe('Affiliated academies — self-reported list, scoped per association', () => {
  it('an association adds an entry and it shows up on that association’s own GET', async () => {
    const postReq = await postAsUser(
      'http://test.local/api/association/affiliated-academies',
      fx.associationStaffUser.id, 'association',
      { academyName: 'Tara Cricket Academy', contactName: 'R. Sharma', contactPhone: '+919876543210' },
    )
    const postRes = await POST(postReq)
    const postData = await postRes.json()
    expect(postRes.status).toBe(200)
    expect(postData.academy.academy_name).toBe('Tara Cricket Academy')
    expect(postData.academy.status).toBe('active')

    const getReq = await getAsUser(
      'http://test.local/api/association/affiliated-academies',
      fx.associationStaffUser.id, 'association',
    )
    const getRes = await GET(getReq)
    const getData = await getRes.json()
    expect(getRes.status).toBe(200)
    expect(getData.academies).toHaveLength(1)
    expect(getData.academies[0].academy_name).toBe('Tara Cricket Academy')
  })

  it('one association cannot see another association’s affiliated-academy list', async () => {
    const postReq = await postAsUser(
      'http://test.local/api/association/affiliated-academies',
      fx.associationStaffUser.id, 'association',
      { academyName: 'Tara Cricket Academy' },
    )
    await POST(postReq)

    const otherGetReq = await getAsUser(
      'http://test.local/api/association/affiliated-academies',
      otherStaffUserId, 'association',
    )
    const otherGetRes = await GET(otherGetReq)
    const otherGetData = await otherGetRes.json()
    expect(otherGetRes.status).toBe(200)
    expect(otherGetData.academies).toHaveLength(0)
  })

  it('one association cannot edit or delete another association’s entry', async () => {
    const postReq = await postAsUser(
      'http://test.local/api/association/affiliated-academies',
      fx.associationStaffUser.id, 'association',
      { academyName: 'Tara Cricket Academy' },
    )
    const postRes = await POST(postReq)
    const { academy } = await postRes.json()

    const patchReq = await patchAsUser(
      `http://test.local/api/association/affiliated-academies/${academy.id}`,
      otherStaffUserId, 'association',
      { status: 'inactive' },
    )
    const patchRes = await PATCH(patchReq, { params: { id: academy.id } })
    expect(patchRes.status).toBe(404)

    const deleteReq = await deleteAsUser(
      `http://test.local/api/association/affiliated-academies/${academy.id}`,
      otherStaffUserId, 'association',
    )
    const deleteRes = await DELETE(deleteReq, { params: { id: academy.id } })
    expect(deleteRes.status).toBe(404)

    // Confirm it's untouched — still active, still there — from the
    // owning association's own view.
    const getReq = await getAsUser(
      'http://test.local/api/association/affiliated-academies',
      fx.associationStaffUser.id, 'association',
    )
    const getData = await (await GET(getReq)).json()
    expect(getData.academies).toHaveLength(1)
    expect(getData.academies[0].status).toBe('active')
  })

  it('the owning association can toggle status and delete its own entry', async () => {
    const postReq = await postAsUser(
      'http://test.local/api/association/affiliated-academies',
      fx.associationStaffUser.id, 'association',
      { academyName: 'Tara Cricket Academy' },
    )
    const { academy } = await (await POST(postReq)).json()

    const patchReq = await patchAsUser(
      `http://test.local/api/association/affiliated-academies/${academy.id}`,
      fx.associationStaffUser.id, 'association',
      { status: 'inactive' },
    )
    const patchRes = await PATCH(patchReq, { params: { id: academy.id } })
    expect(patchRes.status).toBe(200)

    const deleteReq = await deleteAsUser(
      `http://test.local/api/association/affiliated-academies/${academy.id}`,
      fx.associationStaffUser.id, 'association',
    )
    const deleteRes = await DELETE(deleteReq, { params: { id: academy.id } })
    expect(deleteRes.status).toBe(200)

    const getReq = await getAsUser(
      'http://test.local/api/association/affiliated-academies',
      fx.associationStaffUser.id, 'association',
    )
    const getData = await (await GET(getReq)).json()
    expect(getData.academies).toHaveLength(0)
  })
})
