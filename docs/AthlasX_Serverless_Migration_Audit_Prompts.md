# AthlasX — Serverless (Vercel) Migration Audit Prompts

Deployment target is now confirmed as Vercel. Investigate before fixing —
this is a bigger question than the one OTP fix already found.

## SERV-1 — Audit all in-memory state for serverless compatibility

```
Production is now confirmed as Vercel (serverless) — each request may run
on a separate function instance with no shared memory, the same class of
problem that broke Association OTP in dev mode, but now relevant to real
production traffic, not just dev-mode recompilation.

Grep and audit the entire codebase (lib/, app/api/) for module-level
mutable state — Map, Set, plain object caches, or any variable meant to
persist across requests. Specifically check:

1. rate-limit.ts (or wherever rateLimit() lives) — used across login
   (email + IP buckets), signup, player-onboard-signup, and every
   coach/scout onboarding OTP-verify limit built this session. If this is
   in-memory, all of these are currently non-functional under real
   multi-instance serverless traffic — report this as the top-priority
   finding if confirmed, since it's a bigger gap than the OTP issue it
   was structurally similar to.
2. Every dev-mode OTP stub (coach, academy, scout onboarding) — confirm
   whether the server-side "verified" state (not just the client-shown
   code) also relies on in-memory storage.
3. Anything else module-level and mutable the grep turns up.

Report every instance found: what it is, whether it's actually reachable
in production (a dev-only code path gated by NODE_ENV doesn't count),
and how severe the impact is if it silently doesn't work. Do NOT fix
anything in this pass — report first.
```

## SERV-2 — Scope the fix (only after SERV-1's report)

```
For anything SERV-1 confirms needs a serverless-safe shared store,
propose using Vercel KV (Upstash Redis under the hood) for short-TTL
ephemeral state like rate-limit counters and OTP codes — the standard
pattern for exactly this problem on Vercel, and lighter than a DB table
with migrations for data meant to expire in minutes anyway.

This adds a new infrastructure dependency needing provisioning — same
category as the MFA encryption key and the DB password: tell me what
needs to be created/connected, don't set it up silently.

Do not touch the already-DB-backed migrations (password reset tokens,
MFA fields) — those are correctly persistent already and unaffected by
this. This is specifically for whatever ephemeral in-memory state SERV-1
finds.
```

Note: this session now has live Vercel MCP tools available. I haven't
used them — I don't know if there's already a real Vercel project linked
for AthlasX, and I'm not going to poke at an account without you asking.
If you want me to check the actual project config directly instead of
just auditing the code, say so and I'll look.
