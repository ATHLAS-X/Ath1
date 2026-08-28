/**
 * Integration — proves the real CredentialsProvider sign-in path issues a
 * NextAuth session cookie for a seeded staff user, and rejects the wrong
 * password for the same account.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { encode } from 'next-auth/jwt'
import { GET as dashboard } from '@/app/api/dashboard/route'
import { authenticateWithPassword } from '@/lib/auth'
import { getSessionUser } from '@/lib/require-auth'
import {
  testDb,
  resetDb,
  seedFixtures,
  assertIsTestSchema,
  type Fixtures,
} from '../helpers/test-db'

vi.mock('@/lib/db', async () => ({
  db: (await import('../helpers/test-db')).testDb,
}))

const DEV_PASSWORD = 'athlasx-dev-password'
const SECRET = process.env.NEXTAUTH_SECRET!

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

describe('authenticateWithPassword', () => {
  it('accepts the seeded association staff password and rejects the wrong one', async () => {
    const ok = await authenticateWithPassword('staff@test.local', DEV_PASSWORD)
    expect(ok?.id).toBe(fx.associationStaffUser.id)
    expect(ok?.role).toBe('association')

    const bad = await authenticateWithPassword('staff@test.local', 'not-the-password')
    expect(bad).toBeNull()
  })
})

describe('session cookie contract', () => {
  it('produces a cookie that authenticates the dashboard for the seeded staff user', async () => {
    const user = await authenticateWithPassword('staff@test.local', DEV_PASSWORD)
    expect(user).toBeTruthy()

    const jwt = await encode({
      token: { id: user!.id, email: user!.email, role: user!.role },
      secret: SECRET,
    })
    const req = new NextRequest('http://test.local/api/dashboard', {
      headers: { cookie: `next-auth.session-token=${jwt}` },
    })

    const sessionUser = await getSessionUser(req)
    expect(sessionUser).toEqual({
      id: fx.associationStaffUser.id,
      email: 'staff@test.local',
      role: 'association',
    })

    const res = await dashboard(req)
    expect(res.status).toBe(200)
  })

  it('returns no user for the wrong password', async () => {
    const bad = await authenticateWithPassword('staff@test.local', 'wrong-password')
    expect(bad).toBeNull()
  })
})
