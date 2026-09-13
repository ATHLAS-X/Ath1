/**
 * E2E — /auth sign-up flow: role picker (src/app/auth/page.tsx) +
 * POST /api/auth/signup (src/app/api/auth/signup/route.ts) +
 * server-side password rules (src/lib/password.ts).
 *
 * A20 and A21-A29 in particular are about proving the SERVER re-checks
 * everything the UI already checks (or, for association/scout/roleUnavailable,
 * that the UI's own gating is dead code) — several tests hit the API
 * directly with page.request rather than only driving the form, per the
 * request that this be about server-side validation, not just UI behavior.
 *
 * Every real-account test uses a unique disposable email; see
 * auth-signin.spec.ts's file header for why (shared in-memory rate-limit
 * buckets on the `next start` process).
 */
import { test, expect, type Page } from '@playwright/test'

function uniqueEmail(tag: string): string {
  return `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.local`
}

// /api/auth/signup now enforces a same-origin check (SEC-CSRF, added this
// turn) — a bare page.request.post carries no Origin/Referer by default,
// so every direct hit against this route needs it supplied explicitly to
// simulate a legitimate same-origin call from the app's own /auth page.
function signupRequest(page: Page, baseURL: string, data: Record<string, unknown>) {
  return page.request.post('/api/auth/signup', { data, headers: { origin: new URL(baseURL).origin } })
}

test.describe('A16 — Association routes away with no bare account created', () => {
  test('selecting Association navigates to /onboarding/association and never calls /api/auth/signup', async ({ page }) => {
    const signupCalls: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('/api/auth/signup')) signupCalls.push(r.url())
    })

    await page.goto('/auth')
    await page.getByRole('tab', { name: 'Sign Up' }).click()
    await page.getByLabel('I am a…').selectOption('association')
    await page.waitForURL(/\/onboarding\/association$/)

    expect(signupCalls, 'no bare-account signup request should ever fire for Association').toHaveLength(0)

    // Side-effect check independent of the redirect itself: no session was
    // established either, which is what a bare-account signup would have
    // produced (src/app/api/auth/signup/route.ts signs the caller in on
    // success). Absence of a session is the observable proxy for "no
    // account row was created" without needing direct DB access from this
    // black-box e2e test.
    const sessionRes = await page.request.get('/api/auth/session')
    const session = await sessionRes.json().catch(() => ({}))
    expect(session?.user, 'selecting Association must not sign anyone in').toBeUndefined()
  })
})

test.describe('A17 — Academy routes to /academy/onboarding regardless of the flag', () => {
  test('destination shows its own not-available notice while ACADEMY_SELF_SERVE_ENABLED=false', async ({ page }) => {
    await page.goto('/auth')
    await page.getByRole('tab', { name: 'Sign Up' }).click()
    await page.getByLabel('I am a…').selectOption('academy')
    await page.waitForURL(/\/academy\/onboarding$/)
    // src/lib/feature-flags.ts's confirmed 2026-09-11 launch value is
    // false, so this is the actual current behavior, not a hypothetical.
    await expect(page.getByRole('heading', { name: "Academy sign-up isn't available yet" })).toBeVisible()
  })
})

test.describe('A18 — Scout routes to /scout/onboarding', () => {
  test('navigates correctly', async ({ page }) => {
    await page.goto('/auth')
    await page.getByRole('tab', { name: 'Sign Up' }).click()
    await page.getByLabel('I am a…').selectOption('scout')
    await page.waitForURL(/\/scout\/onboarding$/)
  })
})

