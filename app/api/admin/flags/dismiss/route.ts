import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-server";
import { ok, fail } from "@/lib/onboarding-server";

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (guard instanceof Response) return guard;

  let body: any;
  try { body = await req.json(); } catch { return fail("Invalid JSON"); }
  const flagId = String(body?.flag_id ?? "").trim();
  const note = String(body?.note ?? "").slice(0, 500);
  if (!flagId) return fail("flag_id is required");

  await sql`
    UPDATE fraud_flags
    SET status = 'DISMISSED',
        resolved_at = NOW(),
        resolved_by = ${guard.userId},
        flagged_reason = COALESCE(${note ? `${note}\n---\n` : ''} || COALESCE(flagged_reason, ''), flagged_reason)
    WHERE id = ${flagId}
  `;
  return ok({ success: true });
}
