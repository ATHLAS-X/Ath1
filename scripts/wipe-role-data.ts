/**
 * Wipe every row of data belonging to users with role player, coach,
 * academy_admin, or scout. Leaves parent, tournament_organizer, and every
 * admin-role variant (see sportx-db-gotchas: 'admin' / 'athlasx_admin' /
 * legacy 'sportx_admin') completely untouched.
 *
 * This is a DATA WIPE, not a schema change — no table is dropped, altered,
 * or renamed. Everything below relies on lib/schema.sql's existing FK
 * cascades; the only manual cleanup needed is for the 4 FK columns that
 * have NO ON DELETE clause (would throw on delete) and the one SET NULL
 * column (academies.user_id) that needs its row removed outright rather
 * than just nulled, since academy data has no other owner once the
 * academy_admin account is gone.
 *
 * Usage:
 *   npx tsx scripts/wipe-role-data.ts            (dry run — default)
 *   npx tsx scripts/wipe-role-data.ts --confirm   (actually deletes)
 *
 * Same conventions as scripts/make-admin.ts: manual .env.local loader, same
 * DNS workaround for ISP resolvers that refuse Neon, and the real `Pool`
 * client (not lib/db.ts's stateless HTTP `sql`) because BEGIN/COMMIT/
 * ROLLBACK need a single persistent session to mean anything.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import dns from "node:dns";
import { Agent, setGlobalDispatcher } from "undici";
import { Pool } from "@neondatabase/serverless";

// Same DNS workaround used by init-db.ts / make-admin.ts for ISPs that refuse Neon resolution.
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

const CONFIRM = process.argv.includes("--confirm");
const TARGET_ROLES = ["player", "coach", "academy_admin", "scout"];

interface RoleCount { role: string; n: number }

function printRoleCounts(title: string, rows: RoleCount[]) {
  console.log(`\n${title}`);
  if (rows.length === 0) {
    console.log("  (no rows)");
    return;
  }
  for (const r of rows) console.log(`  ${r.role.padEnd(24)} ${r.n}`);
}

async function fullRoleSnapshot(pool: Pool): Promise<RoleCount[]> {
  const res = await pool.query(`SELECT role, COUNT(*)::int AS n FROM users GROUP BY role ORDER BY role`);
  return res.rows as RoleCount[];
}

function diffSnapshots(before: RoleCount[], after: RoleCount[]): string[] {
  const problems: string[] = [];
  const beforeMap = new Map(before.map((r) => [r.role, r.n]));
  const afterMap = new Map(after.map((r) => [r.role, r.n]));
  const allRoles = new Set([...beforeMap.keys(), ...afterMap.keys()]);
  for (const role of allRoles) {
    if (TARGET_ROLES.includes(role)) continue; // expected to change
    const b = beforeMap.get(role) ?? 0;
    const a = afterMap.get(role) ?? 0;
    if (b !== a) problems.push(`role "${role}": ${b} -> ${a} (should be unchanged)`);
  }
  return problems;
}

(async () => {
  const pool = new Pool({ connectionString: url });
  try {
    // ── Step 2: who's targeted ──────────────────────────────────────────
    const targetRes = await pool.query(
      `SELECT id, role FROM users WHERE role = ANY($1::text[])`,
      [TARGET_ROLES],
    );
    const targetIds: string[] = targetRes.rows.map((r) => r.id);
    const countByRole: Record<string, number> = {};
    for (const role of TARGET_ROLES) countByRole[role] = 0;
    for (const r of targetRes.rows) countByRole[r.role] = (countByRole[r.role] ?? 0) + 1;

    console.log(CONFIRM ? "=== WIPE (LIVE — will commit) ===" : "=== WIPE (DRY RUN — nothing will be deleted) ===");
    console.log("\nUsers matching target roles:");
    for (const role of TARGET_ROLES) console.log(`  ${role.padEnd(16)} ${countByRole[role]}`);
    console.log(`  ${"TOTAL".padEnd(16)} ${targetIds.length}`);

    const beforeSnapshot = await fullRoleSnapshot(pool);
    printRoleCounts("Full users.role snapshot (before):", beforeSnapshot);

    if (targetIds.length === 0) {
      console.log("\nNo users match the target roles. Nothing to do — exiting.");
      return;
    }

    // Academies owned by targeted academy_admin users — counted now so the
    // dry run shows it, and reused as the expected-drop number after delete.
    const academiesRes = await pool.query(
      `SELECT COUNT(*)::int AS n FROM academies WHERE user_id = ANY($1::uuid[])`,
      [targetIds],
    );
    const academiesToDelete = academiesRes.rows[0].n as number;
    console.log(`\nacademies rows owned by targeted academy_admin users: ${academiesToDelete}`);

    // Rows the 4 no-ON-DELETE-clause FKs would need nulled first, so the
    // dry run shows the real blast radius before anything is touched.
    const nullPreview = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM match_logs WHERE reviewed_by = ANY($1::uuid[])) AS match_logs_reviewed_by,
         (SELECT COUNT(*)::int FROM coach_registry WHERE reviewed_by = ANY($1::uuid[])) AS coach_registry_reviewed_by,
         (SELECT COUNT(*)::int FROM fraud_flags WHERE resolved_by = ANY($1::uuid[])) AS fraud_flags_resolved_by,
         (SELECT COUNT(*)::int FROM fraud_flags WHERE affected_user_id = ANY($1::uuid[])) AS fraud_flags_affected_user_id
      `,
      [targetIds],
    );
    const np = nullPreview.rows[0];
    console.log("\nRows that will be SET NULL (no ON DELETE clause — would error otherwise):");
    console.log(`  match_logs.reviewed_by           ${np.match_logs_reviewed_by}`);
    console.log(`  coach_registry.reviewed_by       ${np.coach_registry_reviewed_by}`);
    console.log(`  fraud_flags.resolved_by          ${np.fraud_flags_resolved_by}`);
    console.log(`  fraud_flags.affected_user_id     ${np.fraud_flags_affected_user_id}`);

    if (!CONFIRM) {
      console.log("\nDry run only — no transaction opened, nothing deleted.");
      console.log("Re-run with --confirm to actually perform this wipe.");
      return;
    }

    // ── Step 3: the real thing, inside one transaction ──────────────────
    const academiesBeforeTotal = await pool.query(`SELECT COUNT(*)::int AS n FROM academies`);
    const tablesBefore = await pool.query(
      `SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    const columnsBefore = await pool.query(
      `SELECT COUNT(*)::int AS n FROM information_schema.columns WHERE table_schema = 'public'`,
    );

    await pool.query("BEGIN");
    try {
      const r1 = await pool.query(
        `UPDATE match_logs SET reviewed_by = NULL WHERE reviewed_by = ANY($1::uuid[])`,
        [targetIds],
      );
      const r2 = await pool.query(
        `UPDATE coach_registry SET reviewed_by = NULL WHERE reviewed_by = ANY($1::uuid[])`,
        [targetIds],
      );
      const r3 = await pool.query(
        `UPDATE fraud_flags SET resolved_by = NULL WHERE resolved_by = ANY($1::uuid[])`,
        [targetIds],
      );
      const r4 = await pool.query(
        `UPDATE fraud_flags SET affected_user_id = NULL WHERE affected_user_id = ANY($1::uuid[])`,
        [targetIds],
      );

      const academyAdminIds = targetRes.rows.filter((r) => r.role === "academy_admin").map((r) => r.id);
      const academiesDeleted = await pool.query(
        `DELETE FROM academies WHERE user_id = ANY($1::uuid[])`,
        [academyAdminIds],
      );

      const usersDeleted = await pool.query(
        `DELETE FROM users WHERE role = ANY($1::text[])`,
        [TARGET_ROLES],
      );

      // ── confirmations before committing ──
      const afterTargetRes = await pool.query(
        `SELECT COUNT(*)::int AS n FROM users WHERE role = ANY($1::text[])`,
        [TARGET_ROLES],
      );
      const remainingTargets = afterTargetRes.rows[0].n as number;

      const academiesAfterTotal = await pool.query(`SELECT COUNT(*)::int AS n FROM academies`);
      const expectedAcademiesAfter = academiesBeforeTotal.rows[0].n - (academiesDeleted.rowCount ?? 0);
      const academiesMatch = academiesAfterTotal.rows[0].n === expectedAcademiesAfter;

      const afterSnapshot = await fullRoleSnapshot(pool);
      const unexpectedChanges = diffSnapshots(beforeSnapshot, afterSnapshot);

      const tablesAfter = await pool.query(
        `SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'`,
      );
      const columnsAfter = await pool.query(
        `SELECT COUNT(*)::int AS n FROM information_schema.columns WHERE table_schema = 'public'`,
      );
      const schemaUnchanged =
        tablesBefore.rows[0].n === tablesAfter.rows[0].n &&
        columnsBefore.rows[0].n === columnsAfter.rows[0].n;

      if (remainingTargets !== 0 || !academiesMatch || unexpectedChanges.length > 0 || !schemaUnchanged) {
        await pool.query("ROLLBACK");
        console.error("\n❌ Verification failed — ROLLED BACK. Nothing was committed.");
        if (remainingTargets !== 0) console.error(`  ${remainingTargets} target-role users still remain.`);
        if (!academiesMatch) {
          console.error(
            `  academies count mismatch: expected ${expectedAcademiesAfter}, got ${academiesAfterTotal.rows[0].n}.`,
          );
        }
        for (const p of unexpectedChanges) console.error(`  ${p}`);
        if (!schemaUnchanged) {
          console.error(
            `  schema changed: tables ${tablesBefore.rows[0].n}->${tablesAfter.rows[0].n}, ` +
              `columns ${columnsBefore.rows[0].n}->${columnsAfter.rows[0].n}.`,
          );
        }
        process.exit(1);
      }

      await pool.query("COMMIT");

      console.log("\n✅ Committed.\n");
      console.log("Rows deleted by role:");
      for (const role of TARGET_ROLES) console.log(`  ${role.padEnd(16)} ${countByRole[role]}`);
      console.log(`  ${"TOTAL users".padEnd(16)} ${usersDeleted.rowCount}`);
      console.log(`  academies        ${academiesDeleted.rowCount}`);
      console.log("\nFK columns nulled (no ON DELETE clause — would have errored otherwise):");
      console.log(`  match_logs.reviewed_by           ${r1.rowCount}`);
      console.log(`  coach_registry.reviewed_by       ${r2.rowCount}`);
      console.log(`  fraud_flags.resolved_by          ${r3.rowCount}`);
      console.log(`  fraud_flags.affected_user_id     ${r4.rowCount}`);

      printRoleCounts("Full users.role snapshot (after):", afterSnapshot);

      console.log("\nSchema paranoia check:");
      console.log(`  tables  (public schema): ${tablesBefore.rows[0].n} -> ${tablesAfter.rows[0].n}`);
      console.log(`  columns (public schema): ${columnsBefore.rows[0].n} -> ${columnsAfter.rows[0].n}`);
      console.log(schemaUnchanged ? "  ✅ unchanged" : "  ❌ CHANGED — see above, this should never happen");
    } catch (err) {
      await pool.query("ROLLBACK");
      console.error("\n❌ Error during wipe — ROLLED BACK. Nothing was committed.");
      throw err;
    }
  } finally {
    await pool.end();
  }
})().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
