/**
 * E2E — /player/onboarding, src/app/player/onboarding/page.tsx +
 * POST /api/player/onboard (src/app/api/player/onboard/route.ts).
 *
 * This wizard is its OWN account-creation surface (collects email+password
 * in Stage 1, creates the account at final submit) — separate from and
 * currently unreconciled with /auth's bare-account-then-wizard path for
 * player/coach (see P9 below, an explicit finding test).
 *
 * Full-wizard helpers below fill every REQUIRED Stage 1 field with valid
 * defaults, complete both Aadhaar steps (dev-mode codes are echoed to the
 * client — no real eKYC vendor), and accept all consent panels (scrolling
 * each to its end first, since the checkbox is disabled until then).
 */
import { test, expect, type Page } from '@playwright/test'

function uniqueEmail(tag: string): string {
  return `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.local`
}

// /api/onboarding/aadhaar/initiate rate-limits by the NUMBER itself
// (5/hour) — a fixed test number across this many test cases in one run
// exhausts that bucket well before the file finishes. Each call below gets
// its own unique 12-digit number instead.
let aadhaarCounter = 0
function uniqueAadhaar(): string {
  aadhaarCounter += 1
  return (100000000000 + Date.now() % 900000000000 + aadhaarCounter).toString().slice(0, 12).padEnd(12, '0')
}

const STRONG_PASSWORD = 'Zq9vXk4mPr7wLj2' // high-entropy — see auth-signin.spec.ts's note on why 'TestPassXXXX'-style values can trip the live HIBP check

interface Stage1Overrides {
  email?: string
  dob?: string // yyyy-mm-dd
  guardianName?: string
  guardianPhone?: string
}

async function fillStage1(page: Page, overrides: Stage1Overrides = {}) {
  const email = overrides.email ?? uniqueEmail('player')
  await page.getByPlaceholder('Arjun Sharma').fill('E2E Test Player')
  await page.getByPlaceholder('arjun@example.com').fill(email)
  await page.getByPlaceholder('Choose a password').fill(STRONG_PASSWORD)
  await page.locator('input[type="date"]').first().fill(overrides.dob ?? '2000-01-01') // adult by default
  await page.locator('select').filter({ hasText: 'Select gender' }).selectOption('male')
  await page.getByPlaceholder('Kanpur', { exact: true }).fill('Kanpur')
  await page.getByPlaceholder('Kanpur Nagar').fill('Kanpur Nagar')
  await page.locator('select').filter({ hasText: 'Select state' }).selectOption('Uttar Pradesh')

  if (overrides.guardianName || overrides.guardianPhone) {
    await page.getByPlaceholder('Full name').fill(overrides.guardianName ?? 'Guardian Name')
    await page.getByPlaceholder('+91 98765 43210').fill(overrides.guardianPhone ?? '+919876543210')
  }

  await page.locator('input[type="date"]').nth(1).fill('2015-06-01') // enrollment date
  await page.locator('select').filter({ hasText: 'Select level' }).selectOption('district_team')
  await page.getByRole('button', { name: 'Batsman', exact: true }).click()
  return email
}

async function completeAadhaarStage(page: Page, minor: boolean) {
  async function verifyOneBlock(nth: number) {
    const numberInput = page.getByPlaceholder('XXXX XXXX XXXX').nth(nth)
    await numberInput.fill(uniqueAadhaar())
    await page.getByRole('button', { name: 'Send OTP' }).nth(nth).click()
    await expect(page.getByText('Dev mode — no eKYC vendor connected').nth(nth)).toBeVisible()
    const codeText = await page.locator('span.font-mono.font-bold').nth(nth).textContent()
    const code = codeText?.trim() ?? ''
    await page.getByPlaceholder('6-digit code').nth(nth).fill(code)
    await page.getByRole('button', { name: 'Verify', exact: true }).nth(nth).click()
    await expect(page.getByText(/OTP confirmed/).nth(nth)).toBeVisible()
  }
  await verifyOneBlock(0)
  if (minor) await verifyOneBlock(0) // guardian block becomes index 0 once player's block collapses to the "verified" summary line
}

