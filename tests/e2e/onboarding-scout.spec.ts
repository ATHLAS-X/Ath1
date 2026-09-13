/**
 * E2E — /scout/onboarding, src/app/scout/onboarding/page.tsx +
 * POST /api/scout/onboard, plus the scout-visibility safety check (S5).
 *
 * SCOUT_SELF_SERVE_ENABLED defaults to TRUE — S1-S5/S7 run against that
 * default with no env changes. S6 needs the flag OFF; toggle
 * NEXT_PUBLIC_SCOUT_SELF_SERVE_ENABLED=false locally, rebuild, run S6,
 * then revert.
 *
 * S4 and S5 need state a public flow can't produce (an ops-approved scout;
 * a real adult+minor player pair). Both use direct Prisma access against
 * the SAME live "athlasx" schema this e2e suite's `next start` server
 * reads — disposable, clearly-tagged rows, cleaned up in `finally`, same
 * convention this whole e2e suite already uses for disposable User rows
 * created via the real signup APIs. Nothing here uses the isolated test
 * schema (that's vitest's lane, not Playwright's).
 */
// Load .env.local the way Next does — Playwright's own test process
// (unlike the `next start` server under test) does not auto-load it, so
// importing src/lib/db directly here would otherwise fail with "DATABASE_URL
// not found". Same loader tests/helpers/load-env.ts gives vitest.
import '../helpers/load-env'
import { test, expect, type Page } from '@playwright/test'
// Relative import — Playwright's own ts-node-style transform doesn't
// necessarily share Next's "@/" path alias resolution, so this reaches
// src/lib/db directly rather than risking that.
import { db } from '../../src/lib/db'

function uniqueEmail(tag: string): string {
  return `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.local`
}
let mobileCounter = 0
function uniqueMobile(): string {
  mobileCounter += 1
  return (6000000000 + (Date.now() % 3000000000) + mobileCounter).toString().slice(0, 10).padEnd(10, '2')
}
const STRONG_PASSWORD = 'Zq9vXk4mPr7wLj2'

async function completeStep1(page: Page, mobile: string, email: string) {
  await page.goto('/scout/onboarding')
  await page.getByPlaceholder('98765 43210').fill(mobile)
  await page.getByRole('button', { name: 'Send OTP' }).click()
  await expect(page.getByText('Dev mode — no SMS gateway connected')).toBeVisible()
  const code = await page.locator('span.font-mono.font-bold').textContent()
  const digits = (code ?? '').trim().split('')
  const otpInputs = page.locator('input[maxlength="1"]')
  for (let i = 0; i < digits.length; i++) await otpInputs.nth(i).fill(digits[i])
  await page.getByRole('button', { name: 'Verify', exact: true }).click()
  await expect(page.getByText('Mobile number verified')).toBeVisible()
  await page.getByPlaceholder('you@franchise.com').fill(email)
  await page.getByPlaceholder('Choose a password').fill(STRONG_PASSWORD)
}

test.describe('S1 — Step 1 phone OTP + email/password, client-side-only Verify', () => {
  test('Verify fires no network request', async ({ page }) => {
    const mobile = uniqueMobile()
    await page.goto('/scout/onboarding')
    await page.getByPlaceholder('98765 43210').fill(mobile)

    const networkCalls: string[] = []
    page.on('request', (r) => { if (r.url().includes('/api/')) networkCalls.push(r.url()) })
    await page.getByRole('button', { name: 'Send OTP' }).click()
    await expect(page.getByText('Dev mode — no SMS gateway connected')).toBeVisible()
    networkCalls.length = 0

    const code = await page.locator('span.font-mono.font-bold').textContent()
    const digits = (code ?? '').trim().split('')
    const otpInputs = page.locator('input[maxlength="1"]')
    for (let i = 0; i < digits.length; i++) await otpInputs.nth(i).fill(digits[i])
    await page.getByRole('button', { name: 'Verify', exact: true }).click()
    await expect(page.getByText('Mobile number verified')).toBeVisible()
    expect(networkCalls, 'Verify at Step 1 is client-side only').toHaveLength(0)
  })
})

test.describe('S2 — submit creates a ScoutProfile with verification_status explicitly \'pending\'', () => {
  test('confirmed by reading the actual created row, not just a 200 response', async ({ page }) => {
    const email = uniqueEmail('s2-pending')
    await completeStep1(page, uniqueMobile(), email)
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Your organization' })).toBeVisible()
    await page.getByPlaceholder('e.g. Mumbai Indians').fill('E2E Test Franchise')
    await page.getByText('Franchise', { exact: true }).click()
    await page.getByRole('button', { name: 'Finish' }).click()
    await expect(page.getByRole('heading', { name: 'Account created.' })).toBeVisible()

    const user = await db.user.findUnique({ where: { email }, include: { scout_profile: true } })
    expect(user?.role).toBe('scout')
    expect(user?.scout_profile?.verification_status, 'the row itself, not the API response, is the source of truth here').toBe('pending')
  })
})

