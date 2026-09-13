/**
 * E2E — /onboarding/association, src/app/onboarding/association/page.tsx +
 * POST /api/associations/self-serve-onboard.
 *
 * ASSOCIATION_SELF_SERVE_ENABLED defaults to true — no flag toggling
 * needed for this file. AS5's second half and AS7 use direct Prisma
 * access against the live "athlasx" schema (same convention as the scout
 * spec's S4/S5) since a bare DB-default check and an ops-approval
 * equivalent aren't reachable through any public route.
 */
// Load .env.local the way Next does — Playwright's own test process does
// not auto-load it, unlike the `next start` server under test.
import '../helpers/load-env'
import { test, expect } from '@playwright/test'
import { db } from '../../src/lib/db'

function uniqueEmail(tag: string): string {
  return `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.local`
}
const STRONG_PASSWORD = 'Zq9vXk4mPr7wLj2'

async function fillStep1(page: import('@playwright/test').Page, email: string) {
  await page.goto('/onboarding/association')
  await page.getByPlaceholder('secretary@association.org').fill(email)
  await page.getByPlaceholder('Choose a password').fill(STRONG_PASSWORD)
}

test.describe('AS1 — Step 1 is email+password only, no phone/OTP', () => {
  test('no phone/mobile field anywhere on Step 1', async ({ page }) => {
    await page.goto('/onboarding/association')
    await expect(page.getByText('No phone verification needed for this role')).toBeVisible()
    await expect(page.getByPlaceholder(/mobile|phone|whatsapp/i)).toHaveCount(0)
    await expect(page.getByRole('button', { name: /send otp/i })).toHaveCount(0)
  })
})

test.describe('AS2 — State-type association has no parent-association requirement', () => {
  test('picking State never shows a parent picker, Continue enables with no parent chosen', async ({ page }) => {
    const email = uniqueEmail('as2')
    await fillStep1(page, email)
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByRole('heading', { name: 'Association identity' })).toBeVisible()

    await page.getByText('State', { exact: true }).click()
    await expect(page.getByText('Parent State Association')).toHaveCount(0)

    await page.getByPlaceholder('Uttar Pradesh Cricket Association').fill('E2E State Association')
    await page.locator('select').filter({ hasText: 'Select state…' }).selectOption('Uttar Pradesh')
    await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled()
  })
})

test.describe('AS3 — District-type association\'s parent picker is optional', () => {
  test('leaving the parent picker unset still allows Continue', async ({ page }) => {
    const email = uniqueEmail('as3')
    await fillStep1(page, email)
    await page.getByRole('button', { name: 'Continue' }).click()
    // District is the default `type` state, but click explicitly for clarity.
    await page.getByText('District', { exact: true }).click()
    await expect(page.getByText('Parent State Association')).toBeVisible()
    // A closed native <select>'s own <option> elements report as "hidden"
    // to Playwright's visibility check even though the select itself is
    // visible — assert on the select's default value instead.
    const parentSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'Not sure / none on file yet' }) })
    await expect(parentSelect).toBeVisible()
    await expect(parentSelect).toHaveValue('')

    await page.getByPlaceholder('Uttar Pradesh Cricket Association').fill('E2E District Association')
    await page.locator('select').filter({ hasText: 'Select state…' }).selectOption('Uttar Pradesh')
    // Parent picker deliberately left at its default ("Not sure / none on file yet").
    await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled()
  })
})

test.describe('AS4 — consent checkbox stays disabled until scrolled to the end', () => {
  test('checkbox disabled pre-scroll, enabled after', async ({ page }) => {
    const email = uniqueEmail('as4')
    await fillStep1(page, email)
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByPlaceholder('Uttar Pradesh Cricket Association').fill('E2E Consent Test Assoc')
    await page.getByText('State', { exact: true }).click()
    await page.locator('select').filter({ hasText: 'Select state…' }).selectOption('Uttar Pradesh')
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByRole('heading', { name: 'Data-sharing consent' })).toBeVisible()

    const checkbox = page.getByRole('checkbox')
    await expect(checkbox).toBeDisabled()
    await expect(page.getByText('Scroll to the end of the agreement to enable this checkbox.')).toBeVisible()

    // Attribute-substring match, not a class selector — Tailwind's
    // arbitrary-value class name literally contains '[' ']', which isn't
    // valid raw CSS class-selector syntax (`.max-h-\[15rem\]` would need
    // escaping); a quoted attribute value doesn't have that problem.
    const scrollBox = page.locator('div[class*="max-h-[15rem]"][class*="overflow-y-auto"]')
    await scrollBox.evaluate((el) => {
      el.scrollTop = el.scrollHeight
      el.dispatchEvent(new Event('scroll', { bubbles: true }))
    })
    await expect(checkbox).toBeEnabled()
  })
})

