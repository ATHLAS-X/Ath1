import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-server";
import { ok, fail } from "@/lib/onboarding-server";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (guard instanceof Response) return guard;

  const rows = (await sql`
    UPDATE fraud_flags
    SET status = 'DISMISSED', resolved_at = NOW(), resolved_by = ${guard.userId}
    WHERE id = ${params.id}
    RETURNING user_id
  `) as unknown as Array<{ user_id: string }>;
  const flag = rows[0];
  if (!flag) return fail("Flag not found", 404);

  // Restore account to ACTIVE if no other open flags.
  await sql`
    UPDATE users SET status = 'ACTIVE'
    WHERE id = ${flag.user_id}
      AND NOT EXISTS (SELECT 1 FROM fraud_flags WHERE user_id = ${flag.user_id} AND status = 'OPEN')
  `;
  return ok({ dismissed: true });
}