test.describe('A19 — Player/Coach now route away with no bare-account pre-creation', () => {
  // Fixed: /auth no longer pre-creates a bare account for Player/Coach (see
  // P9/C9 in the onboarding e2e suites). Player is the default role, so
  // choosing it needs an explicit Continue click (there's no <select>
  // onChange to hook since the value never changes) — Coach and the other
  // three roles still navigate immediately on selection.
  test('player (default): Continue navigates to /player/onboarding, no inline form, no signup call', async ({ page }) => {
    const signupCalls: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('/api/auth/signup')) signupCalls.push(r.url())
    })
    await page.goto('/auth')
    await page.getByRole('tab', { name: 'Sign Up' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL(/\/player\/onboarding$/, { timeout: 15_000 })
    expect(signupCalls, 'no bare-account signup request should ever fire for Player').toHaveLength(0)
  })

  test('coach navigates to /coach/onboarding on selection, no inline form, no signup call', async ({ page }) => {
    const signupCalls: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('/api/auth/signup')) signupCalls.push(r.url())
    })
    await page.goto('/auth')
    await page.getByRole('tab', { name: 'Sign Up' }).click()
    await page.getByLabel('I am a…').selectOption('coach')
    await page.waitForURL(/\/coach\/onboarding$/, { timeout: 15_000 })
    expect(signupCalls, 'no bare-account signup request should ever fire for Coach').toHaveLength(0)
  })
})

test.describe('A20 — roleUnavailable notice is dead code', () => {
  // NOT written as a passing behavioral test — there is no reachable state
  // in which this notice block can render. Now that Player/Coach also
  // navigate away immediately (A19, fixed this pass), handleRoleSelect
  // navigates away for ALL FIVE roles the instant one is picked, so the
  // signup form's role-picker screen never stays mounted long enough for
  // roleUnavailable's amber "Not yet available" card to matter for any role.
  test('FINDING: roleUnavailable is hardcoded false — this UI notice can never render', async ({}, testInfo) => {
    testInfo.annotations.push({
      type: 'finding',
      description:
        'DEAD CODE — src/app/auth/page.tsx\'s `const roleUnavailable = false` is an unconditional constant, ' +
        'and the amber "Not yet available" notice block gated behind it is therefore unreachable. Every one ' +
        'of the five roles is now caught by handleRoleSelect navigating away via router.push() the instant ' +
        'it is selected (see A16-A19), so this notice never renders regardless of which role is picked. ' +
        'Recommend deleting the dead block and roleUnavailable, or reinstating a real condition if an ' +
        'in-page notice is ever wanted instead of a hard navigation.',
    })
  })
})

test.describe('A21 — password too short, server', () => {
  test('server-side: hitting the API directly with a short password still 400s', async ({ page, baseURL }) => {
    const res = await signupRequest(page, baseURL!, { role: 'player', email: uniqueEmail('a21-short-api'), password: 'Ab1' })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Password must be at least 10 characters long')
  })
})

test.describe('A22 — letters-only or digits-only password', () => {
  test('letters only → 400 with the specific message', async ({ page, baseURL }) => {
    const res = await signupRequest(page, baseURL!, { role: 'player', email: uniqueEmail('a22-letters'), password: 'OnlyLettersHere' })
    expect(res.status()).toBe(400)
    expect((await res.json()).error).toBe('Password must contain both letters and numbers')
  })

  test('digits only → 400 with the specific message', async ({ page, baseURL }) => {
    const res = await signupRequest(page, baseURL!, { role: 'player', email: uniqueEmail('a22-digits'), password: '1234567890123' })
    expect(res.status()).toBe(400)
    expect((await res.json()).error).toBe('Password must contain both letters and numbers')
  })
})

test.describe('A23 — common passwords are blocked, case-insensitively', () => {
  for (const pw of ['password123', 'Athlasx123', 'CRICKET123']) {
    test(`"${pw}" → 400`, async ({ page, baseURL }) => {
      const res = await signupRequest(page, baseURL!, { role: 'player', email: uniqueEmail('a23-common'), password: pw })
      expect(res.status()).toBe(400)
      expect((await res.json()).error).toContain('too common')
    })
  }
})

