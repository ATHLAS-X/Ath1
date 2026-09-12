/**
 * E2E — /auth sign-in flow (src/app/auth/page.tsx), backed by NextAuth's
 * credentials provider (src/lib/auth.ts) and its login-attempt rate
 * limiter (src/lib/rate-limit.ts, bucket "login-password").
 *
 * Every test that needs a real account creates a disposable one via
 * POST /api/auth/signup with a unique email — never touches the seeded
 * prisma/seed.ts accounts (staff@upca.example etc.), so this file can run
 * repeatedly without depleting or depending on shared fixture state.
 *
 * IMPORTANT — rate-limit bucket hygiene: buckets are in-memory on the
 * `next start` server process (globalThis-backed, not per-test-run), keyed
 * by normalized email. Each test below that logs in more than once uses
 * its OWN freshly-generated email so no test can push another over the
 * 10-attempts/15-min cap. Do not reuse emails across tests in this file.
 */
import { test, expect, type Page } from '@playwright/test'

function uniqueEmail(tag: string): string {
  return `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.local`
}

const STRONG_PASSWORD = 'TestPass1234'

async function createDisposableAccount(
  page: Page,
  baseURL: string,
  tag: string,
  role: 'player' | 'coach' = 'player',
) {
  const email = uniqueEmail(tag)
  // /api/auth/signup now enforces a same-origin check (SEC-CSRF) — a bare
  // page.request.post carries no Origin/Referer by default, so it must be
  // supplied explicitly to simulate a legitimate same-origin call from the
  // app's own /auth page.
  const res = await page.request.post('/api/auth/signup', {
    data: { role, email, password: STRONG_PASSWORD },
    headers: { origin: new URL(baseURL).origin },
  })
  expect(res.ok(), `disposable account creation for ${tag} should succeed`).toBe(true)
  // Signup signs the caller in immediately (src/app/api/auth/signup/route.ts)
  // — clear that cookie so this file's own sign-in tests start signed out.
  await page.context().clearCookies()
  return { email, password: STRONG_PASSWORD }
}

test.describe('A1 — default load', () => {
  test('mode=signin, role=player selected, Sign In tab active', async ({ page }) => {
    await page.goto('/auth')
    await expect(page.getByRole('tab', { name: 'Sign In' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('tab', { name: 'Sign Up' })).toHaveAttribute('aria-selected', 'false')
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  })
})

test.describe('A2 — switching to Sign Up clears any sign-in error', () => {
  test('error banner disappears after switching tabs', async ({ page }) => {
    await page.goto('/auth')
    await page.getByPlaceholder('Email address').fill(uniqueEmail('a2-nonexistent'))
    await page.getByPlaceholder('Password').fill('WrongPassword123')
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()
    await expect(page.getByText('Incorrect email or password.')).toBeVisible()

    await page.getByRole('tab', { name: 'Sign Up' }).click()
    await expect(page.getByText('Incorrect email or password.')).toHaveCount(0)
  })
})

test.describe('A3 — shared email/password state across sign-in/signup tabs', () => {
  test('typed values persist when switching tabs — reported as a finding, not asserted as correct', async ({ page }, testInfo) => {
    await page.goto('/auth')
    const email = 'a3-shared-state-probe@test.local'
    await page.getByPlaceholder('Email address').fill(email)
    await page.getByPlaceholder('Password').fill('ProbeValue123')

    await page.getByRole('tab', { name: 'Sign Up' }).click()
    // player is the default role, so the signup email/password inputs are
    // visible without any further click.
    const signupEmailVal = await page.getByPlaceholder('Email address').inputValue()
    const signupPasswordVal = await page.getByPlaceholder('Choose a password').inputValue()

    expect(signupEmailVal, 'email carried over from the sign-in form').toBe(email)
    expect(signupPasswordVal, 'password carried over from the sign-in form').toBe('ProbeValue123')

    testInfo.annotations.push({
      type: 'finding',
      description:
        'FINDING (decision needed, not a bug): src/app/auth/page.tsx keeps one shared email/password ' +
        "useState pair for both the sign-in form and every signup role's inline form (lines 64-65), " +
        'reused verbatim across the tab switch. Confirmed above: text typed into the Sign In form is still ' +
        'present after switching to Sign Up. This is NOT a cross-ROLE or cross-USER data leak (both forms ' +
        'render in the same browser tab, same person, same moment — no other user or role ever sees this ' +
        'value). It IS a UX/intent question worth a deliberate call: (a) if kept, a password typed while ' +
        'intending to sign IN carries into an account-creation submission with no re-confirmation — a typo ' +
        'or wrong-field paste could create an account with an unintended password; (b) the field is not ' +
        'cleared on tab-switch even though the visible label changes from "Sign In" to "Create account", ' +
        'which could read as a minor trust/surprise issue to a user who assumes switching tabs resets the form. ' +
        'Recommend: either clear both fields on tab switch, or keep the email but clear the password ' +
        'specifically when crossing from sign-in to sign-up.',
    })
  })
})

test.describe('A4 — valid credentials redirect to role home', () => {
  test('player account lands on /record after sign-in', async ({ page, baseURL }) => {
    const { email, password } = await createDisposableAccount(page, baseURL!, 'a4-player')
    await page.goto('/auth')
    await page.getByPlaceholder('Email address').fill(email)
    await page.getByPlaceholder('Password').fill(password)
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()
    await page.waitForURL(/\/record$/, { timeout: 15_000 })
  })
})

test.describe('A5 — wrong password', () => {
  test('existing account, wrong password → generic error', async ({ page, baseURL }, testInfo) => {
    const { email } = await createDisposableAccount(page, baseURL!, 'a5-wrongpw')
    await page.goto('/auth')
    await page.getByPlaceholder('Email address').fill(email)
    await page.getByPlaceholder('Password').fill('DefinitelyWrong123')
    const t0 = Date.now()
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/auth/callback/credentials')),
      page.getByRole('button', { name: 'Sign In', exact: true }).click(),
    ])
    const elapsedMs = Date.now() - t0
    await expect(page.getByText('Incorrect email or password.')).toBeVisible()
    testInfo.annotations.push({ type: 'timing-A5-existing-user-wrong-password-ms', description: String(elapsedMs) })
  })
})

