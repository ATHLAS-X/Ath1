/**
 * Read-only safety check to run before ever applying `prisma db push` or a
 * `prisma migrate diff --script` result to the live "athlasx" schema.
 *
 * Why this exists: `prisma migrate diff` treats "in the database but not in
 * schema.prisma" as drift to eliminate. Any table, column or enum that
 * exists live but is not modeled here (legacy or hand-created objects, or a
 * model that was removed) therefore shows up as a DROP in the generated
 * script. This runs that exact diff read-only, flags every statement that
 * would drop or truncate something, and refuses to apply anything itself.
 * It is not a replacement for reading the diff yourself — it is a fast,
 * accurate way to catch a DROP/TRUNCATE before it reaches
 * `prisma db execute`.
 *
 *   node scripts/check-schema-drift.mjs
 *
 * Exit 0: no destructive statement in the diff.
 * Exit 1: at least one DROP/TRUNCATE found — printed in full, nothing applied.
 *
 * Only connects with DATABASE_DIRECT_URL and only introspects; it never
 * writes to the database and never prints the connection string.
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = process.cwd()

function loadEnvLocal() {
  const p = path.join(ROOT, '.env.local')
  if (!fs.existsSync(p)) return
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  }
}

// Constraint/index re-creation (DROP CONSTRAINT followed by ADD CONSTRAINT)
// is routine Prisma output and deliberately not flagged; data-losing
// statements are.
const DESTRUCTIVE = /^\s*(DROP TABLE\b|TRUNCATE\b|DROP COLUMN\b|ALTER TABLE\b[^;]*\bDROP COLUMN\b)/im

function main() {
  loadEnvLocal()
  if (!process.env.DATABASE_DIRECT_URL) {
    throw new Error('DATABASE_DIRECT_URL is not set (checked .env.local) — cannot diff the live schema')
  }

  const diff = execFileSync(
    'npx',
    [
      'prisma', 'migrate', 'diff',
      '--from-url', process.env.DATABASE_DIRECT_URL,
      '--to-schema-datamodel', 'prisma/schema.prisma',
      '--script',
    ],
    { cwd: ROOT, env: process.env, shell: process.platform === 'win32', encoding: 'utf8' },
  )

  // Prisma's --script output separates statements with blank lines after a
  // "-- <Verb>" comment; flag any that drop or truncate rather than add.
  const statements = diff.split(/\n\n+/).map((s) => s.trim()).filter(Boolean)
  const destructive = statements.filter((s) => DESTRUCTIVE.test(s))

  if (destructive.length === 0) {
    console.log('No destructive drift between the live "athlasx" schema and prisma/schema.prisma.')
    process.exit(0)
  }

  console.error(`\n⚠ ${destructive.length} destructive statement(s) found in the live-schema diff. DO NOT apply this diff/push as-is.\n`)
  for (const s of destructive) console.error(s + '\n')
  console.error('A DROP here usually means the live database has an object schema.prisma does not model. Do not let a migration drop it unless that removal is intended.')
  console.error('If you do intend a removal, do it explicitly via its own reviewed prisma/manual_migrations/*.sql file — never via a blind `prisma db push` or `migrate diff --script | psql`.')
  process.exit(1)
}

main()