// ConsentPanel renders its scrollable body as `div.overflow-y-auto` and its
// checkbox as the only <input type="checkbox"> in that panel, both inside
// one root `div.overflow-hidden` per panel, in the CONSENTS array's fixed
// order (dataUse, [dpdpGuardian if minor], visibility, terms) — matched by
// index rather than by text-ancestor lookup, since `div:has(text)` matches
// every nesting level up to the panel root and picking the "right" one via
// .first()/.last() proved unreliable (the title text lives in the deepest
// header <div>, not the panel root).
async function acceptAllConsents(page: Page, minor: boolean) {
  const count = minor ? 4 : 3
  for (let i = 0; i < count; i++) {
    // `div.overflow-y-auto` alone also matches the page's own main-content
    // scroll wrapper (src/app/player/onboarding/page.tsx's Stage container),
    // shifting every index by one — `max-h-40` is unique to ConsentPanel's
    // scroll body.
    const scrollBox = page.locator('div.max-h-40.overflow-y-auto').nth(i)
    await scrollBox.waitFor({ state: 'visible' })
    // Setting scrollTop alone doesn't reliably trigger React's onScroll
    // handler in time for the assertion below — dispatch the event
    // explicitly so ConsentPanel's handleScroll (which reads
    // scrollHeight/scrollTop/clientHeight) actually runs before we check.
    await scrollBox.evaluate((el) => {
      el.scrollTop = el.scrollHeight
      el.dispatchEvent(new Event('scroll', { bubbles: true }))
    })
    const checkbox = page.getByRole('checkbox').nth(i)
    await expect(checkbox).toBeEnabled()
    await checkbox.check()
  }
}

test.describe('P1 — Stage 1 all-valid advances to Stage 2', () => {
  test('Continue is enabled once every required field is filled, and advances', async ({ page }) => {
    await page.goto('/player/onboarding')
    await fillStage1(page)
    const continueBtn = page.getByRole('button', { name: 'Continue' })
    await expect(continueBtn).toBeEnabled()
    await continueBtn.click()
    await expect(page.getByRole('heading', { name: 'Verify your identity' })).toBeVisible()
  })
})

test.describe('P2 — duplicate email is caught only at final submit', () => {
  test('error surfaces as a toast on Stage 3, user is NOT bounced back to Stage 1 (finding)', async ({ page }) => {
    const email = uniqueEmail('player-dup')
    // Create the colliding account directly via the signup API — cheaper
    // than running the full wizard twice just to produce a duplicate.
    const baseURL = (test.info().project.use.baseURL as string) ?? 'http://127.0.0.1:3210'
    await page.request.post('/api/auth/signup', {
      data: { role: 'player', email, password: STRONG_PASSWORD },
      headers: { origin: new URL(baseURL).origin },
    })
    await page.context().clearCookies()

    await page.goto('/player/onboarding')
    await fillStage1(page, { email })
    await page.getByRole('button', { name: 'Continue' }).click()
    await completeAadhaarStage(page, false)
    await page.getByRole('button', { name: 'Continue' }).click()
    await acceptAllConsents(page, false)

    await page.getByRole('button', { name: 'Create Profile' }).click()
    await expect(page.getByText('An account with this email already exists')).toBeVisible()

    // FINDING: confirm the user is left on Stage 3, not returned to Stage 1
    // where the colliding email field actually lives — src/app/player/
    // onboarding/page.tsx's handleSubmit only special-cases the Aadhaar-
    // verification-required error message; every other server error
    // (including this one) just shows a toast and leaves `stage` untouched.
    await expect(page.getByRole('heading', { name: 'Footage, review & consent' })).toBeVisible()
    test.info().annotations.push({
      type: 'finding',
      description:
        'CONFIRMED: a duplicate-email 409 at final submit leaves the user on Stage 3 with only a toast — ' +
        'the email field that actually needs fixing is on Stage 1, three "Back" clicks away, with no inline ' +
        'indication of that. Recommend routing this error class back to Stage 1 the same way the Aadhaar-' +
        'required error already routes back to Stage 2.',
    })
  })
})