test.describe('AS5 (MOST IMPORTANT) — verification_status is explicitly \'pending\' on this route, but the column\'s own DEFAULT is a separate landmine', () => {
  test('this route\'s created row is \'pending\', confirmed by reading it back', async ({ page }) => {
    const email = uniqueEmail('as5-route')
    await fillStep1(page, email)
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByPlaceholder('Uttar Pradesh Cricket Association').fill('E2E AS5 Route Assoc')
    await page.getByText('State', { exact: true }).click()
    await page.locator('select').filter({ hasText: 'Select state…' }).selectOption('Uttar Pradesh')
    await page.getByRole('button', { name: 'Continue' }).click()
    // Attribute-substring match, not a class selector — Tailwind's
    // arbitrary-value class name literally contains '[' ']', which isn't
    // valid raw CSS class-selector syntax (`.max-h-\[15rem\]` would need
    // escaping); a quoted attribute value doesn't have that problem.
    const scrollBox = page.locator('div[class*="max-h-[15rem]"][class*="overflow-y-auto"]')
    await scrollBox.evaluate((el) => { el.scrollTop = el.scrollHeight; el.dispatchEvent(new Event('scroll', { bubbles: true })) })
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Submit for Verification' }).click()
    await expect(page.getByRole('heading', { name: 'Submitted for verification' })).toBeVisible()

    const created = await db.association.findFirst({ where: { name: 'E2E AS5 Route Assoc' } })
    expect(created?.verification_status, 'this route explicitly sets pending — confirmed by reading the row, not just a 200 response').toBe('pending')

    // Cleanup this one row (a real association + associationStaff + user
    // this test created) so it doesn't linger in the live dataset.
    if (created) {
      await db.associationStaff.deleteMany({ where: { association_id: created.id } })
      await db.user.deleteMany({ where: { email } })
      await db.association.delete({ where: { id: created.id } })
    }
  })

  test('SEPARATE FINDING (not fixable by this route): the Association.verification_status column\'s own DB-level default', async () => {
    // Bypasses this route entirely — a raw Prisma insert with NO
    // verification_status specified at all, to see what the column itself
    // defaults to independent of any application code remembering to
    // override it.
    const bareInsert = await db.association.create({
      data: {
        name: `E2E AS5 bare-default-check ${Date.now()}`,
        type: 'state',
        state: 'AuditState',
        data_sharing_signed: true,
        // verification_status deliberately omitted.
      },
    })

    const isDefaultApproved = bareInsert.verification_status === 'approved'
    test.info().annotations.push({
      type: 'AS5-db-default-finding',
      description: isDefaultApproved
        ? `CONFIRMED LANDMINE: Association.verification_status's column-level default is 'approved'. ` +
          `A bare insert with no explicit value produced a row with verification_status='approved' — ` +
          `pre-verified, with full association-scoped access, with zero application code involved. ` +
          `This self-serve route (self-serve-onboard/route.ts) protects itself by always passing 'pending' ` +
          `explicitly, but that's a per-call-site discipline, not a schema-level guarantee — any OTHER ` +
          `future insert path (a script, a different route, a data-migration, an admin tool) that forgets ` +
          `this one line silently creates a pre-approved association. This is the exact schema-level fix ` +
          `already scoped in the separate DB-default-hardening prompt (drafted migration, not yet applied).`
        : `Column default is currently '${bareInsert.verification_status}', not 'approved' — the landmine may already be fixed at the schema level.`,
    })

    // Report only — do not silently "fix" this by asserting pending here;
    // the actual database default is what it is, and the finding is what matters.
    await db.association.delete({ where: { id: bareInsert.id } })
  })
})