test.describe('S3 — immediately after signup, /scout redirects to /scout/pending', () => {
  test('not the real dashboard', async ({ page }) => {
    const email = uniqueEmail('s3-pending-redirect')
    await completeStep1(page, uniqueMobile(), email)
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByPlaceholder('e.g. Mumbai Indians').fill('E2E Test Franchise')
    await page.getByText('Franchise', { exact: true }).click()
    await page.getByRole('button', { name: 'Finish' }).click()
    await expect(page.getByRole('heading', { name: 'Account created.' })).toBeVisible()

    await page.goto('/scout')
    await expect(page).toHaveURL(/\/scout\/pending$/)
  })
})

test.describe('S4 — after approval, /scout is reachable WITHOUT re-login', () => {
  test('isScoutVerified re-queries the DB live, not a stale session claim', async ({ page }) => {
    const email = uniqueEmail('s4-liveapproval')
    await completeStep1(page, uniqueMobile(), email)
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await page.getByPlaceholder('e.g. Mumbai Indians').fill('E2E Test Franchise')
    await page.getByText('Franchise', { exact: true }).click()
    await page.getByRole('button', { name: 'Finish' }).click()
    await expect(page.getByRole('heading', { name: 'Account created.' })).toBeVisible()

    // Confirm the pending state first (same as S3).
    await page.goto('/scout')
    await expect(page).toHaveURL(/\/scout\/pending$/)

    // Equivalent of what the ops approval route (PATCH
    // /api/ops/scouts/[id]/verification) does — a direct DB update to the
    // same field that route writes, since exercising it live needs an
    // athlasx_ops credential this test doesn't have. What's actually being
    // tested here is the READ side (isScoutVerified's live DB re-check),
    // not the ops UI itself.
    const user = await db.user.findUnique({ where: { email }, select: { id: true } })
    await db.scoutProfile.update({ where: { user_id: user!.id }, data: { verification_status: 'approved' } })

    // Same browser session/cookies — no re-login, no page reload of /auth,
    // just a fresh navigation using the SAME session cookie already held.
    await page.goto('/scout')
    await expect(page, 'access must unlock live, off the same session, because isScoutVerified queries the DB per request').not.toHaveURL(/\/scout\/pending$/)
    // Two h1s exist on this shell (dashboard chrome's own title + this
    // page's own "Talent Pool" heading) — target the real scout page content.
    await expect(page.getByRole('heading', { name: 'Talent Pool' })).toBeVisible()
  })
})

