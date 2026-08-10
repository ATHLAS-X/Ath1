import dns from "node:dns";
import { Agent, setGlobalDispatcher } from "undici";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// Some ISP resolvers (e.g. Reliance JIO in IN) refuse Neon's c-*.region.aws.neon.tech
// hostnames over the OS's default resolver. The original fix forced every lookup
// through public DNS-over-UDP servers (8.8.8.8 etc.) via dns.resolve4/6 (which honor
// setServers — getaddrinfo/dns.lookup do not). That's a single point of failure on
// any network that itself blocks outbound UDP:53 to those servers (confirmed: on at
// least one dev network, `nslookup ep-*.neon.tech 8.8.8.8` and even `ping 8.8.8.8`
// both time out, while the OS's own resolver — same one curl/the browser use —
// resolves and connects to the exact same host in under a second). Forcing the
// public-DNS path on a network like that turned a non-issue into every single DB
// call failing the same way every time, not flaking — confirmed by 10+ consecutive
// identical timeouts that didn't change. Fixed by racing both resolvers and taking
// whichever answers first, instead of trusting one exclusively.
try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
  const PUBLIC_DNS_TIMEOUT_MS = 1500;

  function viaPublicDns(hostname: string): Promise<{ address: string; family: number }[]> {
    return new Promise((resolve, reject) => {
      dns.resolve4(hostname, (err4, addrs4) => {
        dns.resolve6(hostname, (err6, addrs6) => {
          const out: Array<{ address: string; family: number }> = [];
          if (!err4 && addrs4) for (const a of addrs4) out.push({ address: a, family: 4 });
          if (!err6 && addrs6) for (const a of addrs6) out.push({ address: a, family: 6 });
          if (out.length === 0) return reject(err4 || err6 || new Error("public DNS: no records"));
          resolve(out);
        });
      });
    });
  }

  function viaOsResolver(hostname: string): Promise<{ address: string; family: number }[]> {
    return new Promise((resolve, reject) => {
      dns.lookup(hostname, { all: true, verbatim: true }, (err, addrs) => {
        if (err || !addrs?.length) return reject(err ?? new Error("OS resolver: no records"));
        resolve(addrs.map((a) => ({ address: a.address, family: a.family })));
      });
    });
  }

  function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("timed out")), ms);
      p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
    });
  }

  const lookup: any = (hostname: string, opts: any, cb: any) => {
    const wantAll = opts && opts.all;
    /* Try the OS resolver and the forced-public-DNS path concurrently —
       whichever actually works on this network wins. Neither blocks the
       other, and a 1.5s cap on the public-DNS leg means a network that
       silently drops UDP:53 to 8.8.8.8 no longer holds up every request. */
    Promise.any([viaOsResolver(hostname), withTimeout(viaPublicDns(hostname), PUBLIC_DNS_TIMEOUT_MS)])
      .then((out) => {
        if (wantAll) return cb(null, out);
        cb(null, out[0].address, out[0].family);
      })
      .catch(() => cb(new Error("DNS lookup failed via both OS and public resolvers: " + hostname)));
  };
  /* connect.timeout bounds a single TCP/TLS connect attempt — undici's
     default is ~10s, which is what made a fully-failing query take up to
     ~55s (5 attempts × up to 10s + backoff sleeps). 3s is still generous for
     a real connect, and means a dead attempt fails fast enough that the
     retry ladder below actually feels like "retrying", not "hanging". */
  setGlobalDispatcher(new Agent({ connect: { lookup, timeout: 3000 } }));
} catch {}

let _sql: NeonQueryFunction<false, false> | null = null;

function getSql(): NeonQueryFunction<false, false> {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add it to athlasx/.env.local (Neon Postgres connection string).",
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

/* Tuned for very flaky last-mile network (JIO DNS / NAT), but capped so a
   fully-failing query can't drag a user-facing action like login out for
   a minute. Up to 3 attempts total, backoffs at 200ms / 500ms. Combined
   with the 3s connect timeout above, a fully-dead connection now throws in
   well under 10s instead of up to ~55s — still enough grace to ride out a
   single dropped packet, not enough to make "slow" indistinguishable from
   "hung" to the person waiting on it. */
const RETRY_BACKOFFS_MS = [200, 500];

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
