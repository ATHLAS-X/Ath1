/**
 * E2E — landing page (/), src/app/page.tsx + src/components/marketing/HeroLanding.tsx.
 *
 * Session redirect checks (L2, L4) forge a NextAuth JWT cookie directly
 * (tests/e2e/helpers/session.ts) rather than logging in through the UI —
 * the root page's redirect only depends on getServerSession() decoding a
 * valid/invalid cookie, not on which user actually owns it, so this
 * exercises the real code path without needing a seeded account per role.
 */
import { test, expect } from '@playwright/test'
import { setForgedSession, forgedSessionJwt, cookieName } from './helpers/session'

// Mirrors src/lib/chrome.ts's ROLE_HOME — kept as a literal copy (not an
// import) so this spec doesn't reach into src/ from tests/e2e, matching
// this file's existing sibling (workflows.spec.ts) which also hardcodes
// its expected page set rather than importing app config.
const ROLE_HOME: Record<string, string> = {
  player: '/record',
  coach: '/coach',
  association: '/association',
  athlasx_ops: '/dashboard',
  selection_panel: '/selection',
  academy_admin: '/academy',
  scout: '/scout',
}

// Mirrors src/lib/session-role-refresh.ts's PRIVILEGED_ROLES, same
// literal-copy convention as ROLE_HOME above. These four roles now get
// re-checked against the DB on every request (the stale-JWT-role audit
// fix) — a forged session for one of them, backed by no real user row,
// correctly resolves to an empty role and falls back to /dashboard rather
// than being trusted for its claimed destination. Non-privileged roles
// aren't DB-checked at all, so a forged id is still fine for them and they
// keep landing on their real claimed home.
const PRIVILEGED_ROLES = new Set(['athlasx_ops', 'association', 'academy_admin', 'scout'])

test.describe('L1 — signed-out visit renders the hero', () => {
  test('hero content and both account-bar links are present', async ({ page }) => {
    const res = await page.goto('/')
    expect(res?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: /athlasx/i })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sign In' })).toHaveAttribute('href', '/auth')
    // Signup carries ?mode=signup (see L3) so /auth opens on the right tab.
    await expect(page.getByRole('link', { name: 'Signup' })).toHaveAttribute('href', '/auth?mode=signup')
  })
})

test.describe('L2 — signed-in visit redirects before hero renders', () => {
  for (const [role, claimedHome] of Object.entries(ROLE_HOME)) {
    // A forged session for a privileged role has no real backing User row,
    // so the DB re-check (session-role-refresh.ts) correctly demotes it to
    // an empty role, landing on the generic /dashboard fallback instead of
    // the role-specific page a REAL account of that role would reach.
    const home = PRIVILEGED_ROLES.has(role) ? '/dashboard' : claimedHome

    test(`role=${role} → ${home}, at the HTTP layer (no flash of hero content)`, async ({ page, baseURL }) => {
      const jwt = await forgedSessionJwt({ role })
      const cookie = `${cookieName()}=${jwt}`

      // Raw request with redirects disabled: proves the redirect happens
      // in the SERVER RESPONSE itself (a 307/308 with a Location header),
      // not as a client-side effect after the hero has already painted.
      const raw = await page.request.get('/', {
        headers: { cookie },
        maxRedirects: 0,
      })
      expect([307, 308]).toContain(raw.status())
      const location = raw.headers()['location']
      expect(location, `role=${role} should redirect to ${home}`).toContain(home)
      // HeroLanding's own distinctive markup — the account-bar Sign In/
      // Signup links — must never appear in the redirect response body;
      // that would be the flash-of-wrong-content bug.
      const rawBody = await raw.text().catch(() => '')
      expect(rawBody).not.toContain('ATHLASX')

      // Follow through in a real browser too, confirming the final landed
      // page is the role home, not the hero.
      await setForgedSession(page.context(), baseURL!, { role })
      await page.goto('/')
      await expect(page).toHaveURL(new RegExp(home.replace('/', '\\/') + '(\\/|$|\\?)'))
      await expect(page.getByRole('link', { name: 'Sign In' })).toHaveCount(0)
    })
  }
})

test.describe('L3 — account-bar links navigate, tab pre-selection', () => {
  test('Sign In navigates to /auth on the Sign In tab', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Sign In' }).click()
    await expect(page).toHaveURL(/\/auth$/)
    await expect(page.getByRole('tab', { name: 'Sign In' })).toHaveAttribute('aria-selected', 'true')
  })

  // FIXED (was a documented, deliberately-failing KNOWN GAP): the landing
  // page's "Signup" link now carries ?mode=signup (HeroLanding.tsx), and
  // /auth reads it via useSearchParams to pick its initial tab
  // (src/app/auth/page.tsx). "Sign In" still points at bare "/auth" — the
  // two links are now genuinely different URLs, which is the actual fix,
  // not just a passing assertion.
  test('Signup navigates to /auth with the Sign Up tab pre-selected', async ({ page }) => {
    await page.goto('/')
    const signInHref = await page.getByRole('link', { name: 'Sign In' }).getAttribute('href')
    const signupHref = await page.getByRole('link', { name: 'Signup' }).getAttribute('href')
    expect(signInHref, 'the two links must be genuinely different URLs now, not just different labels on the same href').not.toBe(signupHref)
    expect(signupHref).toContain('mode=signup')

    await page.getByRole('link', { name: 'Signup' }).click()
    await expect(page).toHaveURL(/\/auth\?mode=signup$/)
    await expect(page.getByRole('tab', { name: 'Sign Up' })).toHaveAttribute('aria-selected', 'true')
  })
})