test.describe('S5 (PRIORITY — safety, not a UI-copy test) — an approved scout genuinely cannot see a minor, anywhere', () => {
  test('creates a real adult and a real minor player, confirms only the adult is reachable through every scout-accessible endpoint', async ({ page, baseURL }) => {
    void baseURL
    const tag = `s5-${Date.now()}`
    const created: { table: 'association' | 'playerProfile' | 'user' | 'scoutProfile'; id: string }[] = []

    try {
      const assoc = await db.association.create({
        data: { name: `${tag}-assoc`, type: 'state', state: 'AuditState', data_sharing_signed: true },
      })
      created.push({ table: 'association', id: assoc.id })

      const now = Date.now()
      const yearsAgo = (y: number) => new Date(now - y * 365.25 * 24 * 3600 * 1000)

      const adult = await db.playerProfile.create({
        data: {
          full_name: `${tag}-adult`, dob: yearsAgo(22), district: 'AuditDistrict', state: 'AuditState',
          playing_role: 'Batsman', profile_source: 'ingest', association_id: assoc.id,
          claim_status: 'unclaimed', consent_status: 'granted', visibility_tier: 'franchise_scout',
        },
      })
      created.push({ table: 'playerProfile', id: adult.id })

      const minor = await db.playerProfile.create({
        data: {
          full_name: `${tag}-minor`, dob: yearsAgo(15), district: 'AuditDistrict', state: 'AuditState',
          playing_role: 'Bowler', profile_source: 'ingest', association_id: assoc.id,
          claim_status: 'unclaimed', consent_status: 'granted', visibility_tier: 'franchise_scout',
        },
      })
      created.push({ table: 'playerProfile', id: minor.id })

      // A REAL scout account through the REAL wizard, then approved (see
      // S4's own comment on why approval is a direct DB write here).
      const scoutEmail = uniqueEmail('s5-scout')
      await completeStep1(page, uniqueMobile(), scoutEmail)
      await page.getByRole('button', { name: 'Continue', exact: true }).click()
      await page.getByPlaceholder('e.g. Mumbai Indians').fill('E2E S5 Franchise')
      await page.getByText('Franchise', { exact: true }).click()
      await page.getByRole('button', { name: 'Finish' }).click()
      await expect(page.getByRole('heading', { name: 'Account created.' })).toBeVisible()

      const scoutUser = await db.user.findUnique({ where: { email: scoutEmail } })
      created.push({ table: 'user', id: scoutUser!.id })
      const scoutProfile = await db.scoutProfile.update({
        where: { user_id: scoutUser!.id },
        data: { verification_status: 'approved' },
      })
      created.push({ table: 'scoutProfile', id: scoutProfile.id })

      // Check 1: the direct scout-facing endpoint.
      const candidatesRes = await page.request.get('/api/scout/candidates')
      const candidatesBody = await candidatesRes.json()
      const candidateNames = (candidatesBody.candidates ?? []).map((c: { name: string }) => c.name)
      expect(candidateNames).toContain(adult.full_name)
      expect(candidateNames, 'a minor must never appear in the scout candidate list, even on franchise_scout tier').not.toContain(minor.full_name)

      // Check 2: every OTHER endpoint this scout session can call that
      // touches player-shaped data — the actual point of S5. A scout has
      // no association affiliation, so these should all come back empty
      // or adult-only; if the minor's name appears ANYWHERE below, that's
      // the priority-one finding.
      const trackingRes = await page.request.get('/api/tracking')
      const trackingBody = await trackingRes.json()
      const trackingNames = (trackingBody.players ?? []).map((p: { name: string }) => p.name)

      const squadRes = await page.request.get('/api/coach/squad')
      const squadBody = await squadRes.json()

      const poolRes = await page.request.get('/api/candidate-pool')
      const poolBody = await poolRes.json()

      const minorLeaked = trackingNames.includes(minor.full_name)
      test.info().annotations.push({
        type: 'S5-safety-result',
        description: minorLeaked
          ? `PRIORITY-ONE FINDING (already known, still open as of this run): /api/tracking returned the minor "${minor.full_name}" ` +
            'to an approved scout session. This reproduces the confirmed vulnerability from the earlier scout-minor-visibility audit ' +
            '(tests/security/scout-minor-visibility-audit.test.ts) — visibilityWhere() treats any cross_association/franchise_scout-tier ' +
            'player the same regardless of caller role, and /api/tracking has no scout-specific exclusion. This player was even set to ' +
            'franchise_scout directly (not the cross_association bypass) — if this fires, the leak is broader than previously scoped.'
          : `/api/tracking correctly excluded the minor. /api/coach/squad returned ${JSON.stringify(squadBody)}. ` +
            `/api/candidate-pool returned ${JSON.stringify(poolBody)} (both expected empty for a scout with no association scope).`,
      })

      expect(candidatesRes.status()).toBe(200)
      expect(squadBody.squad).toEqual([])
      expect(poolBody.candidates).toEqual([])
      expect(
        minorLeaked,
        'SAFETY CHECK: a minor must not be reachable through ANY scout-accessible endpoint, not just /api/scout/candidates',
      ).toBe(false)
    } finally {
      for (const row of created.filter((r) => r.table === 'scoutProfile')) await db.scoutProfile.delete({ where: { id: row.id } }).catch(() => {})
      for (const row of created.filter((r) => r.table === 'user')) await db.user.delete({ where: { id: row.id } }).catch(() => {})
      for (const row of created.filter((r) => r.table === 'playerProfile')) await db.playerProfile.delete({ where: { id: row.id } }).catch(() => {})
      for (const row of created.filter((r) => r.table === 'association')) await db.association.delete({ where: { id: row.id } }).catch(() => {})
    }
  })
})

test.describe('S6 — flag OFF: server rejects direct POST independent of the UI', () => {
  test('POST /api/scout/onboard returns 404 (scoutGate)', async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin
    const res = await page.request.post('/api/scout/onboard', {
      data: { mobile: uniqueMobile(), requestId: 'x', otp: '000000', email: uniqueEmail('s6'), password: STRONG_PASSWORD, org_name: 'X', org_type: 'franchise' },
      headers: { origin },
    })
    if (res.status() === 400) {
      test.info().annotations.push({
        type: 'flag-state',
        description: 'Got 400, not 404 — SCOUT_SELF_SERVE_ENABLED is currently ON (its default). Re-run this file with the flag OFF to actually exercise S6.',
      })
      test.skip(true, 'SCOUT_SELF_SERVE_ENABLED is on (default) — flip it off locally to test S6')
    }
    expect(res.status()).toBe(404)
    expect((await res.json()).error).toBe('Scout accounts are not available yet')
  })
})

test.describe('S7 — OTP-verify rate limiting: 11th attempt for one phone within an hour', () => {
  test('429 once the cap is exceeded', async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin
    const mobile = uniqueMobile()
    const otpRes = await page.request.post('/api/scout/onboard/send-otp', { data: { mobile }, headers: { origin } })
    const { requestId } = await otpRes.json()

    const statuses: number[] = []
    for (let i = 0; i < 11; i++) {
      const res = await page.request.post('/api/scout/onboard', {
        data: { mobile, requestId, otp: '000000', email: uniqueEmail(`s7-${i}`), password: STRONG_PASSWORD, org_name: 'X', org_type: 'franchise' },
        headers: { origin },
      })
      statuses.push(res.status())
    }
    expect(statuses.slice(0, 10).every((s) => s === 400), 'the first 10 wrong-OTP attempts should all just be normal 400s').toBe(true)
    expect(statuses[10], 'the 11th attempt within the hour must be rate-limited').toBe(429)
  })
})
