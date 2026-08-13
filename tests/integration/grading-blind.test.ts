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

vi.mock('@/lib/db', async () => ({
  db: (await import('../helpers/test-db')).testDb,
}))

// Imported after mockDb() so they resolve '@/lib/db' to the test client.
const { POST: submitGrade } = await import('@/app/api/grading/[sessionId]/grade/route')
const { GET: myGrades } = await import('@/app/api/grading/[sessionId]/mine/route')
const { GET: convergence } = await import('@/app/api/grading/[sessionId]/convergence/route')
const { POST: unlock } = await import('@/app/api/grading/[sessionId]/unlock/route')

const post = (body: unknown) =>
  new NextRequest('http://test.local/api', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })

const get = (url: string) => new NextRequest(url)

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
      post({ selectorId: fx.chair.id, playerId: fx.adult.id, grade: 7, notes: 'solid' }),
      { params: { sessionId: fx.session.id } },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBeTruthy()
    expect(body.submitted_at).toBeTruthy()
  })

  it('rejects grades outside 1–10', async () => {
    for (const grade of [0, 11, -3, 100]) {
      const res = await submitGrade(
        post({ selectorId: fx.chair.id, playerId: fx.adult.id, grade }),
        { params: { sessionId: fx.session.id } },
      )
      expect(res.status, `grade ${grade} should be rejected`).toBe(400)
    }
  })

  it('requires selectorId, playerId and grade', async () => {
    const res = await submitGrade(post({ grade: 5 }), { params: { sessionId: fx.session.id } })
    expect(res.status).toBe(400)
  })

  it('404s for an unknown session', async () => {
    const res = await submitGrade(
      post({ selectorId: fx.chair.id, playerId: fx.adult.id, grade: 5 }),
      { params: { sessionId: '00000000-0000-0000-0000-000000000000' } },
    )
    expect(res.status).toBe(404)
  })

  it('is idempotent per (session, selector, player) — a re-grade updates, not duplicates', async () => {
    const args = { params: { sessionId: fx.session.id } }
    await submitGrade(post({ selectorId: fx.chair.id, playerId: fx.adult.id, grade: 4 }), args)
    await submitGrade(post({ selectorId: fx.chair.id, playerId: fx.adult.id, grade: 9 }), args)

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
    await submitGrade(post({ selectorId: fx.chair.id, playerId: fx.adult.id, grade: 9 }), args)
    await submitGrade(post({ selectorId: fx.selectorB.id, playerId: fx.adult.id, grade: 2 }), args)
  })

  it('refuses to serve the convergence view', async () => {
    const res = await convergence(get('http://test.local/api'), {
      params: { sessionId: fx.session.id },
    })
    expect(res.status).toBe(403)
  })

  it('returns only the calling selector’s own grade from /mine', async () => {
    const res = await myGrades(
      get(`http://test.local/api?selectorId=${fx.chair.id}`),
      { params: { sessionId: fx.session.id } },
    )
    const { grades } = await res.json()
    expect(grades).toHaveLength(1)
    expect(grades[0].overall_grade).toBe(9) // the chair's own
  })

  it('does not leak the peer grade anywhere in the /mine payload', async () => {
    const res = await myGrades(
      get(`http://test.local/api?selectorId=${fx.chair.id}`),
      { params: { sessionId: fx.session.id } },
    )
    const raw = JSON.stringify(await res.json())
    // Selector B graded this player 2. That value must not appear.
    expect(raw).not.toContain(fx.selectorB.id)
    expect(JSON.parse(raw).grades.some((g: { overall_grade: number }) => g.overall_grade === 2)).toBe(false)
  })

  it('requires selectorId on /mine rather than defaulting to everyone', async () => {
    const res = await myGrades(get('http://test.local/api'), {
      params: { sessionId: fx.session.id },
    })
    expect(res.status).toBe(400)
  })
})

describe('unlocking convergence', () => {
  beforeEach(async () => {
    const args = { params: { sessionId: fx.session.id } }
    await submitGrade(post({ selectorId: fx.chair.id, playerId: fx.adult.id, grade: 9 }), args)
    await submitGrade(post({ selectorId: fx.selectorB.id, playerId: fx.adult.id, grade: 2 }), args)
  })

  it('refuses a non-chair', async () => {
    const res = await unlock(post({ chairId: fx.selectorB.id }), {
      params: { sessionId: fx.session.id },
    })
    expect(res.status).toBe(403)
  })

  it('lets the chair unlock, then serves convergence', async () => {
    const u = await unlock(post({ chairId: fx.chair.id }), {
      params: { sessionId: fx.session.id },
    })
    expect(u.status).toBe(200)

    const res = await convergence(get('http://test.local/api'), {
      params: { sessionId: fx.session.id },
    })
    expect(res.status).toBe(200)
  })

  it('is not repeatable', async () => {
    await unlock(post({ chairId: fx.chair.id }), { params: { sessionId: fx.session.id } })
    const again = await unlock(post({ chairId: fx.chair.id }), {
      params: { sessionId: fx.session.id },
    })
    expect(again.status).toBe(409)
  })

  it('closes grading once convergence is open', async () => {
    await unlock(post({ chairId: fx.chair.id }), { params: { sessionId: fx.session.id } })
    const late = await submitGrade(
      post({ selectorId: fx.chair.id, playerId: fx.minor.id, grade: 6 }),
      { params: { sessionId: fx.session.id } },
    )
    expect(late.status).toBe(409)
  })
})

describe('convergence view — after unlock', () => {
  beforeEach(async () => {
    const args = { params: { sessionId: fx.session.id } }
    await submitGrade(post({ selectorId: fx.chair.id, playerId: fx.adult.id, grade: 9 }), args)
    await submitGrade(post({ selectorId: fx.selectorB.id, playerId: fx.adult.id, grade: 2 }), args)
    await unlock(post({ chairId: fx.chair.id }), args)
  })

  it('reports the distribution, not just an average', async () => {
    // Pivot Document W4: "9/9/2 is different from 5/5/5" — an average alone
    // destroys the disagreement the view exists to surface.
    const res = await convergence(get('http://test.local/api'), {
      params: { sessionId: fx.session.id },
    })
    const body = await res.json()
    const view = (body.views ?? body)[0] ?? Object.values(body)[0]
    const asText = JSON.stringify(body)
    expect(asText).toMatch(/distribution/)
    expect(view).toBeTruthy()
  })

  it('labels a 9-vs-2 split as contested rather than unanimous', async () => {
    const res = await convergence(get('http://test.local/api'), {
      params: { sessionId: fx.session.id },
    })
    const body = JSON.stringify(await res.json())
    expect(body).not.toMatch(/unanimous/)
    expect(body).toMatch(/contested|split/)
  })
})
