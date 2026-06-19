# Athlasx
India's cricket talent discovery platform.

India's Cricket Talent Discovery Platform — Next.js 14 (App Router) + TypeScript + Tailwind, NeonDB Postgres, NextAuth (Credentials + JWT).

## Environment Variables

All required, set in `.env.local` for development and as Vercel Project Environment Variables for production:

| Variable | Description |
|---|---|
| `DATABASE_URL` | NeonDB Postgres connection string (`postgresql://user:pass@host/db?sslmode=require`) |
| `NEXTAUTH_SECRET` | 32+ byte random secret. Generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Public site URL. `http://localhost:3000` locally, `https://<your-app>.vercel.app` in prod |

## Local Setup

Project location: `C:\Users\saura\AthlasX`

```powershell
cd C:\Users\saura\AthlasX
# Ensure .env.local has DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL set
npm install
npm run db:init   # applies lib/schema.sql to Neon
npm run dev       # serves at http://localhost:3000
```

## Deploy to Vercel + NeonDB

1. **Create Neon project** at https://neon.tech → copy the pooled Postgres connection string.
2. **Run schema once locally** against the Neon DB: `npm run db:init` (or paste `lib/schema.sql` into the Neon SQL editor).
3. **Push the repo** to GitHub.
4. **Import the repo in Vercel** (Framework preset auto-detects Next.js).
5. In **Vercel → Settings → Environment Variables**, add:
   - `DATABASE_URL` = your Neon pooled connection string
   - `NEXTAUTH_SECRET` = `openssl rand -base64 32`
   - `NEXTAUTH_URL` = `https://<your-app>.vercel.app`
6. **Deploy.** First build will create the production site.
7. After domain is live, update `NEXTAUTH_URL` to the final domain if you attach a custom domain.

The Neon serverless driver (`@neondatabase/serverless`) works with Vercel Edge and Node runtimes out of the box — no additional config required.

## Academy Onboarding Setup

The academy admin surface (sign-up → onboarding wizard → dashboard → players / coaches / fitness) is data-backed end to end. Follow these steps to bring it online from scratch.

### 1. Database setup

AthlasX uses NeonDB Postgres. If you'd rather mirror the original Supabase-shaped prompts, the env keys are reserved in `.env.local.example` — wire up your own client and the surface code works as-is.

- Create a Neon project at https://neon.tech and copy the pooled connection string into `DATABASE_URL` (or your equivalent Supabase URL + service-role key).
- The default schema lives at `lib/schema.sql`.

### 2. Run the academy migrations

```powershell
npx tsx scripts/migrations/players-page.ts         # invite tokens + perf summary + fitness assessments
npx tsx scripts/migrations/coaches-fitness-pages.ts # soft-delete on academy_coaches
```

Each script is idempotent — re-run safely after pulling new code.

### 3. Enable phone OTP (Aadhaar verification)

If you swap in Supabase Auth, enable **Auth → Providers → Phone (SMS)** in the Supabase dashboard before testing the player Aadhaar OTP step. On the Neon/NextAuth path the OTP flow is simulated for V1; production should wire a real SMS provider into `/api/onboarding/aadhaar/initiate`.

### 4. Storage bucket for `academy-assets`

Academy logos upload to a path controlled by `lib/onboarding-server.ts → saveUpload()`. Two options:

- **Local development**: files are written to `public/uploads/<userId>/academy-assets/` so Next can serve them from `/uploads/...` automatically. Nothing extra to configure.
- **Production (Supabase Storage)**: create a public bucket named `academy-assets` in the Supabase dashboard, enable public read, then replace the body of `saveUpload()` with a Supabase Storage upload that returns the public URL. The rest of the academy code (logo upload, preview, persistence into `academies.logo_url`) remains unchanged.

### 5. Run the app

```powershell
npm install
npm run dev
```

Visit http://localhost:3000 and follow:

1. Land on the home page → click **Academy** in the role picker.
2. Sign up → log in → land on the onboarding wizard at `/academy/onboarding`.
3. Logo (optional) → first coach → first players (CSV or single) → review → **Go to Dashboard**.
4. The dashboard (`/academy/dashboard`) and nav stubs (Players, Coaches, Fitness, Settings) take over from there.

