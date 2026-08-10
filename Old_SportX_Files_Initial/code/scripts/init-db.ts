/**
 * Runs lib/schema.sql against the configured NeonDB instance.
 * Usage: npm run db:init
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import dns from "node:dns";
import { Agent, setGlobalDispatcher } from "undici";
import { Pool } from "@neondatabase/serverless";

// Bypass ISP DNS (which refuses *.neon.tech here) by routing undici/fetch
// through Google + Cloudflare resolvers via dns.resolve4/6.
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
} catch { /* ignore */ }

// Manually load .env.local since tsx doesn't auto-load it.
const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  const envText = readFileSync(envPath, "utf8");
  for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Add it to .env.local.");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
const schema = readFileSync(join(process.cwd(), "lib", "schema.sql"), "utf8");

const statements = schema
  .split(/;\s*\n/)
  .map((s) => s.trim())
  .filter(Boolean);

(async () => {
  for (const stmt of statements) {
    console.log("Executing:", stmt.split("\n")[0]);
    await pool.query(stmt);
  }
  await pool.end();
  console.log("✅ Schema applied.");
})().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