test.describe('A6 — non-existent email', () => {
  test('same generic error as A5; timing noted for the SEC-1 timing-attack check', async ({ page }, testInfo) => {
    await page.goto('/auth')
    await page.getByPlaceholder('Email address').fill(uniqueEmail('a6-nonexistent'))
    await page.getByPlaceholder('Password').fill('WhateverPassword123')
    const t0 = Date.now()
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/auth/callback/credentials')),
      page.getByRole('button', { name: 'Sign In', exact: true }).click(),
    ])
    const elapsedMs = Date.now() - t0
    await expect(page.getByText('Incorrect email or password.')).toBeVisible()

    // This test passes regardless of whether SEC-1 (dummy bcrypt.compare on
    // "no such user" to normalize timing) has landed — it only reports the
    // gap, per instruction. src/lib/auth.ts's authenticateWithPassword
    // currently short-circuits `return null` on a missing user BEFORE
    // reaching bcrypt.compare, which is measurably cheaper than the wrong-
    // password path in A5 that does run bcrypt. A single request-pair isn't
    // statistically reliable proof (network/JIT jitter dominates one
    // sample) — flagged here as a lead for a proper multi-sample timing
    // benchmark (e.g. in a dedicated tests/security/*.test.ts), not as a
    // confirmed exploit.
    testInfo.annotations.push({
      type: 'timing-A6-nonexistent-user-ms',
      description: `${elapsedMs}ms (compare against A5's timing-A5 annotation in the same run — a consistently ` +
        'lower A6 number across repeated runs would support the timing-leak concern; a single run here is not conclusive)',
    })
  })
})

test.describe('A7 — empty submit', () => {
  test('blocked client-side by required attributes', async ({ page }) => {
    await page.goto('/auth')
    const reqs: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('/api/auth/callback/credentials')) reqs.push(r.url())
    })
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()
    await page.waitForTimeout(400)
    expect(reqs, 'no network request should fire — HTML5 required validation should block submission').toHaveLength(0)
  })

  test('server-side: empty body hit directly against the API rejects without a 500 or a session', async ({ page }) => {
    const csrfRes = await page.request.get('/api/auth/csrf')
    const { csrfToken } = await csrfRes.json()
    const res = await page.request.post('/api/auth/callback/credentials', {
      form: { csrfToken, email: '', password: '' },
      maxRedirects: 0,
    })
    expect(res.status(), 'should never 500 on an empty credentials body').toBeLessThan(500)

    const sessionRes = await page.request.get('/api/auth/session')
    const session = await sessionRes.json().catch(() => ({}))
    expect(session?.user, 'an empty-credentials POST must never establish a session').toBeUndefined()
  })
})

