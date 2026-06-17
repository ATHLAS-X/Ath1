import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-server";
import { ok } from "@/lib/onboarding-server";

export async function GET() {
  const guard = await requireAdmin();
  if (guard instanceof Response) return guard;

  const rows = (await sql`
    SELECT
      (SELECT COUNT(*) FROM users WHERE COALESCE(role,'player') = 'player')::int  AS total_players,
      (SELECT COUNT(*) FROM sportx_score WHERE coach_verified = true)::int        AS verified_players,
      (SELECT COUNT(*) FROM users WHERE role = 'scout')::int                      AS active_scouts,
      (SELECT COUNT(*) FROM match_logs WHERE ocr_status = 'PENDING')::int          AS pending_scorecards,
      (SELECT COUNT(*) FROM coach_registry WHERE coach_status = 'PENDING_REVIEW')::int AS pending_coaches,
      (SELECT COUNT(*) FROM fraud_flags WHERE status = 'OPEN')::int                AS open_flags
  `) as unknown as Array<{
    total_players: number; verified_players: number; active_scouts: number;
    pending_scorecards: number; pending_coaches: number; open_flags: number;
  }>;
  const r = rows[0] ?? {
    total_players: 0, verified_players: 0, active_scouts: 0,
    pending_scorecards: 0, pending_coaches: 0, open_flags: 0,
  };
  return ok({
    ...r,
    total_pending: r.pending_scorecards + r.pending_coaches + r.open_flags,
  });
}
