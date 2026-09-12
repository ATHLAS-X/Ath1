import { defineConfig, devices } from '@playwright/test'

/**
 * E2E runs against a real production build talking to the real "athlasx"
 * schema — the app has no auth, so there is nothing to log in as, and the
 * pages read live data. Tests are therefore READ-ONLY: they navigate and
 * assert, and never submit a form that writes.
 *
 *   npm run build && npm run test:e2e
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 1, // Neon autosuspend can make the first request of a run slow
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3210',
    trace: 'retain-on-failure',
    actionTimeout: 15_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx next start -p 3210',
    // Was '/dashboard' — that page is now gated behind a real session
    // (requirePageRole -> notFound() for a signed-out request), so an
    // unauthenticated readiness probe got a 404 forever and Playwright's
    // webServer never considered the (perfectly healthy) server "ready",
    // timing out at 180s every run. '/' has no auth gate and always 200s.
    url: 'http://127.0.0.1:3210/',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