test.describe('L4 — forged/expired session cookie', () => {
  test('garbage cookie value: hero renders, no crash', async ({ page, baseURL, context }) => {
    const { hostname } = new URL(baseURL!)
    await context.addCookies([
      {
        name: cookieName(),
        value: 'not-a-real-jwt.garbage.value',
        domain: hostname,
        path: '/',
      },
    ])
    const res = await page.goto('/')
    expect(res?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: /athlasx/i })).toBeVisible()
  })

  test('expired (but validly-signed) JWT: hero renders, no crash', async ({ page, baseURL, context }) => {
    // maxAge: -60 -> exp computed 60s in the past at signing time.
    await setForgedSession(context, baseURL!, { role: 'association', maxAge: -60 })
    const res = await page.goto('/')
    expect(res?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: /athlasx/i })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sign In' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Signup' })).toBeVisible()
  })
})

test.describe('L5 — collage renders with alt text even if images fail to load', () => {
  test('7 tiles, each with non-empty alt, survive blocked image requests', async ({ page }) => {
    await page.route(/\/(images\/|_next\/image)/, (route) => route.abort())
    await page.goto('/')
    const images = page.locator('img')
    await expect(images).toHaveCount(7)
    const alts = await images.evaluateAll((els) => els.map((el) => el.getAttribute('alt')))
    for (const alt of alts) {
      expect(alt, 'every tile must keep descriptive alt text even when the image itself fails').toBeTruthy()
      expect(alt!.length).toBeGreaterThan(10)
    }
  })
})

test.describe('L6 — keyboard-only navigation reaches both account-bar links', () => {
  test('Tab reaches Sign In then Signup with a visible focus state', async ({ page }) => {
    await page.goto('/')
    const seen: string[] = []
    let focusedHref: string | null = null
    for (let i = 0; i < 15 && seen.length < 2; i++) {
      await page.keyboard.press('Tab')
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLAnchorElement | null
        if (!el || el.tagName !== 'A') return null
        const style = getComputedStyle(el)
        return {
          href: el.getAttribute('href'),
          text: el.textContent?.trim(),
          outlineStyle: style.outlineStyle,
          outlineWidth: style.outlineWidth,
          boxShadow: style.boxShadow,
        }
      })
      if (info?.text === 'Sign In' || info?.text === 'Signup') {
        seen.push(info.text)
        focusedHref = info.href
        // Visible focus state: browser default focus ring (outline) present,
        // since this button defines no custom :focus/:focus-visible style
        // (confirmed by reading HeroLanding.tsx — no focus:outline-none class).
        const hasVisibleFocus = info.outlineStyle !== 'none' || info.boxShadow !== 'none'
        expect(hasVisibleFocus, `${info.text} link has no visible focus indicator`).toBe(true)
      }
    }
    expect(seen, 'expected to Tab onto both Sign In and Signup').toEqual(
      expect.arrayContaining(['Sign In', 'Signup']),
    )
    // Last one tabbed to is Signup, which now carries ?mode=signup (see L3).
    expect(focusedHref).toBe('/auth?mode=signup')
  })
})

test.describe('L7 — mobile viewport', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('no horizontal overflow at 375px wide', async ({ page }) => {
    await page.goto('/')
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(
      overflow.scrollWidth,
      `page is ${overflow.scrollWidth}px wide but viewport is ${overflow.clientWidth}px — horizontal overflow`,
    ).toBeLessThanOrEqual(overflow.clientWidth + 1) // +1px rounding tolerance
  })

  test('reports whether the hero collage has any mobile-specific fallback', async ({ page }, testInfo) => {
    await page.goto('/')
    // HeroLanding.tsx's collage grid (lines 37-44) uses a single fixed
    // gridTemplateColumns/Rows/Areas with no responsive (sm:/lg:) variant
    // anywhere in the file — unlike /auth's collage, which is hidden
    // entirely below lg via `hidden lg:block` (auth/page.tsx line ~143).
    // This test reports that finding rather than asserting pass/fail on
    // a design opinion: the same 4-column/3-row grid is forced down to a
    // 375px viewport with no breakpoint swap.
    const gridInfo = await page.evaluate(() => {
      const grid = document.querySelector('[style*="grid-template-areas"]') as HTMLElement | null
      if (!grid) return null
      const style = getComputedStyle(grid)
      return { gridTemplateColumns: style.gridTemplateColumns, columnCount: style.gridTemplateColumns.split(' ').length }
    })
    testInfo.annotations.push({
      type: 'finding',
      description: gridInfo
        ? `No responsive breakpoint on the collage grid — still renders ${gridInfo.columnCount} columns (${gridInfo.gridTemplateColumns}) at 375px, unlike /auth's collage which hides entirely below lg. Cosmetically cramped on mobile, not a functional break (L7's overflow test above still passes).`
        : 'Could not locate the collage grid element to inspect.',
    })
    expect(gridInfo, 'collage grid element should exist in the DOM').not.toBeNull()
  })
})