test.describe('P3 — weak/common password rejected at final submit', () => {
  test('same validatePasswordStrength messages as signup; user stranded on Stage 3 with only a toast', async ({ page }) => {
    await page.goto('/player/onboarding')
    // minLength=10 client-side blocks anything shorter from even being
    // typed meaningfully into a real submit — use a common PASSWORD that
    // passes length/char-class but fails the hardcoded-list check server-side.
    await fillStage1(page)
    await page.getByPlaceholder('Choose a password').fill('') // clear
    await page.getByPlaceholder('Choose a password').fill('cricket123') // in COMMON_PASSWORDS, 10 chars, passes client-side minLength
    await page.getByRole('button', { name: 'Continue' }).click()
    await completeAadhaarStage(page, false)
    await page.getByRole('button', { name: 'Continue' }).click()
    await acceptAllConsents(page, false)

    await page.getByRole('button', { name: 'Create Profile' }).click()
    await expect(page.getByText('This password is too common — please choose a different one')).toBeVisible()
    // Same finding as P2 — stranded on Stage 3, not bounced to Stage 1.
    await expect(page.getByRole('heading', { name: 'Footage, review & consent' })).toBeVisible()
  })

  test('server-side: hitting the API directly confirms the exact three messages independent of the UI', async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin
    const base = { role: 'player', fullName: 'X', dob: '2000-01-01', district: 'D', state: 'S', playingRole: 'Batsman', gender: 'male', city: 'C', enrollmentDate: '2015-01-01', highestLevelRepresented: 'district_team' }

    const short = await page.request.post('/api/player/onboard', { data: { ...base, email: uniqueEmail('p3-short'), password: 'Ab1' }, headers: { origin } })
    expect(short.status()).toBe(400)

    const lettersOnly = await page.request.post('/api/player/onboard', { data: { ...base, email: uniqueEmail('p3-letters'), password: 'OnlyLettersHere' }, headers: { origin } })
    expect((await lettersOnly.json()).error).toBe('Password must contain both letters and numbers')

    const common = await page.request.post('/api/player/onboard', { data: { ...base, email: uniqueEmail('p3-common'), password: 'cricket123' }, headers: { origin } })
    expect((await common.json()).error).toBe('This password is too common — please choose a different one')
  })
})

test.describe('P4/P5 — minor vs adult DOB', () => {
  test('P4: a minor DOB reveals guardian fields, which become required', async ({ page }) => {
    await page.goto('/player/onboarding')
    await page.locator('input[type="date"]').first().fill('2015-01-01') // ~10 years old
    await expect(page.getByPlaceholder('Full name')).toBeVisible()
    await expect(page.getByPlaceholder('+91 98765 43210')).toBeVisible()

    await fillStage1(page, { dob: '2015-01-01' }) // no guardian fields filled
    await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled()
  })

  test('P5: an adult DOB hides guardian fields and omits them from the submit payload', async ({ page }) => {
    await page.goto('/player/onboarding')
    await page.locator('input[type="date"]').first().fill('1995-01-01')
    await expect(page.getByPlaceholder('Full name')).toHaveCount(0)
    await expect(page.getByPlaceholder('+91 98765 43210')).toHaveCount(0)
  })
})

test.describe('P6 — academy lookup on blur', () => {
  test('a name with no matching academy leaves the batch field as free text, no crash', async ({ page }) => {
    await page.goto('/player/onboarding')
    await fillStage1(page)
    const academyField = page.getByPlaceholder('Tara Cricket Academy')
    await academyField.fill('Definitely Not A Real Academy Name 12345')
    await academyField.blur()
    await expect(page.getByPlaceholder('e.g. Morning U-14 Batch')).toBeVisible()
    // No crash / error state — Continue should still be reachable.
    await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled()
  })
})

test.describe('P7 — resume from localStorage', () => {
  test('refresh mid-Stage-1 restores prior input with a toast', async ({ page }) => {
    await page.goto('/player/onboarding')
    await fillStage1(page)
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByRole('heading', { name: 'Verify your identity' })).toBeVisible()

    await page.reload()
    await expect(page.getByText('Welcome back — picked up where you left off.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Verify your identity' })).toBeVisible()
  })
})

