/**
 * Vitest setup: load .env.local the way Next.js does.
 *
 * Prisma's CLI reads .env; Next reads .env.local. This project only has
 * .env.local, so tests would otherwise start with no DATABASE_URL.
 */
import fs from 'node:fs'
import path from 'node:path'

const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (!m) continue
    const [, key, rawVal] = m
    if (process.env[key] !== undefined) continue
    process.env[key] = rawVal.trim().replace(/^["']|["']$/g, '')
  }
}
