// One-off script (not part of the app) that signs in as each seeded demo
// role and saves a full-page screenshot of its dashboard to
// dashboards_screenshots/, so the freshly-seeded dummy data (prisma/
// seed-demo-dashboards.ts, prisma/seed-this-player-record.mjs) can be
// reviewed visually without opening a browser manually.
// Run with: node prisma/screenshot-dashboards.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'fs'

const BASE = 'http://localhost:3000'
const OUT_DIR = 'dashboards_screenshots'
mkdirSync(OUT_DIR, { recursive: true })

const targets = [
  { email: 'e2e-mobileplayer@test.local', password: 'Zq9vXk4mPr7wLj2', path: '/record', file: 'player-record.png' },
  { email: 'e2e-authflow-coach@test.local', password: 'Zq9vXk4mPr7wLj2', path: '/coach', file: 'coach.png' },
  { email: 'e2e-mobileacademy@test.local', password: 'Zq9vXk4mPr7wLj2', path: '/academy', file: 'academy.png' },
  { email: 'e2e-mobilescout2@test.local', password: 'Zq9vXk4mPr7wLj2', path: '/scout', file: 'scout.png' },
  { email: 'staff@upca.example', password: 'athlasx-dev-password', path: '/association', file: 'association.png' },
  { email: 'staff@upca.example', password: 'athlasx-dev-password', path: '/dashboard', file: 'dashboard.png' },
  { email: 'staff@upca.example', password: 'athlasx-dev-password', path: '/ingest', file: 'ingest.png' },
  { email: 'staff@upca.example', password: 'athlasx-dev-password', path: '/tracking', file: 'tracking.png' },
  { email: 'staff@upca.example', password: 'athlasx-dev-password', path: '/identity-exceptions', file: 'identity-exceptions.png' },
  { email: 'chair@upca.example', password: 'athlasx-dev-password', path: '/grading', file: 'grading.png' },
  { email: 'chair@upca.example', password: 'athlasx-dev-password', path: '/convergence', file: 'convergence.png' },
]

async function signInAndShoot(browser, { email, password, path, file }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  await page.goto(`${BASE}/auth`, { waitUntil: 'networkidle' })
  await page.getByPlaceholder('Email address').fill(email)
  await page.getByPlaceholder('Password').fill(password)
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
  await page.waitForURL(url => !url.pathname.startsWith('/auth'), { timeout: 15000 }).catch(() => {})
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${OUT_DIR}/${file}`, fullPage: true })
  console.log(`Saved ${OUT_DIR}/${file}  (${email} -> ${path})`)
  await context.close()
}

async function main() {
  const browser = await chromium.launch()
  for (const t of targets) {
    try {
      await signInAndShoot(browser, t)
    } catch (err) {
      console.error(`FAILED ${t.file}:`, err.message)
    }
  }
  await browser.close()
}

main()
