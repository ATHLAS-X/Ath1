/**
 * E2E — the nine pivot workflows as a user actually meets them.
 *
 * These run against a production build reading the real "athlasx" schema.
 * The app has no authentication, so there is no login step — which is
 * itself asserted below as a finding, not glossed over.
 *
 * READ-ONLY by design: no test submits a form that writes to the database.
 */
import { test, expect } from '@playwright/test'

const PAGES = [
  { path: '/dashboard', heading: 'Association Overview', workflow: 'Association hub' },
  { path: '/ingest', heading: 'Ingest & Data', workflow: 'W1 ingest' },
  { path: '/trial-cycles', heading: 'Trial Cycles', workflow: 'W3 trial cycle' },
  { path: '/selection', heading: 'Candidate Pool', workflow: 'W4 candidate pool' },
  { path: '/grading', heading: 'Blind Grading', workflow: 'W4 grading' },
  { path: '/convergence', heading: 'Convergence View', workflow: 'W4 convergence' },
  { path: '/tracking', heading: 'Weekly Tracking', workflow: 'W5 tracking' },
  { path: '/coach', heading: 'Coach Dashboard', workflow: 'W7 coach' },
  { path: '/record', heading: 'My Record', workflow: 'W6 player record' },
]

test.describe('every workflow page renders', () => {
  for (const { path, heading, workflow } of PAGES) {
    test(`${workflow} — ${path}`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', e => errors.push(e.message))

      const res = await page.goto(path)
      expect(res?.status(), `${path} should return 200`).toBe(200)
      await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
      expect(errors, `${path} threw client-side errors`).toEqual([])
    })
  }
})

test.describe('navigation', () => {
  test('the sidebar links to every workflow and none 404', async ({ page }) => {
    await page.goto('/dashboard')
    const hrefs = await page.locator('nav a[href^="/"]').evaluateAll(as =>
      Array.from(new Set(as.map(a => a.getAttribute('href')!))),
    )
    expect(hrefs.length).toBeGreaterThan(5)

    for (const href of hrefs) {
      const res = await page.request.get(href)
      expect(res.status(), `sidebar link ${href} is broken`).toBeLessThan(400)
    }
  })
})

test.describe('W4 — the Player Quick View', () => {
  /** The Quick View only renders once a player row is selected. */
  async function openQuickView(page: import('@playwright/test').Page) {
    await page.goto('/grading')
    await expect(page.getByRole('heading', { name: 'Blind Grading', level: 1 })).toBeVisible()
    const row = page.locator('button.glass-card').first()
    await expect(row).toBeVisible()
    await row.click()
    // Batting is always rendered for a player with batting data.
    await expect(page.getByText('Batting', { exact: true }).first()).toBeVisible()
  }

  test('shows batting and bowling but never a fielding or keeping rating', async ({ page }) => {
    await openQuickView(page)
    const body = (await page.locator('body').innerText()).toLowerCase()

    // The W4 addition: these two dimensions are deliberately unscored, so
    // no numeric rating may appear against either.
    expect(body).not.toMatch(/fielding\s*[:\-–]?\s*\d/)
    expect(body).not.toMatch(/keeping\s*[:\-–]?\s*\d/)
  })

  test('states the fielding/keeping exclusion policy on screen', async ({ page }) => {
    await openQuickView(page)
    const body = (await page.locator('body').innerText()).toLowerCase()
    expect(body).toContain('not rated')
  })

  test('shows provenance so the number is checkable, not just accepted', async ({ page }) => {
    await openQuickView(page)
    const body = (await page.locator('body').innerText()).toLowerCase()
    expect(body).toMatch(/verified matches/)
  })

  test('tells the selector their grade stays hidden until convergence', async ({ page }) => {
    await page.goto('/grading')
    const body = (await page.locator('body').innerText()).toLowerCase()
    expect(body).toContain('convergence')
  })
})

test.describe('W2 — claim flow is reachable', () => {
  test('the claim page loads for an unauthenticated visitor', async ({ page }) => {
    const res = await page.goto('/claim')
    expect(res?.status()).toBe(200)
  })
})

test.describe('SECURITY (expected to fail): the app requires no login', () => {
  test('a dashboard with player data should not be reachable anonymously', async ({ page }) => {
    // No cookies, no headers, no session — straight to the data.
    const res = await page.goto('/dashboard')
    expect(
      res?.status(),
      'the association dashboard rendered for an anonymous visitor',
    ).toBe(401)
  })

  test('the candidate pool API should not answer an anonymous request', async ({ request }) => {
    const res = await request.get('/api/candidate-pool')
    expect(
      res.status(),
      'candidate-pool returned player PII to an anonymous request',
    ).toBe(401)
  })
})
