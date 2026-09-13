/**
 * Regression test for the stale-JWT-role audit finding: a DB-level role
 * change to one of the four privileged roles (athlasx_ops, association,
 * academy_admin, scout) now takes effect on the user's very next request,
 * instead of waiting for their 30-day session to expire or a re-login.
 *
 * Covers both chokepoints that read the role:
 *   - src/lib/require-auth.ts (getSessionUser/requireRole) — API routes.
 *   - src/lib/auth.ts's NextAuth `session` callback — page-shell gating
 *     via requirePageSession/requirePageRole (src/lib/require-page-session.ts).
 *
 * Also confirms the deliberate scope: player/coach sessions are NOT
 * re-checked (no DB query fires for them), and a promotion INTO a
 * privileged role from a non-privileged claim doesn't take effect until
 * the next real login — both are documented, intentional asymmetries in
 * session-role-refresh.ts, not oversights.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { testDb, resetDb, assertIsTestSchema } from '../helpers/test-db'
import { sessionCookieFor } from '../helpers/auth'

vi.mock('@/lib/db', async () => ({
  db: (await import('../helpers/test-db')).testDb,
}))

const { requireAuth, requireRole, getSessionUser } = await import('@/lib/require-auth')
const { authOptions } = await import('@/lib/auth')

function reqWithCookie(cookie: string) {
  return new NextRequest('http://test.local/api/anything', { headers: { cookie } })
}

beforeAll(async () => {
  await assertIsTestSchema()
})
beforeEach(async () => {
  await resetDb()
})
afterAll(async () => {
  await resetDb()
})

describe('API-route chokepoint (require-auth.ts) — privileged roles re-check the DB', () => {
  it('a DEMOTED association user is rejected by requireRole on their very next request, using the stale JWT', async () => {
    const user = await testDb.user.create({
      data: { email: 'demote-me@test.local', role: 'association', password_hash: 'x' },
    })
    // Session minted while the user was still 'association'.
    const cookie = await sessionCookieFor(user.id, 'association')

    // Confirm access works before the change, to prove this is a real
    // before/after comparison and not a route that was always forbidden.
    const before = await requireRole(reqWithCookie(cookie), ['association', 'athlasx_ops'])
    expect(before).not.toHaveProperty('status') // NextResponse has .status; {user} doesn't

    // The DB-level revocation — the JWT cookie is untouched, still claims 'association'.
    await testDb.user.update({ where: { id: user.id }, data: { role: 'player' } })

    const after = await requireRole(reqWithCookie(cookie), ['association', 'athlasx_ops'])
    expect(after, 'the stale JWT claim must not keep granting association-only access').toHaveProperty('status', 403)
  })

  it('a REVOKED (deleted) privileged account is forced to re-authenticate, not treated as still-valid', async () => {
    const user = await testDb.user.create({
      data: { email: 'delete-me@test.local', role: 'athlasx_ops', password_hash: 'x' },
    })
    const cookie = await sessionCookieFor(user.id, 'athlasx_ops')

    const before = await getSessionUser(reqWithCookie(cookie))
    expect(before?.role).toBe('athlasx_ops')

    await testDb.user.delete({ where: { id: user.id } })

    const after = await getSessionUser(reqWithCookie(cookie))
    expect(after, 'a deleted account must not resolve to a valid session off a stale JWT').toBeNull()

    const authResult = await requireAuth(reqWithCookie(cookie))
    expect(authResult).toHaveProperty('status', 401)
  })

  it('a role change BETWEEN two privileged roles is picked up immediately (upgraded permissions, not just downgrades)', async () => {
    const user = await testDb.user.create({
      data: { email: 'reassign-me@test.local', role: 'scout', password_hash: 'x' },
    })
    const cookie = await sessionCookieFor(user.id, 'scout')

    await testDb.user.update({ where: { id: user.id }, data: { role: 'athlasx_ops' } })

    const session = await getSessionUser(reqWithCookie(cookie))
    expect(session?.role, 'the fresh DB role should be used, not the stale scout claim').toBe('athlasx_ops')
  })

  it('CONTROL — a player session is NOT re-checked against the DB (scoped narrowly, by design)', async () => {
    const user = await testDb.user.create({
      data: { email: 'stale-player@test.local', role: 'player', password_hash: 'x' },
    })
    const cookie = await sessionCookieFor(user.id, 'player')

    // Demote/change the DB role after the fact — a player-claimed session
    // must NOT reflect this, by design (see session-role-refresh.ts).
    await testDb.user.update({ where: { id: user.id }, data: { role: 'coach' } })

    const session = await getSessionUser(reqWithCookie(cookie))
    expect(
      session?.role,
      'player/coach sessions are deliberately NOT re-checked — this proves the DB query is scoped to the four privileged roles, not applied globally',
    ).toBe('player')
  })

  it('a malformed/forged JWT id (not a valid UUID) resolves to null instead of throwing (found via e2e: broke session resolution site-wide)', async () => {
    // User.id is @db.Uuid — db.user.findUnique with a non-UUID string
    // throws at the DB level rather than just missing. Caught this via a
    // real e2e failure: the landing-page e2e tests forge session cookies
    // with a plain string id like 'e2e-forged-user', which crashed session
    // resolution entirely for every privileged role once this fix's DB
    // re-check was added, before refreshPrivilegedRole caught the error.
    const cookie = await sessionCookieFor('not-a-valid-uuid-at-all', 'athlasx_ops')
    const session = await getSessionUser(reqWithCookie(cookie))
    expect(session, 'a malformed id must resolve to null, not throw').toBeNull()
  })

  it('CONTROL — a promotion from a non-privileged claim into a privileged role does not take effect on this request', async () => {
    const user = await testDb.user.create({
      data: { email: 'promote-me@test.local', role: 'player', password_hash: 'x' },
    })
    const cookie = await sessionCookieFor(user.id, 'player')

    await testDb.user.update({ where: { id: user.id }, data: { role: 'association' } })

    const session = await getSessionUser(reqWithCookie(cookie))
    expect(
      session?.role,
      'a promotion is only detected once the JWT claim is already privileged — this documents the intentional asymmetry, not a bug',
    ).toBe('player')
  })
})

describe('Page-shell chokepoint (auth.ts session callback) — same fix, same scoping', () => {
  it('the session callback returns the fresh DB role for a demoted association user', async () => {
    const user = await testDb.user.create({
      data: { email: 'demote-page@test.local', role: 'association', password_hash: 'x' },
    })
    await testDb.user.update({ where: { id: user.id }, data: { role: 'player' } })

    const session = await authOptions.callbacks!.session!({
      session: { user: {}, expires: '' } as never,
      token: { id: user.id, role: 'association', email: user.email } as never,
    } as never)

    expect((session.user as { role?: string }).role).toBe('player')
  })

  it('the session callback does not re-check a player claim', async () => {
    const user = await testDb.user.create({
      data: { email: 'stale-page-player@test.local', role: 'player', password_hash: 'x' },
    })
    await testDb.user.update({ where: { id: user.id }, data: { role: 'academy_admin' } })

    const session = await authOptions.callbacks!.session!({
      session: { user: {}, expires: '' } as never,
      token: { id: user.id, role: 'player', email: user.email } as never,
    } as never)

    expect((session.user as { role?: string }).role).toBe('player')
  })

  it('a deleted privileged account resolves to a role that matches no requirePageRole allowlist', async () => {
    const user = await testDb.user.create({
      data: { email: 'delete-page@test.local', role: 'academy_admin', password_hash: 'x' },
    })
    await testDb.user.delete({ where: { id: user.id } })

    const session = await authOptions.callbacks!.session!({
      session: { user: {}, expires: '' } as never,
      token: { id: user.id, role: 'academy_admin', email: user.email } as never,
    } as never)

    const role = (session.user as { role?: string }).role
    expect(['athlasx_ops', 'association', 'academy_admin', 'scout', 'player', 'coach', 'selection_panel']).not.toContain(role)
  })
})