test.describe('A8 — rate limiting after 10 failed attempts in 15 minutes', () => {
  test('11th attempt is blocked even with the CORRECT password', async ({ page, baseURL }) => {
    const { email, password } = await createDisposableAccount(page, baseURL!, 'a8-ratelimit')
    await page.goto('/auth')

    for (let i = 0; i < 10; i++) {
      await page.getByPlaceholder('Email address').fill(email)
      await page.getByPlaceholder('Password').fill('WrongOnPurpose' + i)
      await Promise.all([
        page.waitForResponse((r) => r.url().includes('/api/auth/callback/credentials')),
        page.getByRole('button', { name: 'Sign In', exact: true }).click(),
      ])
      await expect(page.getByText('Incorrect email or password.')).toBeVisible()
    }

    // 11th attempt, this time with the ACTUAL correct password. If rate
    // limiting is working, this must still fail — proving the block is
    // real (not just "wrong password always errors", which would be true
    // with or without rate limiting and wouldn't prove anything).
    await page.getByPlaceholder('Email address').fill(email)
    await page.getByPlaceholder('Password').fill(password)
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/auth/callback/credentials')),
      page.getByRole('button', { name: 'Sign In', exact: true }).click(),
    ])
    // Must NOT have navigated to the role home.
    await expect(page).toHaveURL(/\/auth$/)
    await expect(
      page.getByText('Incorrect email or password.'),
      'the 11th attempt must still show the SAME generic message — a distinct ' +
        '"too many attempts" message would leak rate-limit state to an attacker',
    ).toBeVisible()
  })
})

test.describe('A9 — rapid double-click submit', () => {
  test('at most one credentials request fires', async ({ page, baseURL }) => {
    const { email } = await createDisposableAccount(page, baseURL!, 'a9-doubleclick')
    await page.goto('/auth')
    await page.getByPlaceholder('Email address').fill(email)
    await page.getByPlaceholder('Password').fill('WrongForCountingOnly123')

    const reqs: number[] = []
    page.on('request', (r) => {
      if (r.url().includes('/api/auth/callback/credentials')) reqs.push(Date.now())
    })

    const btn = page.getByRole('button', { name: 'Sign In', exact: true })
    await Promise.all([btn.click(), btn.click({ force: true })])
    await page.waitForTimeout(800)

    // Reported as an actual measurement, not assumed: the button disables
    // via a React state update (`submitting`) which is not synchronous, so
    // two clicks issued back-to-back in the same tick could both fire
    // before the `disabled` attribute is actually applied in the DOM.
    test.info().annotations.push({
      type: 'A9-request-count',
      description: `${reqs.length} credentials request(s) fired from two rapid clicks`,
    })
    expect(reqs.length, 'a double-click should not submit the login form twice').toBeLessThanOrEqual(1)
  })
})

test.describe('A10 — email normalization', () => {
  test('mixed case + surrounding whitespace still matches the account', async ({ page, baseURL }) => {
    const { email, password } = await createDisposableAccount(page, baseURL!, 'a10-normalize')
    const weird = `  ${email.slice(0, email.indexOf('@')).toUpperCase()}${email.slice(email.indexOf('@'))}  `
    await page.goto('/auth')
    await page.getByPlaceholder('Email address').fill(weird)
    await page.getByPlaceholder('Password').fill(password)
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()
    await page.waitForURL(/\/record$/, { timeout: 15_000 })
  })
})

test.describe('A11 — SQL/NoSQL injection string in email field', () => {
  test('UI: the browser\'s own type="email" validation blocks it before any request fires', async ({ page }) => {
    // Reported as a finding, not just asserted: "' OR 1=1 --" isn't a
    // syntactically valid email (no @), so HTML5 constraint validation on
    // <input type="email" required> stops the native "submit" event from
    // ever firing — handleSignIn (auth/page.tsx) never runs, and no
    // request reaches the server at all. This is a real (if incidental)
    // first line of defense worth knowing about, separate from whatever
    // the server does with the same string if it ever arrives directly.
    await page.goto('/auth')
    const reqs: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('/api/auth/callback/credentials')) reqs.push(r.url())
    })
    await page.getByPlaceholder('Email address').fill("' OR 1=1 --")
    await page.getByPlaceholder('Password').fill('whatever123')
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()
    await page.waitForTimeout(400)
    expect(reqs, 'browser email-format validation should block this before it ever becomes an HTTP request').toHaveLength(0)
  })

  test('server: hit directly (bypassing the browser\'s own email-format gate) — safe no-match, no 500', async ({ page }) => {
    const csrfRes = await page.request.get('/api/auth/csrf')
    const { csrfToken } = await csrfRes.json()
    const res = await page.request.post('/api/auth/callback/credentials', {
      form: { csrfToken, email: "' OR 1=1 --", password: 'whatever123' },
      maxRedirects: 0,
    })
    expect(res.status(), 'Prisma parameterizes queries — an injection string must never 500').toBeLessThan(500)
    const sessionRes = await page.request.get('/api/auth/session')
    const session = await sessionRes.json().catch(() => ({}))
    expect(session?.user, 'an injection string must never authenticate anyone').toBeUndefined()
  })
})

