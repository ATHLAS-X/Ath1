/**
 * Promote a user to admin.
 *
 * Usage:
 *   npx tsx scripts/make-admin.ts <email>
 *
 * The script reads DATABASE_URL from .env.local (same convention as init-db).
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import dns from "node:dns";
import { Agent, setGlobalDispatcher } from "undici";
import { Pool } from "@neondatabase/serverless";

// Same DNS workaround used by init-db.ts for ISPs that refuse Neon resolution.
try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
  const lookup: any = (hostname: string, opts: any, cb: any) => {
    const wantAll = opts && opts.all;
    dns.resolve4(hostname, (err4, addrs4) => {
      dns.resolve6(hostname, (err6, addrs6) => {
        const out: Array<{ address: string; family: number }> = [];
        if (!err4 && addrs4) for (const a of addrs4) out.push({ address: a, family: 4 });
        if (!err6 && addrs6) for (const a of addrs6) out.push({ address: a, family: 6 });
        if (out.length === 0) return cb(err4 || err6 || new Error("DNS lookup failed"));
        if (wantAll) return cb(null, out);
        cb(null, out[0].address, out[0].family);
      });
    });
  };
  setGlobalDispatcher(new Agent({ connect: { lookup } }));
} catch { /* noop */ }

// Load .env.local manually (tsx doesn't auto-load it).
const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
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

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: npx tsx scripts/make-admin.ts <email>");
  process.exit(1);
}

(async () => {
  const pool = new Pool({ connectionString: url });
  try {
    const res = await pool.query(
      `UPDATE users SET role = 'admin' WHERE LOWER(email) = $1 RETURNING id, name, email, role`,
      [email],
    );
    if (res.rowCount === 0) {
      console.error(`❌ No user found with email "${email}".`);
      process.exit(1);
    }
    const u = res.rows[0];
    console.log(`✅ ${u.name} <${u.email}> promoted to admin.`);
  } finally {
    await pool.end();
  }
})().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