test.describe('A24 — valid strong password creates the account and signs in', () => {
  test('response sets a session cookie and account is usable', async ({ page, baseURL }) => {
    const email = uniqueEmail('a24-valid')
    const res = await signupRequest(page, baseURL!, { role: 'player', email, password: 'GenuinelyStrong123' })
    expect(res.status()).toBe(200)
    const setCookie = res.headers()['set-cookie'] ?? ''
    expect(setCookie).toContain('next-auth.session-token')

    const sessionRes = await page.request.get('/api/auth/session')
    const session = await sessionRes.json()
    expect(session?.user?.email).toBe(email)
    expect(session?.user?.role).toBe('player')
  })

  test('UI flow redirects to ROLE_WIZARD_PATH[role] (/player/onboarding) — see A19, Continue navigates for the default role', async ({ page }) => {
    await page.goto('/auth')
    await page.getByRole('tab', { name: 'Sign Up' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL(/\/player\/onboarding$/, { timeout: 15_000 })
  })
})

test.describe('A25 — duplicate email', () => {
  test("409, and the message matches route.ts's isUniqueViolation(P2002) branch exactly", async ({ page, baseURL }) => {
    const email = uniqueEmail('a25-dup')
    const first = await signupRequest(page, baseURL!, { role: 'player', email, password: 'GenuinelyStrong123' })
    expect(first.status()).toBe(200)

    const second = await signupRequest(page, baseURL!, { role: 'player', email, password: 'AnotherStrong456' })
    expect(second.status()).toBe(409)
    // route.ts (lines 64-69) has exactly one path that produces this exact
    // message: catch(err) -> isUniqueViolation(err) checking err.code ===
    // 'P2002' (Prisma's unique-constraint-violation code) -> this response.
    // Any other error type in that catch is re-thrown (would surface as a
    // 500, not this message), so getting this precise 409+message is the
    // strongest black-box proof available that P2002 specifically was hit,
    // short of instrumenting the server process directly.
    expect((await second.json()).error).toBe('An account with this email already exists')
  })
})

test.describe('A26 — malformed JSON body', () => {
  test('400 "Invalid JSON"', async ({ page, baseURL }) => {
    // IMPORTANT: `data` must be a Buffer, not a plain string — Playwright's
    // APIRequestContext re-JSON.stringifies a *string* `data` value when
    // the content-type is application/json (confirmed by inspecting the
    // raw bytes sent), which would turn '{not valid json' into the quoted
    // JSON string "\"{not valid json\"" — valid JSON, defeating the whole
    // point of this test. A Buffer is sent as raw bytes, unmodified.
    const res = await page.request.fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: new URL(baseURL!).origin },
      data: Buffer.from('{not valid json'),
    })
    expect(res.status()).toBe(400)
    expect((await res.json()).error).toBe('Invalid JSON')
  })
})

test.describe('A27 — role not in SIGNUP_ROLES', () => {
  for (const role of ['association', 'scout', 'athlasx_ops', 'selection_panel', 'made-up-role']) {
    test(`role="${role}" → 400, independent of the UI`, async ({ page, baseURL }) => {
      const res = await signupRequest(page, baseURL!, { role, email: uniqueEmail(`a27-${role}`), password: 'GenuinelyStrong123' })
      expect(res.status()).toBe(400)
      expect((await res.json()).error).toBe('Sign-up is not available for this role')
    })
  }
})

test.describe('A28 — academy role while ACADEMY_SELF_SERVE_ENABLED=false', () => {
  test('server re-checks the flag independently of the UI', async ({ page, baseURL }) => {
    const res = await signupRequest(page, baseURL!, { role: 'academy', email: uniqueEmail('a28-academy'), password: 'GenuinelyStrong123' })
    // route.ts line 35: role === 'academy_admin' && !ACADEMY_SELF_SERVE_ENABLED
    // — same 400 as an entirely invalid role, by design (doesn't reveal
    // whether the role is "wrong" or "flagged off").
    expect(res.status()).toBe(400)
    expect((await res.json()).error).toBe('Sign-up is not available for this role')
  })
})

