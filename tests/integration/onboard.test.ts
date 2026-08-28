/**
 * Integration — self-registered player onboarding.
 *
 * One POST creates a player User and a self-registered PlayerProfile,
 * issues a session cookie, and my-record then returns that profile.
 * Match statistics are never accepted on this path.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getSessionUser } from '@/lib/require-auth'
import {
  testDb,
  resetDb,
  assertIsTestSchema,
} from '../helpers/test-db'

vi.mock('@/lib/db', async () => ({
  db: (await import('../helpers/test-db')).testDb,
}))

const { POST: onboard } = await import('@/app/api/player/onboard/route')
const { GET: myRecord } = await import('@/app/api/my-record/route')

const post = (body: unknown) =>
  new NextRequest('http://test.local/api/player/onboard', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })

const adultBody = {
  email: 'arjun@test.local',
  password: 'a-strong-password',
  fullName: 'Arjun Sharma',
  dob: '2000-01-15',
  district: 'Kanpur',
  state: 'Uttar Pradesh',
  playingRole: 'Batsman',
  battingStyle: 'Right-handed',
  bowlingStyle: 'None',
  selectedFormats: ['T20'],
  academy: 'Tara Cricket Academy',
  batting_url: 'https://youtube.com/batting',
  bio: 'Kanpur opener',
}

beforeAll(async () => {
  await assertIsTestSchema()
})
beforeEach(async () => {
  await resetDb()
})
afterAll(async () => {
  await resetDb()
  await testDb.$disconnect()
})

describe('POST /api/player/onboard', () => {
  it('creates a self-registered player and signs them in so my-record returns the profile', async () => {
    const res = await onboard(post(adultBody))
    expect(res.status).toBe(200)

    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie, 'onboard must set a session cookie').toMatch(/next-auth\.session-token=/)
    const cookie = setCookie.split(';')[0]

    const sessionUser = await getSessionUser(
      new NextRequest('http://test.local/api', { headers: { cookie } }),
    )
    expect(sessionUser?.email).toBe('arjun@test.local')
    expect(sessionUser?.role).toBe('player')

    const mine = await myRecord(
      new NextRequest('http://test.local/api/my-record', { headers: { cookie } }),
    )
    expect(mine.status).toBe(200)
    const body = await mine.json()
    expect(body.player?.full_name).toBe('Arjun Sharma')
    expect(body.player?.playing_role).toBe('Batsman')
  })

  it('rejects self-reported match statistics and does not create a session', async () => {
    const res = await onboard(post({ ...adultBody, email: 'stats@test.local', runs: 842, wickets: 12 }))
    expect(res.status).toBe(400)

    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).not.toMatch(/next-auth\.session-token=/)

    const users = await testDb.user.findMany({ where: { email: 'stats@test.local' } })
    expect(users).toHaveLength(0)
  })

  it('refuses an under-18 player without a guardian phone', async () => {
    const res = await onboard(
      post({
        ...adultBody,
        email: 'minor@test.local',
        fullName: 'Rohan Sharma',
        dob: '2012-06-01',
        guardianPhone: '',
      }),
    )
    expect(res.status).toBe(400)
    expect(res.headers.get('set-cookie') ?? '').not.toMatch(/next-auth\.session-token=/)
  })

  it('grants consent for an adult and records guardian phone for a minor', async () => {
    const adult = await onboard(post({ ...adultBody, email: 'adult-consent@test.local' }))
    expect(adult.status).toBe(200)
    const adultId = (await adult.json()).playerId as string
    const adultProfile = await testDb.playerProfile.findUnique({ where: { id: adultId } })
    expect(adultProfile?.profile_source).toBe('self_registered')
    expect(adultProfile?.claim_status).toBe('claimed')
    expect(adultProfile?.consent_status).toBe('granted')

    const minorRes = await onboard(
      post({
        ...adultBody,
        email: 'minor-ok@test.local',
        fullName: 'Rohan Sharma',
        dob: '2012-06-01',
        guardianPhone: '+91 99988 87776',
      }),
    )
    expect(minorRes.status).toBe(200)
    const minorId = (await minorRes.json()).playerId as string
    const minorProfile = await testDb.playerProfile.findUnique({ where: { id: minorId } })
    expect(minorProfile?.guardian_phone).toBe('+91 99988 87776')
    expect(minorProfile?.profile_source).toBe('self_registered')
    expect(minorProfile?.claim_status).toBe('claimed')
    expect(minorProfile?.consent_status).toBe('pending')
  })

  it('rejects a second account with the same email', async () => {
    const first = await onboard(post(adultBody))
    expect(first.status).toBe(200)
    const again = await onboard(post({ ...adultBody, fullName: 'Duplicate Arjun' }))
    expect(again.status).toBe(409)
  })
})
