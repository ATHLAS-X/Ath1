import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-server";
import { ok } from "@/lib/onboarding-server";

export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (guard instanceof Response) return guard;

  // Optional ?severity= filter that the UI uses (critical/warning/low) — server-side filter.
  const url = new URL(req.url);
  const severityFilter = url.searchParams.get("severity"); // critical | warning | low | all

  const rows = (await sql`
    SELECT
      f.id,
      f.flag_type,
      COALESCE(f.affected_user_id, f.user_id) AS affected_user_id,
      u.name AS affected_name,
      u.email AS affected_email,
      COALESCE(u.role, 'player') AS affected_role,
      u.status AS account_status,
      COALESCE(f.flagged_reason, f.reason) AS flagged_reason,
      f.status,
      f.created_at
    FROM fraud_flags f
    JOIN users u ON u.id = COALESCE(f.affected_user_id, f.user_id)
    WHERE f.status IN ('OPEN', 'UNDER_INVESTIGATION')
    ORDER BY f.created_at ASC
    LIMIT 200
  `) as unknown as any[];

  function severityOf(type: string): "critical" | "warning" | "low" {
    if (type === "DUPLICATE_AADHAAR" || type === "AGE_DISCREPANCY") return "critical";
    if (type === "SELF_VERIFICATION") return "low";
    return "warning";
  }
  const enriched = rows.map((r) => ({ ...r, severity: severityOf(r.flag_type) }));
  const filtered = severityFilter && severityFilter !== "all"
    ? enriched.filter((r) => r.severity === severityFilter)
    : enriched;
  return ok({ flags: filtered });
}
