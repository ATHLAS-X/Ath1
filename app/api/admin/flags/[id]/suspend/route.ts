import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-server";
import { ok, fail } from "@/lib/onboarding-server";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (guard instanceof Response) return guard;

  const rows = (await sql`
    SELECT user_id FROM fraud_flags WHERE id = ${params.id} LIMIT 1
  `) as unknown as Array<{ user_id: string }>;
  const flag = rows[0];
  if (!flag) return fail("Flag not found", 404);

  await sql`UPDATE users SET status = 'SUSPENDED' WHERE id = ${flag.user_id}`;
  await sql`
    UPDATE sportx_score SET elasticsearch_indexed = false, status = 'SUSPENDED'
    WHERE user_id = ${flag.user_id}
  `;
  await sql`
    UPDATE fraud_flags
    SET status = 'ACTIONED', resolved_at = NOW(), resolved_by = ${guard.userId}
    WHERE id = ${params.id}
  `;
  await sql`
    INSERT INTO player_notifications (user_id, kind, title, body)
    VALUES (${flag.user_id}, 'ACCOUNT_SUSPENDED', 'Account suspended',
            'Your SportX account has been suspended pending review. Contact support to appeal.')
  `;
  return ok({ suspended: true });
}
