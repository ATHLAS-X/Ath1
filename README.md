# AthlasX

India's cricket talent discovery platform — connecting players, coaches, academies, associations, and scouts around verified performance data.

**Stack:** Next.js 14.2.35 (App Router) · TypeScript · Tailwind (`ax-*` design tokens) · Prisma 6 / Postgres (Supabase) · NextAuth (Credentials provider, JWT sessions) · Framer Motion · Sentry (`@sentry/nextjs`).

For a complete, page by page and route-by-route reference — every button and form field, the full API surface, security mechanisms, and the database schema — see **[docs/AthlasX_Complete_Platform_Reference.md](docs/AthlasX_Complete_Platform_Reference.md)**. This README only covers getting the app running locally.

## Roles

`player` · `coach` · `association` · `academy_admin` · `scout` · `selection_panel` · `athlasx_ops`. Each role has its own onboarding flow and dashboard (see `src/lib/chrome.ts` for the nav/role map). Academy and Scout self-serve signup are gated behind feature flags in `src/lib/feature-flags.ts`.

## Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | yes | Pooled Supabase Postgres connection string (Supavisor, `:6543`) — used for all runtime queries |
| `DATABASE_DIRECT_URL` | yes | Direct, non-pooled Postgres connection (`:5432`) — used for `prisma generate`/introspection and for applying `prisma/manual_migrations/*.sql` |
| `NEXTAUTH_SECRET` | yes | 32+ byte random secret. Generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | yes | `http://localhost:3000` locally, your deployed URL in production |
| `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN` | no | Sentry error reporting. The SDK no-ops safely with these unset — `error.tsx` still shows its fallback screen, it just doesn't report anywhere |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | no | Enables source-map upload at build time. Without them the build still succeeds; Sentry's webpack plugin just skips that step |

## Local Setup

```bash
npm install          # postinstall runs `prisma generate` automatically
# fill in .env.local (see above)
npm run dev           # serves at http://localhost:3000
```

`npm install`'s `postinstall` hook generates the Prisma client from `prisma/schema.prisma`. If the schema changes, re-run `npx prisma generate` manually.

## Database

Schema lives in `prisma/schema.prisma`, all models pinned to a dedicated `"athlasx"` Postgres schema. This project does **not** use `prisma migrate` — there's no `prisma/migrations/` directory. Schema is applied directly (`prisma db push`), and any change that needs a reviewable SQL diff goes into `prisma/manual_migrations/*.sql`, applied by hand:

```bash
npx prisma db execute --file prisma/manual_migrations/<file>.sql --url "$DATABASE_DIRECT_URL"
```

Always use `DATABASE_DIRECT_URL` for schema/DDL operations, never the pooled `DATABASE_URL` — see `docs/AthlasX_Complete_Platform_Reference.md` §6 for why.

To seed a minimal realistic dataset (one association, a few shadow player profiles, a grading session, weekly tracking data):

```bash
npx tsx prisma/seed.ts
```

## Running Tests

Tests run against an isolated `athlasx_test` Postgres schema derived from the real one — it never touches live data.

```bash
npm run test:setup-db     # provisions the athlasx_test schema
npm run test:ci           # unit + integration + security + known-defects suites
npm run test:teardown-db  # drops the athlasx_test schema
```

Granular scripts: `test:unit`, `test:integration`, `test:security`, `test:coverage`, `test:e2e` (Playwright). `tests/known-defects/` is a deliberate exception — those tests are *expected* to fail until the documented defect they track is actually fixed; don't "fix" them by loosening the assertion.

## Other Scripts

| Command | Does |
|---|---|
| `npm run build` | Production build |
| `npm run start` | Serve a production build |
| `npm run lint` | `next lint` |
| `npm run audit:js` | `npm audit` |

## Project Structure

```
src/app/              Next.js App Router — pages under (dashboard)/ are role-gated, api/ is the backend
src/lib/               Auth, rate-limiting, verification gates, feature flags, scoring, OTP stubs
src/components/        Shared UI (ax.* design-token components) and role-specific components
prisma/schema.prisma   Full data model
prisma/manual_migrations/  Hand-applied SQL diffs (see Database above)
prisma/seed.ts         Minimal dev/demo dataset
tests/                 unit/ integration/ security/ known-defects/
docs/                  Reference docs, including the full platform reference linked above
```