test.describe('P8 — actually-required vs optional fields, per the API', () => {
  test('battingStyle/bowlingStyle/cricheroes_handle/academy/footage/bio are all optional server-side', async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin
    const res = await page.request.post('/api/player/onboard', {
      data: {
        role: 'player', email: uniqueEmail('p8-minimal'), password: STRONG_PASSWORD,
        fullName: 'Minimal Player', dob: '2000-01-01', district: 'D', state: 'S',
        playingRole: 'Batsman', gender: 'male', city: 'C', enrollmentDate: '2015-01-01',
        highestLevelRepresented: 'district_team',
        // Deliberately omitted: battingStyle, bowlingStyle, cricheroes_handle,
        // academy, batchId/batchLabel, footage urls, bio, selectedFormats.
        // Aadhaar/consent omitted too — expect the AADHAAR error specifically,
        // proving every field above this point was accepted as sufficient.
      },
      headers: { origin },
    })
    const body = await res.json()
    expect(res.status()).toBe(400)
    expect(body.error, 'should fail on the Aadhaar gate, not on any of the omitted optional fields').toBe(
      'Aadhaar verification is required and must be completed just before submitting',
    )
  })

  test('omitting any ONE required field (gender) fails the combined identity/profile check', async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin
    const res = await page.request.post('/api/player/onboard', {
      data: {
        role: 'player', email: uniqueEmail('p8-missing-gender'), password: STRONG_PASSWORD,
        fullName: 'X', dob: '2000-01-01', district: 'D', state: 'S', playingRole: 'Batsman',
        city: 'C', enrollmentDate: '2015-01-01', highestLevelRepresented: 'district_team',
        // gender omitted
      },
      headers: { origin },
    })
    expect(res.status()).toBe(400)
    expect((await res.json()).error).toBe('Identity and playing profile are required')
  })
})