test.describe('AS6 — post-submit lands on /association/pending, not the real dashboard', () => {
  test('signed in but held on the pending screen', async ({ page }) => {
    const email = uniqueEmail('as6')
    await fillStep1(page, email)
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByPlaceholder('Uttar Pradesh Cricket Association').fill('E2E AS6 Assoc')
    await page.getByText('State', { exact: true }).click()
    await page.locator('select').filter({ hasText: 'Select state…' }).selectOption('Uttar Pradesh')
    await page.getByRole('button', { name: 'Continue' }).click()
    // Attribute-substring match, not a class selector — Tailwind's
    // arbitrary-value class name literally contains '[' ']', which isn't
    // valid raw CSS class-selector syntax (`.max-h-\[15rem\]` would need
    // escaping); a quoted attribute value doesn't have that problem.
    const scrollBox = page.locator('div[class*="max-h-[15rem]"][class*="overflow-y-auto"]')
    await scrollBox.evaluate((el) => { el.scrollTop = el.scrollHeight; el.dispatchEvent(new Event('scroll', { bubbles: true })) })
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Submit for Verification' }).click()
    await expect(page.getByRole('heading', { name: 'Submitted for verification' })).toBeVisible()

    const sessionRes = await page.request.get('/api/auth/session')
    expect((await sessionRes.json())?.user?.email).toBe(email)

    await page.goto('/association')
    await expect(page).toHaveURL(/\/association\/pending$/)
  })
})

test.describe('AS7 — ops approval unlocks access live, no re-login', () => {
  test('resolveVerifiedAssociationScope re-checks the DB per request', async ({ page }) => {
    const email = uniqueEmail('as7')
    await fillStep1(page, email)
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByPlaceholder('Uttar Pradesh Cricket Association').fill('E2E AS7 Assoc')
    await page.getByText('State', { exact: true }).click()
    await page.locator('select').filter({ hasText: 'Select state…' }).selectOption('Uttar Pradesh')
    await page.getByRole('button', { name: 'Continue' }).click()
    // Attribute-substring match, not a class selector — Tailwind's
    // arbitrary-value class name literally contains '[' ']', which isn't
    // valid raw CSS class-selector syntax (`.max-h-\[15rem\]` would need
    // escaping); a quoted attribute value doesn't have that problem.
    const scrollBox = page.locator('div[class*="max-h-[15rem]"][class*="overflow-y-auto"]')
    await scrollBox.evaluate((el) => { el.scrollTop = el.scrollHeight; el.dispatchEvent(new Event('scroll', { bubbles: true })) })
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Submit for Verification' }).click()
    await expect(page.getByRole('heading', { name: 'Submitted for verification' })).toBeVisible()

    await page.goto('/association')
    await expect(page).toHaveURL(/\/association\/pending$/)

    // Equivalent of PATCH /api/ops/associations/[id]/verification (no ops
    // credential available in this test) — a direct write to the SAME
    // field that route sets, testing the READ-side live re-check.
    const assoc = await db.association.findFirst({ where: { name: 'E2E AS7 Assoc' } })
    await db.association.update({ where: { id: assoc!.id }, data: { verification_status: 'approved' } })

    // Same session/cookies — no re-login.
    await page.goto('/association')
    await expect(page, 'access must unlock live off the same session').not.toHaveURL(/\/association\/pending$/)
    // Two h1s exist on this shell (dashboard chrome's own title + this
    // page's own heading) — target the real association page content.
    await expect(page.getByRole('heading', { name: 'Trial cycle oversight' })).toBeVisible()

    // Cleanup.
    await db.associationStaff.deleteMany({ where: { association_id: assoc!.id } })
    await db.user.deleteMany({ where: { email } })
    await db.association.delete({ where: { id: assoc!.id } })
  })
})

test.describe('AS8 — /auth\'s Association option: no bare-account signup, no session before the wizard completes', () => {
  test('regression check against A16 from the auth test suite', async ({ page }) => {
    const signupCalls: string[] = []
    page.on('request', (r) => { if (r.url().includes('/api/auth/signup')) signupCalls.push(r.url()) })

    await page.goto('/auth')
    await page.getByRole('tab', { name: 'Sign Up' }).click()
    await page.getByLabel('I am a…').selectOption('association')
    await page.waitForURL(/\/onboarding\/association$/, { timeout: 15_000 })

    expect(signupCalls, 'no bare-account signup request should ever fire for Association').toHaveLength(0)

    const sessionRes = await page.request.get('/api/auth/session')
    const session = await sessionRes.json().catch(() => ({}))
    expect(session?.user, 'selecting Association must not establish a session before the wizard\'s own Step 3 submit').toBeUndefined()
  })
})
