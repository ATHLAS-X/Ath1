#!/usr/bin/env node
/**
 * End-to-end smoke test against a running local stack (`npm run dev`).
 *
 * No Playwright dependency exists in package.json, so this uses plain
 * Node fetch with a hand-rolled cookie jar for the NextAuth session.
 *
 * Usage: SMOKE_BASE_URL=http://localhost:3000 node scripts/smoke-e2e.mjs
 *
 * Safe to rerun against a persistent (non-throwaway) database: the test
 * email is timestamp+random-suffixed per run (never collides, so no false
 * "account already exists" 409), AND it also deletes the created test user
 * row at the end via @neondatabase/serverless (same pattern as
 * scripts/e2e-test.ts) — belt and suspenders, since the unique-email
 * approach alone would otherwise leave one throwaway row per run forever.
 * Cleanup needs DATABASE_URL set in the environment; it's best-effort and
 * never affects the pass/fail exit code.
 *
 * Exit code is non-zero if any check fails — CI-able.
 */
import { Pool } from "@neondatabase/serverless";

const BASE_URL = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const AI_BASE_URL = process.env.SMOKE_AI_BASE_URL ?? null; // Backend/AI, only used if set

const results = [];

function record(name, status, detail = "") {
  results.push({ name, status, detail });
  const icon = status === "pass" ? "\x1b[32mPASS\x1b[0m" : status === "skip" ? "\x1b[33mSKIP\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
  console.log(`  ${icon}  ${name}${detail ? `  — ${detail}` : ""}`);
}

async function check(name, fn) {
  try {
    await fn();
    record(name, "pass");
  } catch (e) {
    record(name, "fail", e.message ?? String(e));
  }
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

/* ── Minimal cookie jar — NextAuth needs the csrf cookie round-tripped, then
   the session cookie forwarded on every authenticated request. */
class CookieJar {
  constructor() {
    this.cookies = new Map();
  }
  absorb(res) {
    const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const raw of setCookie) {
      const [pair] = raw.split(";");
      const idx = pair.indexOf("=");
      if (idx === -1) continue;
      const name = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      this.cookies.set(name, value);
    }
  }
  header() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

async function req(path, { method = "GET", body, jar, json = true, redirect = "follow" } = {}) {
  const headers = {};
  if (json && body !== undefined) headers["Content-Type"] = "application/json";
  if (jar && jar.header()) headers["Cookie"] = jar.header();
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? (json ? JSON.stringify(body) : body) : undefined,
    redirect,
  });
  if (jar) jar.absorb(res);
  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { res, data, status: res.status };
}

/* ── Test identity — unique per run so repeat runs don't collide on the
   signup route's unique-email constraint. */
const RUN_ID = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const TEST_EMAIL = `smoke-${RUN_ID}@athlasx-smoke.test`;
const TEST_PASSWORD = "Smoke-Test-Pass-1234!";
const TEST_NAME = `Smoke Test ${RUN_ID}`;
const TEST_AADHAAR = "234567890123"; // 12 digits — initiate route has no checksum validation

const jar = new CookieJar();

console.log(`\nAthlasX E2E smoke test — target ${BASE_URL}\n`);

// ── 1. Signup + login ─────────────────────────────────────────────────────────
console.log("1. Signup + NextAuth login\n");

await check("POST /api/auth/signup creates a player account (201)", async () => {
  const { res, data } = await req("/api/auth/signup", {
    method: "POST",
    body: { name: TEST_NAME, email: TEST_EMAIL, password: TEST_PASSWORD, role: "player" },
  });
  assert(res.status === 201, `expected 201, got ${res.status}: ${JSON.stringify(data)}`);
  assert(data?.success === true, "response missing success:true");
  assert(data?.data?.user?.email === TEST_EMAIL, "response missing the created user's email");
});

let csrfToken = null;
await check("GET /api/auth/csrf returns a token", async () => {
  const { res, data } = await req("/api/auth/csrf", { jar });
  assert(res.status === 200, `expected 200, got ${res.status}`);
  assert(typeof data?.csrfToken === "string" && data.csrfToken.length > 0, "no csrfToken in response");
  csrfToken = data.csrfToken;
});

await check("POST /api/auth/callback/credentials logs in and sets a session cookie", async () => {
  const params = new URLSearchParams({
    csrfToken: csrfToken ?? "",
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    json: "true",
  });
  const { res } = await req("/api/auth/callback/credentials", {
    method: "POST",
    body: params.toString(),
    json: false,
    jar,
    redirect: "manual",
  });
  assert([200, 302].includes(res.status), `expected 200/302 from credentials callback, got ${res.status}`);
  const hasSessionCookie = [...jar.cookies.keys()].some((k) => k.includes("next-auth.session-token"));
  assert(hasSessionCookie, "no next-auth.session-token cookie was set after login");
});