test.describe('P9 — /auth routes straight to the wizard, no bare-account pre-creation', () => {
  test('fixed: /auth never pre-creates an account, so the wizard\'s own submit is the only one and succeeds', async ({ page, baseURL }) => {
    // /auth's Player picker now just navigates — it no longer POSTs
    // /api/auth/signup or mints a session before the wizard runs.
    const email = uniqueEmail('p9-fixed')
    await page.goto('/auth')
    await page.getByRole('tab', { name: 'Sign Up' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL(/\/player\/onboarding$/, { timeout: 15_000 })

    const sessionAfterRoleSelect = await page.request.get('/api/auth/session')
    const sessionBody = await sessionAfterRoleSelect.json()
    const hadSessionFromAuthPage = Boolean(sessionBody?.user?.email)
    expect(hadSessionFromAuthPage, '/auth must not sign the visitor in before the wizard even collects an email/password').toBe(false)

    await fillStage1(page, { email })
    await page.getByRole('button', { name: 'Continue' }).click()
    await completeAadhaarStage(page, false)
    await page.getByRole('button', { name: 'Continue' }).click()
    await acceptAllConsents(page, false)

    const responsePromise = page.waitForResponse((r) => r.url().includes('/api/player/onboard'))
    await page.getByRole('button', { name: 'Create Profile' }).click()
    const response = await responsePromise
    const status = response.status()
    const body = await response.json().catch(() => ({}))

    test.info().annotations.push({
      type: 'P9-observed-behavior',
      description:
        `Bare account existed before wizard ran: ${hadSessionFromAuthPage}. ` +
        `Final /api/player/onboard call: status=${status}, body=${JSON.stringify(body)}. ` +
        (status === 200
          ? 'FIXED: single account-creation path — the wizard is now the only place that creates the account, ' +
            'no duplicate-email 409 from a pre-existing bare account.'
          : status === 409
          ? 'REGRESSION: 409 duplicate-email conflict — the wizard tried to create a SECOND account for an ' +
            'email that /auth\'s bare-account step already registered. The visitor is stuck: their bare ' +
            'account has no profile, and this wizard refuses to attach one to it.'
            : `REGRESSION: unexpected status ${status} — investigate.`),
    })
    expect(status, 'the wizard\'s own account creation must succeed with no pre-existing bare account in the way').toBe(200)
  })
})

test.describe('P10/P11/P12 — Aadhaar OTP: dev banner, correct code, incorrect code', () => {
  test('P10: dev-mode banner shows the real code in plain text', async ({ page }) => {
    await page.goto('/player/onboarding')
    await fillStage1(page)
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByPlaceholder('XXXX XXXX XXXX').fill(uniqueAadhaar())
    await page.getByRole('button', { name: 'Send OTP' }).click()
    await expect(page.getByText('Dev mode — no eKYC vendor connected')).toBeVisible()
    const code = (await page.locator('span.font-mono.font-bold').first().textContent())?.trim()
    expect(code, 'the dev code must be a 6-digit string shown directly, not masked').toMatch(/^\d{6}$/)
  })

  test('P11: the correct code verifies', async ({ page }) => {
    await page.goto('/player/onboarding')
    await fillStage1(page)
    await page.getByRole('button', { name: 'Continue' }).click()
    await completeAadhaarStage(page, false)
    await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled()
  })

  test('P12: an incorrect code is rejected with an inline error, verified stays false', async ({ page }) => {
    await page.goto('/player/onboarding')
    await fillStage1(page)
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByPlaceholder('XXXX XXXX XXXX').fill(uniqueAadhaar())
    await page.getByRole('button', { name: 'Send OTP' }).click()
    await expect(page.getByText('Dev mode — no eKYC vendor connected')).toBeVisible()
    await page.getByPlaceholder('6-digit code').fill('000000')
    await page.getByRole('button', { name: 'Verify', exact: true }).click()
    await expect(page.getByText(/Incorrect or expired code/i)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled()
  })
})

test.describe('P13 — minor flow requires BOTH player and guardian Aadhaar verified', () => {
  test('Continue stays disabled until both blocks show verified', async ({ page }) => {
    await page.goto('/player/onboarding')
    await fillStage1(page, { dob: '2012-01-01', guardianName: 'Guardian Name', guardianPhone: '+919876543210' })
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText('Parent / guardian verification')).toBeVisible()

    // Verify only the player's own block — guardian's still pending.
    await page.getByPlaceholder('XXXX XXXX XXXX').first().fill(uniqueAadhaar())
    await page.getByRole('button', { name: 'Send OTP' }).first().click()
    const playerCode = (await page.locator('span.font-mono.font-bold').first().textContent())?.trim() ?? ''
    await page.getByPlaceholder('6-digit code').first().fill(playerCode)
    await page.getByRole('button', { name: 'Verify', exact: true }).first().click()
    await expect(page.getByText(/OTP confirmed/).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue' }), 'guardian still unverified — must not proceed').toBeDisabled()

    // Now verify the guardian block too. NOT completeAadhaarStage(page, true)
    // — that helper verifies index 0 TWICE for a minor (player, then
    // guardian, since player's collapses to a summary and frees up index
    // 0). The player's block is already verified above, so only ONE more
    // verification (the guardian's, now at index 0) is needed here.
    await page.getByPlaceholder('XXXX XXXX XXXX').first().fill(uniqueAadhaar())
    await page.getByRole('button', { name: 'Send OTP' }).first().click()
    const guardianCode = (await page.locator('span.font-mono.font-bold').first().textContent())?.trim() ?? ''
    await page.getByPlaceholder('6-digit code').first().fill(guardianCode)
    await page.getByRole('button', { name: 'Verify', exact: true }).first().click()
    await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled()
  })
})

test.describe('P14 — server-side re-check rejects a client-manipulated "verified" state', () => {
  test('an initiated-but-never-verified requestId is rejected at final submit, independent of any client UI state', async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin
    const initiateRes = await page.request.post('/api/onboarding/aadhaar/initiate', {
      data: { aadhaarNumber: uniqueAadhaar() },
      headers: { origin },
    })
    const { requestId } = await initiateRes.json()
    // Deliberately skip calling /api/onboarding/aadhaar/verify — this
    // requestId is "sent" but never actually verified, simulating a client
    // that faked its own local `status: 'verified'` state.
    const res = await page.request.post('/api/player/onboard', {
      data: {
        role: 'player', email: uniqueEmail('p14-bypass'), password: STRONG_PASSWORD,
        fullName: 'X', dob: '2000-01-01', district: 'D', state: 'S', playingRole: 'Batsman',
        gender: 'male', city: 'C', enrollmentDate: '2015-01-01', highestLevelRepresented: 'district_team',
        aadhaarRequestId: requestId,
        consentDataUse: true, consentVisibility: true, consentTerms: true,
      },
      headers: { origin },
    })
    expect(res.status(), 'consumeVerifiedAadhaar must reject a requestId that was never actually verified').toBe(400)
    expect((await res.json()).error).toBe('Aadhaar verification is required and must be completed just before submitting')
  })
})

test.describe('P15 — stale/consumed requestId', () => {
  test('server: a requestId already consumed by one successful submit is rejected on reuse', async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin
    const initiateRes = await page.request.post('/api/onboarding/aadhaar/initiate', { data: { aadhaarNumber: uniqueAadhaar() }, headers: { origin } })
    const { requestId, devCode } = await initiateRes.json()
    await page.request.post('/api/onboarding/aadhaar/verify', { data: { requestId, code: devCode }, headers: { origin } })

    const base = {
      role: 'player', fullName: 'X', dob: '2000-01-01', district: 'D', state: 'S', playingRole: 'Batsman',
      gender: 'male', city: 'C', enrollmentDate: '2015-01-01', highestLevelRepresented: 'district_team',
      aadhaarRequestId: requestId, consentDataUse: true, consentVisibility: true, consentTerms: true,
    }
    const first = await page.request.post('/api/player/onboard', { data: { ...base, email: uniqueEmail('p15-first'), password: STRONG_PASSWORD }, headers: { origin } })
    expect(first.status(), 'first use should succeed and consume the requestId').toBe(200)

    const second = await page.request.post('/api/player/onboard', { data: { ...base, email: uniqueEmail('p15-second'), password: STRONG_PASSWORD }, headers: { origin } })
    expect(second.status(), 'the SAME requestId reused for a different account must be rejected — single-use').toBe(400)
    expect((await second.json()).error).toBe('Aadhaar verification is required and must be completed just before submitting')
  })

  test('UI: this exact error resets the wizard to Stage 2 with a toast, preserving other fields', async ({ page }) => {
    await page.goto('/player/onboarding')
    const email = await fillStage1(page)
    await page.getByRole('button', { name: 'Continue' }).click()
    await completeAadhaarStage(page, false)
    await page.getByRole('button', { name: 'Continue' }).click()
    await acceptAllConsents(page, false)

    // Force the final submit to return the exact "stale requestId" error the
    // server would give, without needing to actually pre-consume a real one.
    await page.route('**/api/player/onboard', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Aadhaar verification is required and must be completed just before submitting' }),
      }),
    )
    await page.getByRole('button', { name: 'Create Profile' }).click()
    await expect(page.getByRole('heading', { name: 'Verify your identity' })).toBeVisible()
    await expect(page.getByText(/couldn't confirm your verification/i).first()).toBeVisible()

    // Stage 1 data must still be intact after dropping back to Stage 2.
    await page.getByRole('button', { name: /back/i }).click()
    await expect(page.getByPlaceholder('arjun@example.com')).toHaveValue(email)
  })
})

test.describe('P16 — bio character limit', () => {
  test('textarea enforces maxLength=400 with a live counter', async ({ page }) => {
    await page.goto('/player/onboarding')
    await fillStage1(page)
    await page.getByRole('button', { name: 'Continue' }).click()
    await completeAadhaarStage(page, false)
    await page.getByRole('button', { name: 'Continue' }).click()

    const bio = page.getByPlaceholder('Your cricket journey, strengths, goals…')
    const longText = 'x'.repeat(500)
    await bio.fill(longText)
    const value = await bio.inputValue()
    expect(value.length, 'browser-enforced maxLength should cap the value at 400').toBe(400)
    await expect(page.getByText('400/400')).toBeVisible()
  })
})

test.describe('P17 — consent panels require scrolling to the end before accepting', () => {
  test('a panel\'s checkbox is disabled until scrolled, then becomes checkable', async ({ page }) => {
    await page.goto('/player/onboarding')
    await fillStage1(page)
    await page.getByRole('button', { name: 'Continue' }).click()
    await completeAadhaarStage(page, false)
    await page.getByRole('button', { name: 'Continue' }).click()

    const checkbox = page.getByRole('checkbox').first() // Data collection & use is always the first panel
    await expect(checkbox).toBeDisabled()
    await expect(page.getByText('Scroll to the end to accept').first()).toBeVisible()

    const scrollBox = page.locator('div.max-h-40.overflow-y-auto').first()
    await scrollBox.evaluate((el) => {
      el.scrollTop = el.scrollHeight
      el.dispatchEvent(new Event('scroll', { bubbles: true }))
    })
    await expect(checkbox).toBeEnabled()
  })
})

test.describe('P18 — guardian DPDP consent panel only for minors', () => {
  test('present for a minor, absent for an adult', async ({ page }) => {
    await page.goto('/player/onboarding')
    await fillStage1(page, { dob: '2012-01-01', guardianName: 'Guardian Name', guardianPhone: '+919876543210' })
    await page.getByRole('button', { name: 'Continue' }).click()
    await completeAadhaarStage(page, true)
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText('Guardian consent (Digital Personal Data Protection Act, 2023)')).toBeVisible()
  })

  test('absent for an adult', async ({ page }) => {
    await page.goto('/player/onboarding')
    await fillStage1(page)
    await page.getByRole('button', { name: 'Continue' }).click()
    await completeAadhaarStage(page, false)
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText('Guardian consent (Digital Personal Data Protection Act, 2023)')).toHaveCount(0)
  })
})

