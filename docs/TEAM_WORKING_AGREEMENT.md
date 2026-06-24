# ATHLASX — Team Working Agreement

## Ownership split

| Area | Owner | Tech |
|------|-------|------|
| Next.js web app, API routes, DB schema | Hritvik | TypeScript, Prisma, Neon |
| Frontend pages & UI | Harshit | Next.js, Tailwind, Framer Motion |
| AI compute service, ML models | Mrigank | Python, FastAPI, Gemini |

## Schema rule (non-negotiable)
**Prisma is the sole DB schema owner.**

- All migrations run through `prisma migrate` from the root Next.js app.
- The FastAPI compute service (`apps/compute`) reads Neon via SQLAlchemy **reflection only**.
- No Alembic migrations. Ever.

## API contract
Next.js proxies AI-heavy work to compute via `/api/v1/compute/*`.

| Caller | Endpoint | Owner |
|--------|----------|-------|
| Next.js | `POST /api/v1/compute/behaviour` | Mrigank |
| Next.js | `POST /api/v1/compute/video` | Mrigank |

Compute endpoints return `{ task_id }` for async jobs; Next.js polls `GET /api/v1/compute/tasks/{id}`.

## Git workflow
- `main` — production, protected. PRs only.
- `dev` — staging. Merge feature branches here first.
- Branch naming: `feat/`, `fix/`, `infra/`, `compute/`
- One PR per feature. Squash merge into `dev`, regular merge into `main`.

## Stack (final — no more changes)
| Component | Choice |
|-----------|--------|
| Framework | Next.js 14 (App Router) |
| ORM | Prisma + Neon PostgreSQL |
| Auth | NextAuth v4 |
| AI | Gemini 2.5 Flash/Pro |
| Compute | FastAPI + ARQ + Redis |
| Hosting | Oracle Ampere A1 VM + Docker + Caddy + Cloudflare Tunnel |
| Media | OCI Object Storage |

## Compliance guardrails
- Raw Aadhaar numbers are **never stored** — HMAC-SHA256 token only.
- Biometric auth is **not in V1** (legally prohibited under DPDP Act).
- Psych assessment is **adult-only (18+)** — minors use coach behavioral evaluation.
- KYC vendor access (Surepass/Signzy) requires registered entity — pending.

## Open launch items
- [ ] Entity formation (blocks KYC vendor onboarding)
- [ ] Neon production connection string
- [ ] Oracle VM provisioned + `infra/bootstrap.sh` run
- [ ] Cloudflare Tunnel token generated
- [ ] OCI bucket created (`athlasx-media`, `ap-hyderabad-1`)
- [ ] MSG91 SMS gateway wired
- [ ] Privacy policy + grievance officer appointed
- [ ] Data deletion/retention policy written