test.describe('A29 — signup rate limiting: 6th attempt for one email within an hour', () => {
  test('429 on the 6th call', async ({ page, baseURL }) => {
    const email = uniqueEmail('a29-ratelimit')
    const statuses: number[] = []
    for (let i = 0; i < 6; i++) {
      const res = await signupRequest(page, baseURL!, { role: 'player', email, password: 'GenuinelyStrong123' })
      statuses.push(res.status())
    }
    // Call 1: 200 (created). Calls 2-5: 409 (duplicate email) — still count
    // toward the bucket regardless of outcome, since rateLimit() increments
    // before route.ts's own db.create ever runs. Call 6: 429.
    expect(statuses[0]).toBe(200)
    expect(statuses.slice(1, 5).every((s) => s === 409)).toBe(true)
    expect(statuses[5]).toBe(429)
  })
})

test.describe('A30 — signup password field autocomplete (now owned by each wizard, not /auth)', () => {
  // The email/password inputs this test targeted lived on /auth itself
  // before this pass; they now live on the destination wizard (e.g.
  // /player/onboarding's own Stage 1 form), which already has its own
  // autoComplete="new-password" attribute and its own coverage in that
  // wizard's onboarding-player.spec.ts suite. Nothing left on /auth to
  // check for this specific role-picker screen.
  test.skip(true, 'password field moved off /auth onto each destination wizard — see onboarding-player.spec.ts')
})

test.describe('A31 — network failure during signup fetch (now owned by each wizard, not /auth)', () => {
  // Same reasoning as A30: /auth no longer fires /api/auth/signup for
  // Player/Coach, so a network-failure-during-signup scenario no longer
  // exists on this page — it would need to be tested against each wizard's
  // own final-submit call instead.
  test.skip(true, 'signup request moved off /auth onto each destination wizard\'s own onboard endpoint')
})

test.describe('A32 — Continue with Google', () => {
  test('toast only, no request fired', async ({ page }) => {
    const googleCalls: string[] = []
    page.on('request', (r) => {
      if (/google|oauth/i.test(r.url())) googleCalls.push(r.url())
    })
    await page.goto('/auth')
    await page.getByRole('button', { name: /Continue with Google/i }).click()
    await expect(page.getByText(/google sign-in isn.t connected yet/i)).toBeVisible()
    expect(googleCalls).toHaveLength(0)
  })
})

test.describe('A33 — Terms / Privacy Policy links', () => {
  // NOT written as a passing test — these are known dead links (href="#"),
  // reported here rather than silently fixed.
  test('FINDING: both links are href="#" placeholders', async ({ page }, testInfo) => {
    await page.goto('/auth')
    const termsHref = await page.getByRole('link', { name: 'Terms' }).getAttribute('href')
    const privacyHref = await page.getByRole('link', { name: 'Privacy Policy' }).getAttribute('href')
    testInfo.annotations.push({
      type: 'finding',
      description:
        `KNOWN GAP — src/app/auth/page.tsx line ~325: Terms href="${termsHref}", Privacy Policy href="${privacyHref}". ` +
        'Both are dead placeholder links, not wired to any real document. Left as-is per instruction — report, do not fix silently.',
    })
    expect(termsHref).toBe('#')
    expect(privacyHref).toBe('#')
  })
})

test.describe('A34 — mode toggle switches without navigating', () => {
  test('"Create an account" / "Sign in instead" toggle stays on /auth', async ({ page }) => {
    await page.goto('/auth')
    await page.getByRole('button', { name: 'Create an account' }).click()
    await expect(page).toHaveURL(/\/auth$/)
    await expect(page.getByRole('tab', { name: 'Sign Up' })).toHaveAttribute('aria-selected', 'true')

    await page.getByRole('button', { name: 'Sign in instead' }).click()
    await expect(page).toHaveURL(/\/auth$/)
    await expect(page.getByRole('tab', { name: 'Sign In' })).toHaveAttribute('aria-selected', 'true')
  })
})