test.describe('A12 — XSS payload in email field', () => {
  test('UI: the payload isn\'t a valid email shape either, so it never round-trips through the form', async ({ page }) => {
    // Same underlying fact as A11: type="email" rejects '<script>...' as a
    // malformed address before submission, so testing "does the sign-in
    // PAGE reflect this unescaped" via the visible form isn't actually
    // possible — there's no code path where the page echoes an invalid
    // email back into its own DOM at all (the error message is a fixed
    // string, not an echo of user input). The real test is server-side.
    const dialogs: string[] = []
    page.on('dialog', (d) => {
      dialogs.push(d.message())
      d.dismiss()
    })
    await page.goto('/auth')
    const payload = '<script>window.__xssFired = true</script>'
    await page.getByPlaceholder('Email address').fill(payload)
    await page.getByPlaceholder('Password').fill('whatever123')
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()
    await page.waitForTimeout(400)
    expect(dialogs, 'no alert/dialog should ever fire').toHaveLength(0)
    const fired = await page.evaluate(() => (window as unknown as { __xssFired?: boolean }).__xssFired)
    expect(fired, 'the injected <script> must never execute').toBeUndefined()
  })

  test('server: hit directly — no unescaped reflection anywhere in the response HTML/JSON', async ({ page }) => {
    const csrfRes = await page.request.get('/api/auth/csrf')
    const { csrfToken } = await csrfRes.json()
    const payload = '<script>window.__xssFired = true</script>'
    const res = await page.request.post('/api/auth/callback/credentials', {
      form: { csrfToken, email: payload, password: 'whatever123' },
      maxRedirects: 0,
    })
    const body = await res.text()
    expect(body).not.toContain('<script>window.__xssFired')
  })
})

test.describe('A13 — "Remember me" is cosmetic only', () => {
  test('session cookie expiry is identical whether the checkbox is checked or not', async ({ page, context, baseURL }) => {
    // KNOWN GAP, not fixed here: src/app/auth/page.tsx's checkbox (line
    // ~230) has no onChange/name wired to anything — handleSignIn (line
    // 69) never reads its state, and applySessionCookie (src/lib/auth.ts)
    // always sets a flat 30-day maxAge regardless of caller intent. This
    // test proves that by direct comparison rather than just reading the
    // code, then reports it — the checkbox currently promises the user a
    // choice ("Remember me") the backend cannot honor either way.
    const acc1 = await createDisposableAccount(page, baseURL!, 'a13-unchecked')
    await page.goto('/auth')
    await page.getByPlaceholder('Email address').fill(acc1.email)
    await page.getByPlaceholder('Password').fill(acc1.password)
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()
    await page.waitForURL(/\/record$/)
    const cookiesUnchecked = await context.cookies()
    const sessionUnchecked = cookiesUnchecked.find((c) => c.name.includes('next-auth.session-token'))
    await context.clearCookies()

    const acc2 = await createDisposableAccount(page, baseURL!, 'a13-checked')
    await page.goto('/auth')
    await page.getByRole('checkbox').check()
    await page.getByPlaceholder('Email address').fill(acc2.email)
    await page.getByPlaceholder('Password').fill(acc2.password)
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()
    await page.waitForURL(/\/record$/)
    const cookiesChecked = await context.cookies()
    const sessionChecked = cookiesChecked.find((c) => c.name.includes('next-auth.session-token'))

    expect(sessionUnchecked?.expires, 'cookie should exist').toBeGreaterThan(0)
    const deltaSeconds = Math.abs((sessionChecked?.expires ?? 0) - (sessionUnchecked?.expires ?? 0))
    expect(
      deltaSeconds,
      'KNOWN GAP: "Remember me" is purely cosmetic — checking it changes nothing about session length. ' +
        'This assertion documents that fact (expiry deltas only from wall-clock drift between the two logins, not the checkbox).',
    ).toBeLessThan(5)
  })
})

test.describe('A14 — Forgot password', () => {
  // TODO(SEC-4): once a real password-reset flow ships, replace this test
  // with one that follows the actual reset link/token flow end to end.
  // Linked here so it isn't forgotten when SEC-4 lands.
  test('shows the "not wired up yet" toast, no navigation', async ({ page }) => {
    await page.goto('/auth')
    await page.getByRole('button', { name: 'Forgot password?' }).click()
    await expect(page.getByText(/password reset isn.t wired up yet/i)).toBeVisible()
    await expect(page).toHaveURL(/\/auth$/)
  })
})

test.describe('A15 — sign-in redirect ignores callbackUrl (no open redirect)', () => {
  test('an attacker-supplied callbackUrl is never honored', async ({ page, baseURL }) => {
    const { email, password } = await createDisposableAccount(page, baseURL!, 'a15-noredirect')
    await page.goto('/auth?callbackUrl=https%3A%2F%2Fevil.example.com')
    await page.getByPlaceholder('Email address').fill(email)
    await page.getByPlaceholder('Password').fill(password)
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()
    await page.waitForURL(/\/record$/, { timeout: 15_000 })
    expect(page.url()).not.toContain('evil.example.com')
    expect(new URL(page.url()).search).toBe('')
  })
})
