/**
 * Integration — W4 Selection Committee, blind grading boundary.
 *
 * The Pivot Document calls blind independent grading "the single most
 * valuable design choice" in the selection workflow: no selector may see
 * another's grade until the chair unlocks convergence. These tests exercise
 * the real route handlers against a real Postgres schema (athlasx_test).
 *
 * They cover the invariant, not the implementation: whatever the storage
 * shape, peers' grades must not leak before unlock.
 *
 * Every request below now carries a real, signed session
 * (tests/helpers/auth.ts, shared with tests/integration/consent-withdrawal
 * .test.ts) — grade/unlock/mine derive the caller's identity from that
 * session (never a client-supplied selectorId/chairId, see the auth-
 * hardening pass), so a test simulating "the chair" or "selector B" now
 * authenticates as that real user rather than naming them in the request
 * body, which the routes no longer read for identity at all.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { NextRequest } from 'next/server'
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

// Imported after mockDb() so they resolve '@/lib/db' to the test client.
const { POST: submitGrade } = await import('@/app/api/grading/[sessionId]/grade/route')
const { GET: myGrades } = await import('@/app/api/grading/[sessionId]/mine/route')
const { GET: convergence } = await import('@/app/api/grading/[sessionId]/convergence/route')
const { POST: unlock } = await import('@/app/api/grading/[sessionId]/unlock/route')
const { POST: lockSquad } = await import('@/app/api/grading/[sessionId]/lock-squad/route')
const { GET: gradingSession } = await import('@/app/api/grading/session/route')

const URL = 'http://test.local/api'

// Role on the JWT is now enforced: grading write/read is selection_panel only.
const asChair = (body?: unknown) =>
  body === undefined ? getAsUser(URL, fx.chair.id, 'selection_panel') : postAsUser(URL, fx.chair.id, 'selection_panel', body)
const asSelectorB = (body?: unknown) =>
  body === undefined ? getAsUser(URL, fx.selectorB.id, 'selection_panel') : postAsUser(URL, fx.selectorB.id, 'selection_panel', body)
const anonymousGet = () => new NextRequest(URL)

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

describe('submitting a grade', () => {
  it('accepts a valid grade and records a submission time', async () => {
    const res = await submitGrade(
      await asChair({ playerId: fx.adult.id, grade: 7, notes: 'solid' }),
      { params: { sessionId: fx.session.id } },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBeTruthy()
    expect(body.submitted_at).toBeTruthy()

    // The point of deriving selectorId from the session: confirm the row
    // actually recorded as the AUTHENTICATED chair, not an arbitrary id.
    const row = await testDb.grade.findUnique({ where: { id: body.id } })
    expect(row?.selector_id).toBe(fx.chair.id)
  })

  it('rejects grades outside 1–10', async () => {
    for (const grade of [0, 11, -3, 100]) {
      const res = await submitGrade(
        await asChair({ playerId: fx.adult.id, grade }),
        { params: { sessionId: fx.session.id } },
      )
      expect(res.status, `grade ${grade} should be rejected`).toBe(400)
    }
  })

  it('requires playerId and grade', async () => {
    // selectorId is no longer a request field at all (session-derived) —
    // the original test's "requires selectorId, playerId and grade" no
    // longer applies to selectorId specifically; playerId/grade validation
    // is unchanged.
    const res = await submitGrade(await asChair({ grade: 5 }), { params: { sessionId: fx.session.id } })
    expect(res.status).toBe(400)
  })

  it('rejects an anonymous caller (no session) rather than falling back to the request body', async () => {
    const res = await submitGrade(
      new NextRequest(URL, {
        method: 'POST',
        body: JSON.stringify({ selectorId: fx.chair.id, playerId: fx.adult.id, grade: 5 }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: { sessionId: fx.session.id } },
    )
    expect(res.status, 'a caller-supplied selectorId with no real session must not be honoured').toBe(401)
  })

  it('404s for an unknown session', async () => {
    const res = await submitGrade(
      await asChair({ playerId: fx.adult.id, grade: 5 }),
      { params: { sessionId: '00000000-0000-0000-0000-000000000000' } },
    )
    expect(res.status).toBe(404)
  })

  it('is idempotent per (session, selector, player) — a re-grade updates, not duplicates', async () => {
    const args = { params: { sessionId: fx.session.id } }
    await submitGrade(await asChair({ playerId: fx.adult.id, grade: 4 }), args)
    await submitGrade(await asChair({ playerId: fx.adult.id, grade: 9 }), args)

    const rows = await testDb.grade.findMany({
      where: { selection_session_id: fx.session.id, selector_id: fx.chair.id, player_id: fx.adult.id },
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].overall_grade).toBe(9)
  })
})

describe('blind boundary — before the chair unlocks', () => {
  beforeEach(async () => {
    const args = { params: { sessionId: fx.session.id } }
    await submitGrade(await asChair({ playerId: fx.adult.id, grade: 9 }), args)
    await submitGrade(await asSelectorB({ playerId: fx.adult.id, grade: 2 }), args)
  })

  it('refuses to serve the convergence view', async () => {
    const res = await convergence(await asChair(), { params: { sessionId: fx.session.id } })
    expect(res.status).toBe(403)
  })

  it('returns only the calling selector’s own grade from /mine', async () => {
    const res = await myGrades(await asChair(), { params: { sessionId: fx.session.id } })
    const { grades } = await res.json()
    expect(grades).toHaveLength(1)
    expect(grades[0].overall_grade).toBe(9) // the chair's own
  })

  it('does not leak the peer grade anywhere in the /mine payload', async () => {
    const res = await myGrades(await asChair(), { params: { sessionId: fx.session.id } })
    const raw = JSON.stringify(await res.json())
    // Selector B graded this player 2. Neither their identity nor that
    // value must appear in the chair's own /mine response.
    expect(raw).not.toContain(fx.selectorB.id)
    expect(JSON.parse(raw).grades.some((g: { overall_grade: number }) => g.overall_grade === 2)).toBe(false)
  })

  it('/mine for selector B independently returns only their own grade, not the chair’s', async () => {
    // The other half of the boundary: it's not just that the chair can't
    // see selector B's grade, selector B can't see the chair's either.
    const res = await myGrades(await asSelectorB(), { params: { sessionId: fx.session.id } })
    const body = await res.json()
    const { grades } = body
    expect(grades).toHaveLength(1)
    expect(grades[0].overall_grade).toBe(2)
    const raw = JSON.stringify(body)
    expect(raw).not.toContain(fx.chair.id)
  })

  it('rejects an anonymous caller on /mine rather than exposing anyone’s grades', async () => {
    const res = await myGrades(anonymousGet(), { params: { sessionId: fx.session.id } })
    expect(res.status).toBe(401)
  })
})

describe('unlocking convergence', () => {
  beforeEach(async () => {
    const args = { params: { sessionId: fx.session.id } }
    await submitGrade(await asChair({ playerId: fx.adult.id, grade: 9 }), args)
    await submitGrade(await asSelectorB({ playerId: fx.adult.id, grade: 2 }), args)
  })

  it('refuses a non-chair', async () => {
    // selectorB is real, authenticated, and simply isn't the chair —
    // chairId is derived from their own session, not asserted in the body.
    const res = await unlock(await asSelectorB({}), { params: { sessionId: fx.session.id } })
    expect(res.status).toBe(403)
  })

  it('lets the chair unlock, then serves convergence', async () => {
    const u = await unlock(await asChair({}), { params: { sessionId: fx.session.id } })
    expect(u.status).toBe(200)

    const res = await convergence(await asChair(), { params: { sessionId: fx.session.id } })
    expect(res.status).toBe(200)
  })

  it('is not repeatable', async () => {
    await unlock(await asChair({}), { params: { sessionId: fx.session.id } })
    const again = await unlock(await asChair({}), { params: { sessionId: fx.session.id } })
    expect(again.status).toBe(409)
  })

  it('closes grading once convergence is open', async () => {
    await unlock(await asChair({}), { params: { sessionId: fx.session.id } })
    const late = await submitGrade(
      await asChair({ playerId: fx.minor.id, grade: 6 }),
      { params: { sessionId: fx.session.id } },
    )
    expect(late.status).toBe(409)
  })
})

describe('T-GRADE-AUTH — non-selectors are blocked from every grading write path', () => {
  // Synthetic ids: the JWT role claim alone is what gets checked before any
  // DB write is attempted, so these never need to exist as real rows — the
  // same class of caller this session's live walkthrough used to prove the
  // escalation (a real player-role user, no selection_panel role, no
  // AssociationStaff row, successfully POSTed a grade and got a real Grade
  // row created).
  const asPlayer = (body?: unknown) =>
    body === undefined
      ? getAsUser(URL, '11111111-1111-1111-1111-111111111111', 'player')
      : postAsUser(URL, '11111111-1111-1111-1111-111111111111', 'player', body)
  const asCoach = (body?: unknown) =>
    postAsUser(URL, '22222222-2222-2222-2222-222222222222', 'coach', body)
  const asStaffer = (body?: unknown) =>
    postAsUser(URL, '33333333-3333-3333-3333-333333333333', 'association', body)

  it('rejects a player POSTing a grade — the exact escalation live-proved against the real DB', async () => {
    const res = await submitGrade(
      await asPlayer({ playerId: fx.adult.id, grade: 9 }),
      { params: { sessionId: fx.session.id } },
    )
    expect(res.status).toBe(403)
    const rows = await testDb.grade.findMany({ where: { selection_session_id: fx.session.id } })
    expect(rows).toHaveLength(0)
  })

  it('rejects a coach POSTing a grade', async () => {
    const res = await submitGrade(
      await asCoach({ playerId: fx.adult.id, grade: 9 }),
      { params: { sessionId: fx.session.id } },
    )
    expect(res.status).toBe(403)
  })

  it('rejects an association staffer POSTing a grade', async () => {
    const res = await submitGrade(
      await asStaffer({ playerId: fx.adult.id, grade: 9 }),
      { params: { sessionId: fx.session.id } },
    )
    expect(res.status).toBe(403)
  })

  it('rejects a non-selector unlocking convergence', async () => {
    const res = await unlock(await asPlayer({}), { params: { sessionId: fx.session.id } })
    expect(res.status).toBe(403)
  })

  it('rejects a non-selector reading /mine', async () => {
    const res = await myGrades(await asPlayer(), { params: { sessionId: fx.session.id } })
    expect(res.status).toBe(403)
  })

  it('rejects a non-selector locking the squad', async () => {
    const res = await lockSquad(
      await asPlayer({ playerIds: [fx.adult.id] }),
      { params: { sessionId: fx.session.id } },
    )
    expect(res.status).toBe(403)
  })

  it('a legitimate selection_panel member on this session still succeeds', async () => {
    const res = await submitGrade(
      await asChair({ playerId: fx.adult.id, grade: 8 }),
      { params: { sessionId: fx.session.id } },
    )
    expect(res.status).toBe(200)
  })
})

describe('convergence view — after unlock', () => {
  beforeEach(async () => {
    const args = { params: { sessionId: fx.session.id } }
    await submitGrade(await asChair({ playerId: fx.adult.id, grade: 9 }), args)
    await submitGrade(await asSelectorB({ playerId: fx.adult.id, grade: 2 }), args)
    await unlock(await asChair({}), args)
  })

  it('reports the distribution, not just an average', async () => {
    // Pivot Document W4: "9/9/2 is different from 5/5/5" — an average alone
    // destroys the disagreement the view exists to surface.
    const res = await convergence(await asChair(), { params: { sessionId: fx.session.id } })
    const body = await res.json()
    const view = (body.views ?? body)[0] ?? Object.values(body)[0]
    const asText = JSON.stringify(body)
    expect(asText).toMatch(/distribution/)
    expect(view).toBeTruthy()
  })

  it('labels a 9-vs-2 split as contested rather than unanimous', async () => {
    const res = await convergence(await asChair(), { params: { sessionId: fx.session.id } })
    const body = JSON.stringify(await res.json())
    expect(body).not.toMatch(/unanimous/)
    expect(body).toMatch(/contested|split/)
  })
})

describe('session identity — graders act as themselves', () => {
  it('tells the chair they are the chair, and a peer they are not', async () => {
    const chairBody = await (await gradingSession(await asChair())).json()
    expect(chairBody.is_chair).toBe(true)

    const peerBody = await (await gradingSession(await asSelectorB())).json()
    expect(peerBody.session?.id).toBe(fx.session.id)
    expect(peerBody.is_chair).toBe(false)
  })

  it('does not return an acting-as selector pool', async () => {
    const body = await (await gradingSession(await asChair())).json()
    expect(body.selectors).toBeUndefined()
  })
})

describe('caller-supplied identity cannot change who is grading or unlocking', () => {
  it('records a grade as the authenticated selector even when the body names the chair', async () => {
    const res = await submitGrade(
      await asSelectorB({ selectorId: fx.chair.id, playerId: fx.adult.id, grade: 3 }),
      { params: { sessionId: fx.session.id } },
    )
    expect(res.status).toBe(200)
    const { id } = await res.json()
    const row = await testDb.grade.findUnique({ where: { id } })
    expect(row?.selector_id).toBe(fx.selectorB.id)
    expect(row?.selector_id).not.toBe(fx.chair.id)
  })

  it('/mine ignores a query selectorId and returns only the caller’s own grades', async () => {
    const args = { params: { sessionId: fx.session.id } }
    await submitGrade(await asChair({ playerId: fx.adult.id, grade: 9 }), args)
    await submitGrade(await asSelectorB({ playerId: fx.adult.id, grade: 2 }), args)

    const res = await myGrades(
      await getAsUser(`${URL}?selectorId=${fx.chair.id}`, fx.selectorB.id, 'selection_panel'),
      args,
    )
    const { grades } = await res.json()
    expect(grades).toHaveLength(1)
    expect(grades[0].overall_grade).toBe(2)
  })

  it('refuses unlock when a non-chair supplies the chair id in the body', async () => {
    const res = await unlock(
      await asSelectorB({ chairId: fx.chair.id }),
      { params: { sessionId: fx.session.id } },
    )
    expect(res.status).toBe(403)
    const session = await testDb.selectionSession.findUnique({ where: { id: fx.session.id } })
    expect(session?.convergence_unlocked_at).toBeNull()
  })

  it('refuses lock-squad when a non-chair supplies the chair id in the body', async () => {
    const args = { params: { sessionId: fx.session.id } }
    await unlock(await asChair({}), args)

    const res = await lockSquad(
      await asSelectorB({ chairId: fx.chair.id, playerIds: [fx.adult.id] }),
      args,
    )
    expect(res.status).toBe(403)
    const locked = await testDb.selectionSession.findUnique({ where: { id: fx.session.id } })
    expect(locked?.squad_locked_at).toBeNull()
  })

  it('lets the chair lock the squad without naming themselves in the body', async () => {
    const args = { params: { sessionId: fx.session.id } }
    await unlock(await asChair({}), args)

    const res = await lockSquad(
      await asChair({ playerIds: [fx.adult.id] }),
      args,
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.locked).toBe(true)
    expect(body.count).toBe(1)
  })
})
