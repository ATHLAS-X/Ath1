/**
 * E2E — /academy/onboarding, src/app/academy/onboarding/page.tsx +
 * POST /api/academy/onboard (src/app/api/academy/onboard/route.ts).
 *
 * ACADEMY_SELF_SERVE_ENABLED defaults to false. A1/A2 run against that
 * default. A3-A6 require the flag ON — run this file with
 * NEXT_PUBLIC_ACADEMY_SELF_SERVE_ENABLED=true set in .env.local (local
 * only, never committed) and the app rebuilt, then revert both after.
 * Each A3-A6 test self-skips with a clear reason if it detects the flag
 * is actually off, rather than failing opaquely.
 */
import { test, expect } from '@playwright/test'

function uniqueEmail(tag: string): string {
  return `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.local`
}
let mobileCounter = 0
function uniqueMobile(): string {
  mobileCounter += 1
  return (6000000000 + (Date.now() % 3000000000) + mobileCounter).toString().slice(0, 10).padEnd(10, '1')
}
const STRONG_PASSWORD = 'Zq9vXk4mPr7wLj2'

test.describe('A1 — flag OFF (default): static "not available yet" notice', () => {
  test('renders the notice, not the wizard', async ({ page }) => {
    await page.goto('/academy/onboarding')
    await expect(page.getByRole('heading', { name: "Academy sign-up isn't available yet" })).toBeVisible()
    await expect(page.getByText('AthlasX doesn\'t currently offer self-serve academy accounts')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back to AthlasX' })).toHaveAttribute('href', '/')
    // The wizard itself must not be present at all.
    await expect(page.getByPlaceholder('98765 43210')).toHaveCount(0)
  })
})

test.describe('A2 — flag OFF: server rejects direct POST independent of the UI', () => {
  test('POST /api/academy/onboard returns 404 (academyGate), not a validation error', async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin
    const res = await page.request.post('/api/academy/onboard', {
      data: { mobile: uniqueMobile(), requestId: 'x', otp: '000000', email: uniqueEmail('a2'), password: STRONG_PASSWORD, academy_name: 'X', district: 'D', state: 'S' },
      headers: { origin },
    })
    // academyGate() runs BEFORE any body parsing/validation — a 404 here
    // (not 400) proves the flag check is the very first thing this route
    // does, independent of whatever the UI would or wouldn't have sent.
    expect(res.status()).toBe(404)
    expect((await res.json()).error).toBe('Academy administration is not available yet')
  })
})

// ─── Everything below requires ACADEMY_SELF_SERVE_ENABLED=true ───
// Run separately with the flag flipped on locally; these self-skip with a
// clear reason if the flag is actually off.

async function skipIfFlagOff(page: import('@playwright/test').Page) {
  await page.goto('/academy/onboarding')
  const off = await page.getByRole('heading', { name: "Academy sign-up isn't available yet" }).isVisible().catch(() => false)
  test.skip(off, 'ACADEMY_SELF_SERVE_ENABLED is off — run this file with the flag on to exercise A3-A6')
}

async function goToStep2(page: import('@playwright/test').Page, mobile: string) {
  await page.getByPlaceholder('98765 43210').fill(mobile)
  await page.getByRole('button', { name: 'Send OTP' }).click()
  await expect(page.getByText('Dev mode — no SMS gateway connected')).toBeVisible()
  const code = await page.locator('span.font-mono.font-bold').textContent()
  const digits = (code ?? '').trim().split('')
  const otpInputs = page.locator('input[maxlength="1"]')
  for (let i = 0; i < digits.length; i++) await otpInputs.nth(i).fill(digits[i])
  await page.getByRole('button', { name: 'Verify', exact: true }).click()
  await expect(page.getByText('Mobile number verified')).toBeVisible()
  await page.getByPlaceholder('director@academy.com').fill(uniqueEmail('academy'))
  await page.getByPlaceholder('Choose a password').fill(STRONG_PASSWORD)
  await page.getByRole('button', { name: 'Save & Continue' }).click()
  await expect(page.getByRole('heading', { name: 'Academy identity' })).toBeVisible()
}

async function fillStep2Identity(page: import('@playwright/test').Page) {
  await page.getByPlaceholder('e.g. KCA Cricket Academy').fill('E2E Test Academy')
  await page.getByPlaceholder('e.g. Kanpur').fill('Kanpur')
  await page.getByPlaceholder('e.g. Kanpur Nagar').fill('Kanpur Nagar')
  await page.locator('select').filter({ hasText: 'Select state' }).selectOption('Uttar Pradesh')
  const fullNameInputs = page.getByPlaceholder('Full name') // [0]=Primary Contact, [1]=Head Coach
  await fullNameInputs.nth(0).fill('Director Name')
  await fullNameInputs.nth(1).fill('Head Coach Name')
}