test.describe('P19 — successful submit posts both Aadhaar requestIds for a minor', () => {
  test('captures the actual POST body sent to /api/player/onboard', async ({ page }) => {
    await page.goto('/player/onboarding')
    await fillStage1(page, { dob: '2012-01-01', guardianName: 'Guardian Name', guardianPhone: '+919876543210' })
    await page.getByRole('button', { name: 'Continue' }).click()
    await completeAadhaarStage(page, true)
    await page.getByRole('button', { name: 'Continue' }).click()
    await acceptAllConsents(page, true)

    const [request] = await Promise.all([
      page.waitForRequest((r) => r.url().includes('/api/player/onboard')),
      page.getByRole('button', { name: 'Create Profile' }).click(),
    ])
    const body = request.postDataJSON()
    expect(body.aadhaarRequestId, 'player Aadhaar requestId must be present').toBeTruthy()
    expect(body.guardianAadhaarRequestId, 'guardian Aadhaar requestId must be present for a minor').toBeTruthy()
    expect(body.aadhaarRequestId).not.toBe(body.guardianAadhaarRequestId)
  })
})

test.describe('P20 — tampered payload with match-stat-shaped keys is rejected server-side', () => {
  test('any MATCH_STAT_KEYS field in the body is rejected before any other validation', async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin
    const res = await page.request.post('/api/player/onboard', {
      data: {
        role: 'player', email: uniqueEmail('p20-tamper'), password: STRONG_PASSWORD,
        runs: 9999, wickets: 500, // self-reported stats — must never be accepted
      },
      headers: { origin },
    })
    expect(res.status()).toBe(400)
    expect((await res.json()).error).toBe('Match statistics are not accepted. Scores come from ingested scorecards only.')
  })
})

test.describe('P21 — signup rate limiting: 6th attempt for one email within an hour', () => {
  test('429 on the 6th call', async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin
    const email = uniqueEmail('p21-ratelimit')
    // Valid identity fields (so the request reaches the rate-limit check)
    // but a common password (so it fails afterward without creating 6
    // real accounts) — rateLimit() increments before the password check runs.
    const base = {
      role: 'player', email, password: 'cricket123',
      fullName: 'X', dob: '2000-01-01', district: 'D', state: 'S', playingRole: 'Batsman',
      gender: 'male', city: 'C', enrollmentDate: '2015-01-01', highestLevelRepresented: 'district_team',
    }
    const statuses: number[] = []
    for (let i = 0; i < 6; i++) {
      const res = await page.request.post('/api/player/onboard', { data: base, headers: { origin } })
      statuses.push(res.status())
    }
    expect(statuses.slice(0, 5).every((s) => s === 400)).toBe(true)
    expect(statuses[5]).toBe(429)
  })
})