await check("GET /api/auth/session confirms the logged-in session cookie", async () => {
  const { res, data } = await req("/api/auth/session", { jar });
  assert(res.status === 200, `expected 200, got ${res.status}`);
  assert(data?.user?.email === TEST_EMAIL, `session user mismatch: ${JSON.stringify(data)}`);
});

// ── 2. Onboarding walk ────────────────────────────────────────────────────────
console.log("\n2. Onboarding flow (role -> cricket-profile -> fitness -> behaviour -> video -> aadhaar/initiate)\n");

await check("POST /api/onboarding/role accepts a valid role and advances onboarding", async () => {
  const { res, data } = await req("/api/onboarding/role", {
    method: "POST",
    jar,
    body: {
      player_role: "Batsman",
      batting_style: "Right",
      bowling_style: "Does Not Bowl",
      phase_specialty: ["Middle-Order Anchor"],
    },
  });
  assert(res.status === 200, `expected 200, got ${res.status}: ${JSON.stringify(data)}`);
  assert(data?.success === true, "missing success:true");
  assert(data?.data?.player_role === "Batsman", "player_role not echoed back correctly");
  assert(data?.data?.score_weights && typeof data.data.score_weights === "object", "score_weights missing");
});

await check("GET /api/onboarding/cricket-profile reflects the role just saved", async () => {
  const { res, data } = await req("/api/onboarding/cricket-profile", { jar });
  assert(res.status === 200, `expected 200, got ${res.status}`);
  assert(data?.data?.player_role === "Batsman", `expected player_role Batsman, got ${JSON.stringify(data)}`);
});

await check("POST /api/onboarding/fitness (JSON body) accepts metrics and advances onboarding", async () => {
  const { res, data } = await req("/api/onboarding/fitness", {
    method: "POST",
    jar,
    body: {
      sprint_time: 4.6,
      pushups_60s: 35,
      resting_hr_bpm: 58,
      yoyo_level: 17.2,
      run_2km_seconds: 540,
      height_cm: 178,
      weight_kg: 72,
    },
  });
  assert(res.status === 200, `expected 200, got ${res.status}: ${JSON.stringify(data)}`);
  assert(data?.success === true, "missing success:true");
  assert(typeof data?.data?.fitness_score === "number", "fitness_score missing or not a number");
  assert(data?.data?.onboarding != null, "onboarding state missing from response");
});

await check("POST /api/onboarding/behaviour accepts MCQ + free text and advances onboarding", async () => {
  const mcq_answers = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`q${i + 1}`, "B"]));
  const free_text =
    "I try to stay calm under pressure and focus on my breathing between deliveries. " +
    "When things go wrong I try to reset quickly and think about the next ball instead of the last one. " +
    "I want to keep improving my consistency and mental discipline across a full innings.";
  const { res, data } = await req("/api/onboarding/behaviour", {
    method: "POST",
    jar,
    body: { mcq_answers, free_text },
  });
  assert(res.status === 200, `expected 200, got ${res.status}: ${JSON.stringify(data)}`);
  assert(data?.success === true, "missing success:true");
  assert(Array.isArray(data?.data?.strengths), "strengths missing or not an array");
  assert(typeof data?.data?.mental_rating === "number", "mental_rating missing or not a number");
});