test.describe('A3 — flag ON: Step 1 phone OTP + email/password, client-side-only Verify', () => {
  test('Verify fires no network request — same trust boundary as coach/academy pattern', async ({ page }) => {
    await skipIfFlagOff(page)
    const mobile = uniqueMobile()
    await page.getByPlaceholder('98765 43210').fill(mobile)

    const networkCalls: string[] = []
    page.on('request', (r) => { if (r.url().includes('/api/')) networkCalls.push(r.url()) })

    await page.getByRole('button', { name: 'Send OTP' }).click()
    await expect(page.getByText('Dev mode — no SMS gateway connected')).toBeVisible()
    networkCalls.length = 0 // isolate Verify's own behavior

    const code = await page.locator('span.font-mono.font-bold').textContent()
    const digits = (code ?? '').trim().split('')
    const otpInputs = page.locator('input[maxlength="1"]')
    for (let i = 0; i < digits.length; i++) await otpInputs.nth(i).fill(digits[i])
    await page.getByRole('button', { name: 'Verify', exact: true }).click()
    await expect(page.getByText('Mobile number verified')).toBeVisible()

    expect(networkCalls, 'Verify at Step 1 must be a pure client-side comparison, no network call').toHaveLength(0)
  })
})

test.describe('A4 — flag ON: only the 5 documented fields persist; deleted steps never appear in the network body', () => {
  test('captures the real final-submit payload and confirms its exact field set', async ({ page }) => {
    await skipIfFlagOff(page)
    await goToStep2(page, uniqueMobile())
    await fillStep2Identity(page)
    await page.getByRole('button', { name: 'Save & Continue' }).click()
    await expect(page.getByRole('heading', { name: 'Go live' })).toBeVisible()

    const [request] = await Promise.all([
      page.waitForRequest((r) => r.url().includes('/api/academy/onboard') && r.method() === 'POST'),
      page.getByRole('button', { name: 'Finish & Go Live' }).click(),
    ])
    const body = request.postDataJSON()
    const keys = Object.keys(body).sort()

    // The 5 documented persisted fields from the old Step 3/4 (plus the
    // core account/identity fields this route has always taken).
    const expectedKeys = [
      'academy_name', 'academy_type', 'bcci_affiliated', 'bcci_affiliation_id',
      'city', 'contact_designation', 'contact_name', 'district', 'email',
      'head_coach_name', 'mobile', 'otp', 'password', 'requestId', 'state',
      'state_assoc_affiliated', 'state_assoc_names', 'year_established',
    ].sort()
    expect(keys).toEqual(expectedKeys)

    // Explicitly confirm none of the deleted Facilities/Staff/Programs
    // field names ever made it into the request body.
    const deletedFieldNames = [
      'ground_type', 'practice_nets', 'capacity', 'bowling_machine',
      'head_coach_certification', 'ex_professional_name', 'ex_professional_level',
      'assistant_coach_count', 'age_groups', 'formats', 'batch_timings', 'fee_range',
    ]
    for (const f of deletedFieldNames) expect(body).not.toHaveProperty(f)
  })
})

test.describe('A5 — flag ON: Step 3 "Go Live" invite/batch UI fires no real API calls', () => {
  test('Invite Coaches and Create First Batch are purely local, illustrative UI', async ({ page }) => {
    await skipIfFlagOff(page)
    await goToStep2(page, uniqueMobile())
    await fillStep2Identity(page)
    await page.getByRole('button', { name: 'Save & Continue' }).click()
    await expect(page.getByRole('heading', { name: 'Go live' })).toBeVisible()

    const networkCalls: string[] = []
    page.on('request', (r) => { if (r.url().includes('/api/')) networkCalls.push(r.url()) })

    await page.getByPlaceholder("Coach's mobile number").fill('9876543210')
    await page.getByRole('button', { name: 'Invite' }).click()
    await expect(page.getByRole('button', { name: 'Sent ✓' })).toBeVisible()

    await page.getByPlaceholder('Batch name, e.g. Morning U-14').fill('Morning U-14')
    await page.getByRole('button', { name: 'Create Batch' }).click()
    await expect(page.getByRole('button', { name: 'Created ✓' })).toBeVisible()

    expect(networkCalls, 'the invite/batch UI on Step 3 must be entirely local — no server calls until the real Finish button').toHaveLength(0)
  })
})

test.describe('A6 — /auth\'s Academy option routes straight to /academy/onboarding regardless of flag state', () => {
  test('the destination page is the only real gate', async ({ page }) => {
    await page.goto('/auth')
    await page.getByRole('tab', { name: 'Sign Up' }).click()
    await page.getByLabel('I am a…').selectOption('academy')
    await page.waitForURL(/\/academy\/onboarding$/, { timeout: 15_000 })
    // Whatever the flag currently is, the auth page itself never blocks
    // this navigation — its own pre-check was removed on purpose.
    const notice = page.getByRole('heading', { name: "Academy sign-up isn't available yet" })
    const wizard = page.getByPlaceholder('98765 43210')
    const eitherVisible = await Promise.race([
      notice.waitFor({ state: 'visible', timeout: 5000 }).then(() => 'notice').catch(() => null),
      wizard.waitFor({ state: 'visible', timeout: 5000 }).then(() => 'wizard').catch(() => null),
    ])
    expect(eitherVisible, 'the destination page itself renders either its gate notice or the real wizard — /auth never pre-empts either').not.toBeNull()
  })
})
