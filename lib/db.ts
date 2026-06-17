import dns from "node:dns";
import { Agent, setGlobalDispatcher } from "undici";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// Some ISP resolvers (e.g. Reliance JIO in IN) refuse Neon's c-*.region.aws.neon.tech
// hostnames. Force Node to use public resolvers AND route undici/fetch through a
// custom lookup that uses dns.resolve4 (which honors setServers — getaddrinfo does not).
try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
  const lookup: any = (hostname: string, opts: any, cb: any) => {
    const wantAll = opts && opts.all;
    dns.resolve4(hostname, (err4, addrs4) => {
      dns.resolve6(hostname, (err6, addrs6) => {
        const out: Array<{ address: string; family: number }> = [];
        if (!err4 && addrs4) for (const a of addrs4) out.push({ address: a, family: 4 });
        if (!err6 && addrs6) for (const a of addrs6) out.push({ address: a, family: 6 });
        if (out.length === 0) return cb(err4 || err6 || new Error("DNS lookup failed: " + hostname));
        if (wantAll) return cb(null, out);
        cb(null, out[0].address, out[0].family);
      });
    });
  };
  setGlobalDispatcher(new Agent({ connect: { lookup } }));
} catch {}

let _sql: NeonQueryFunction<false, false> | null = null;

function getSql(): NeonQueryFunction<false, false> {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add it to sportx/.env.local (Neon Postgres connection string).",
    );
  }
  _sql = neon(url);
  return _sql;
}

/* Retry transient network errors. Neon's HTTP endpoint occasionally times out
   from this dev machine (JIO DNS / NAT issues) — without retries every flap
   surfaces as a 500 to the user. We retry only on transport-level failures
   (`fetch failed` / connect timeout), never on real SQL errors. */
const RETRYABLE_CAUSES = new Set([
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
]);

function isRetryable(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const anyErr = err as any;
  /* NeonDbError wraps the network error in `.sourceError.cause.code` */
  const code = anyErr.sourceError?.cause?.code
    ?? anyErr.cause?.code
    ?? anyErr.code;
  if (code && RETRYABLE_CAUSES.has(code)) return true;
  const msg = String(anyErr.message ?? "");
  return /fetch failed|connect timeout|socket hang up/i.test(msg);
}

/* Tuned for very flaky last-mile network (JIO DNS / NAT). Up to 5 attempts,
   backoffs at 250ms / 750ms / 1.5s / 2.5s — total ~5s of grace before we
   give up. Each attempt itself can spend ~10s in the Neon HTTP client
   timeout, so a fully-failing query can take up to ~55s before throwing.
   That's intentional: the page-level fallbacks already handle the throw,
   and surfacing a flapping connection as a 500 is worse than waiting. */
const RETRY_BACKOFFS_MS = [250, 750, 1500, 2500];

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= RETRY_BACKOFFS_MS.length; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (!isRetryable(e)) throw e;
      const wait = RETRY_BACKOFFS_MS[attempt];
      if (wait === undefined) break; // last attempt — throw below
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  /* Re-throw a tighter message so the dev overlay reads cleanly. */
  const msg = (lastErr as any)?.sourceError?.cause?.code === "UND_ERR_CONNECT_TIMEOUT"
    ? "Neon DB connection timed out after retries"
    : (lastErr as any)?.message ?? "Database unavailable";
  const wrapped = new Error(msg);
  (wrapped as any).cause = lastErr;
  throw wrapped;
}

/**
 * NeonDB serverless SQL client (tagged template). Lazy — only fails when
 * actually used, so pages that don't query the DB still render.
 *
 *   const rows = await sql`SELECT * FROM users WHERE email = ${email}`;
 */
export const sql: NeonQueryFunction<false, false> = ((strings: TemplateStringsArray, ...values: unknown[]) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  withRetry(() => (getSql() as any)(strings, ...values))) as NeonQueryFunction<false, false>;

// Forward .query for raw statements (used by scripts/init-db.ts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(sql as any).query = (...args: unknown[]) => (getSql() as any).query(...args);

export type SqlClient = typeof sql;