await check("POST /api/onboarding/video accepts a YouTube URL and returns a (preliminary) analysis", async () => {
  const { res, data } = await req("/api/onboarding/video", {
    method: "POST",
    jar,
    body: { video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  });
  assert(res.status === 200, `expected 200, got ${res.status}: ${JSON.stringify(data)}`);
  assert(data?.success === true, "missing success:true");
  assert(data?.data?.youtube_video_id === "dQw4w9WgXcQ", "youtube_video_id not echoed back correctly");
  assert(typeof data?.data?.preliminary === "boolean", "preliminary flag missing — see app/api/onboarding/video/route.ts");
});

await check("POST /api/onboarding/aadhaar/initiate accepts a 12-digit number and issues an OTP", async () => {
  const { res, data } = await req("/api/onboarding/aadhaar/initiate", {
    method: "POST",
    jar,
    body: { aadhaar: TEST_AADHAAR },
  });
  assert(res.status === 200, `expected 200, got ${res.status}: ${JSON.stringify(data)}`);
  assert(data?.success === true, "missing success:true");
  assert(typeof data?.data?.message === "string", "missing confirmation message");
});

// ── 3. Access-control regression guard ───────────────────────────────────────
console.log("\n3. Access-control regression guard (no session -> must NOT be 200)\n");

const anonJar = new CookieJar(); // deliberately empty — no session

await check("GET /api/scout/players with no session -> 401 (requireActiveScout)", async () => {
  const { res, data } = await req("/api/scout/players", { jar: anonJar });
  assert(res.status === 401, `expected 401, got ${res.status}: ${JSON.stringify(data)}`);
});

await check("GET /api/scout/top-week with no session -> 401 (requireActiveScout)", async () => {
  const { res, data } = await req("/api/scout/top-week", { jar: anonJar });
  assert(res.status === 401, `expected 401, got ${res.status}: ${JSON.stringify(data)}`);
});

await check("GET /api/player/stats/[userId] with no session -> 401", async () => {
  // As of the fix in app/api/player/stats/[userId]/route.ts: no session at
  // all -> 401, checked before any DB query. A session that exists but isn't
  // authorized to view this specific profile -> 404 (don't leak existence) —
  // not exercised by this anonymous case, but is the other valid outcome of
  // canViewPlayerProfile(). The regression this guards against is "200 with
  // real data to an anonymous caller" — never acceptable.
  const { res, data } = await req(`/api/player/stats/${encodeURIComponent(TEST_EMAIL)}`, { jar: anonJar });
  assert(res.status !== 200, `REGRESSION: expected non-200, got 200 with data: ${JSON.stringify(data)}`);
  assert(res.status === 401, `expected 401 for no session, got ${res.status}: ${JSON.stringify(data)}`);
});

// ── 4. Backend/AI integration (only if wired up) ─────────────────────────────
console.log("\n4. Backend/AI compute integration\n");

if (!AI_BASE_URL && !process.env.AI_BACKEND_URL) {
  record(
    "Backend/AI video-analysis integration",
    "skip",
    "lib/compute-client.ts does not exist in this codebase — Master 8 step 4 was explicitly skipped in favor of option (a) (honest 'preliminary' copy on the Gemini-fallback stub). Set SMOKE_AI_BASE_URL to re-enable this section once that integration is built.",
  );
} else {
  const aiBase = AI_BASE_URL ?? process.env.AI_BACKEND_URL;
  await check("Backend/AI GET /api/v1/compute/health reports DB+Redis+Gemini healthy", async () => {
    const res = await fetch(`${aiBase}/api/v1/compute/health`);
    const data = await res.json().catch(() => null);
    assert(res.status === 200, `expected 200, got ${res.status}`);
    assert(data?.database === "healthy", `database not healthy: ${JSON.stringify(data)}`);
    assert(data?.redis === "healthy", `redis not healthy: ${JSON.stringify(data)}`);
    assert(data?.gemini === "healthy", `gemini not healthy: ${JSON.stringify(data)}`);
  });
  record("Submit + poll a real video analysis through the Next.js proxy", "skip", "no lib/compute-client.ts proxy route exists yet to submit through");
}

// ── Cleanup ───────────────────────────────────────────────────────────────────
// Best-effort: delete the test user row (and everything FK-cascaded off it —
// player_profiles, cricket_profile, fitness_data, behavioral_assessment,
// video_analysis, aadhaar_otps, etc. all reference users(id) ON DELETE CASCADE
// per lib/schema.sql) so reruns against a persistent DB don't accumulate
// throwaway rows forever. Never affects the exit code.
console.log("\nCleanup\n");
if (!process.env.DATABASE_URL) {
  console.log("  SKIP  no DATABASE_URL set — leaving test row in place (if it was created)");
} else {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await pool.query("DELETE FROM users WHERE email = $1", [TEST_EMAIL]);
    console.log(`  OK    deleted ${result.rowCount ?? 0} row(s) for ${TEST_EMAIL}`);
  } catch (e) {
    console.log(`  WARN  cleanup failed (non-fatal): ${e.message ?? e}`);
  } finally {
    await pool.end().catch(() => {});
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log("\n" + "─".repeat(70));
console.log("SUMMARY\n");
const pad = (s, n) => s + " ".repeat(Math.max(0, n - s.length));
for (const r of results) {
  const icon = r.status === "pass" ? "PASS" : r.status === "skip" ? "SKIP" : "FAIL";
  console.log(`  ${pad(icon, 6)}${pad(r.name, 78)}${r.detail}`);
}
const failed = results.filter((r) => r.status === "fail");
const passed = results.filter((r) => r.status === "pass");
const skipped = results.filter((r) => r.status === "skip");
console.log("─".repeat(70));
console.log(`${passed.length} passed, ${failed.length} failed, ${skipped.length} skipped\n`);

process.exit(failed.length > 0 ? 1 : 0);
