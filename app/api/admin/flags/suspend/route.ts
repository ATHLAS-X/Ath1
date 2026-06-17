import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-server";
import { ok, fail } from "@/lib/onboarding-server";

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (guard instanceof Response) return guard;

  let body: any;
  try { body = await req.json(); } catch { return fail("Invalid JSON"); }
  const flagId = String(body?.flag_id ?? "").trim();
  const userId = String(body?.user_id ?? "").trim();
  if (!flagId || !userId) return fail("flag_id and user_id are required");

  // 1: Suspend the account.
  await sql`UPDATE users SET status = 'SUSPENDED' WHERE id = ${userId}`;
  // 2: Mark flag RESOLVED.
  await sql`
    UPDATE fraud_flags
    SET status = 'RESOLVED', resolved_at = NOW(), resolved_by = ${guard.userId}
    WHERE id = ${flagId}
  `;
  // 3: Remove from scout search index.
  await sql`
    UPDATE sportx_score
    SET elasticsearch_indexed = false, status = 'SUSPENDED'
    WHERE user_id = ${userId}
  `;
  // 4: Notify the affected user.
  const msg = "Your SportX account has been suspended pending review. Contact support@sportx.in if you believe this is an error.";
  await sql`
    INSERT INTO admin_notifications (recipient_user_id, type, message)
    VALUES (${userId}, 'ACCOUNT_SUSPENDED', ${msg})
  `;
  await sql`
    INSERT INTO player_notifications (user_id, kind, title, body)
    VALUES (${userId}, 'ACCOUNT_SUSPENDED', 'Account suspended', ${msg})
  `;
  return ok({ success: true });
}
