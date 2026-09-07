/**
 * Integration — player-facing visibility control (PATCH /api/player/visibility).
 *
 * A player may only ever change their OWN linked PlayerProfile's
 * visibility_tier, derived from their own session's User.linked_player_id —
 * never from a client-supplied player id. franchise_scout is never a
 * selectable value on this route (hard-disabled, see feature-flags.ts).
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { vi } from 'vitest'
import {
  testDb,
  resetDb,
  seedFixtures,
  assertIsTestSchema,
  type Fixtures,
} from '../helpers/test-db'
import { patchAsUser, getAsUser } from '../helpers/auth'

vi.mock('@/lib/db', async () => ({
  db: (await import('../helpers/test-db')).testDb,
}))

const { GET: getVisibility, PATCH: patchVisibility } = await import('@/app/api/player/visibility/route')

let fx: Fixtures

beforeAll(async () => {
  await assertIsTestSchema()
})

beforeEach(async () => {
  await resetDb()
  fx = await seedFixtures()
})

afterAll(async () => {
  await testDb.$disconnect()
})

async function linkPlayer(userId: string, playerId: string) {
  await testDb.user.update({ where: { id: userId }, data: { linked_player_id: playerId } })
}

describe('PATCH /api/player/visibility', () => {
  it("updates the caller's own linked player's visibility tier", async () => {
    await linkPlayer(fx.chair.id, fx.adult.id)

    const res = await patchVisibility(
      await patchAsUser('http://test.local/api/player/visibility', fx.chair.id, 'player', {
        visibility_tier: 'cross_association',
      }),
    )
    expect(res.status).toBe(200)

    const updated = await testDb.playerProfile.findUnique({ where: { id: fx.adult.id } })
    expect(updated?.visibility_tier).toBe('cross_association')
  })

  it("cannot change another player's visibility tier", async () => {
    // fx.chair is linked to fx.adult; selectorB is a real signed-in caller
    // linked to a *different* player (fx.minor) — they must not be able to
    // affect fx.adult's row no matter what id they might try to smuggle in.
    await linkPlayer(fx.chair.id, fx.adult.id)
    await linkPlayer(fx.selectorB.id, fx.minor.id)

    const res = await patchVisibility(
      await patchAsUser('http://test.local/api/player/visibility', fx.selectorB.id, 'player', {
        visibility_tier: 'cross_association',
        // Even if a client tried to name the target explicitly, the route
        // never reads a body-supplied player id — only the session's own
        // linked_player_id decides which row is touched.
        playerId: fx.adult.id,
      }),
    )
    expect(res.status).toBe(200)

    const adultRow = await testDb.playerProfile.findUnique({ where: { id: fx.adult.id } })
    const minorRow = await testDb.playerProfile.findUnique({ where: { id: fx.minor.id } })
    expect(adultRow?.visibility_tier).toBe('association_only')
    expect(minorRow?.visibility_tier).toBe('cross_association')
  })

  it('rejects franchise_scout — never a selectable value on this route', async () => {
    await linkPlayer(fx.chair.id, fx.adult.id)

    const res = await patchVisibility(
      await patchAsUser('http://test.local/api/player/visibility', fx.chair.id, 'player', {
        visibility_tier: 'franchise_scout',
      }),
    )
    expect(res.status).toBe(400)

    const unchanged = await testDb.playerProfile.findUnique({ where: { id: fx.adult.id } })
    expect(unchanged?.visibility_tier).toBe('association_only')
  })

  it('404s a caller with no linked player profile', async () => {
    const res = await patchVisibility(
      await patchAsUser('http://test.local/api/player/visibility', fx.selectorB.id, 'player', {
        visibility_tier: 'cross_association',
      }),
    )
    expect(res.status).toBe(404)
  })

  it('401s an anonymous caller', async () => {
    const req = new (await import('next/server')).NextRequest('http://test.local/api/player/visibility', {
      method: 'PATCH',
      body: JSON.stringify({ visibility_tier: 'cross_association' }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await patchVisibility(req)
    expect(res.status).toBe(401)
  })

  it("GET returns the caller's own current tier", async () => {
    await linkPlayer(fx.chair.id, fx.adult.id)
    const res = await getVisibility(await getAsUser('http://test.local/api/player/visibility', fx.chair.id, 'player'))
    const data = await res.json()
    expect(data.player.id).toBe(fx.adult.id)
    expect(data.player.visibility_tier).toBe('association_only')
  })
})
