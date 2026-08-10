import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-server";
import { ok } from "@/lib/onboarding-server";

export async function GET() {
  const guard = await requireAdmin();
  if (guard instanceof Response) return guard;
  const rows = (await sql`
    SELECT
      m.id, m.opponent, m.match_date, m.format, m.mqi_tag, m.mqi_weight,
      m.scorecard_url, m.ocr_confidence, m.ocr_status,
      m.runs_scored, m.wickets_taken, m.created_at,
      u.id AS player_id, u.name AS player_name,
      pp.city AS player_city, pp.state AS player_state, pp.avatar_url
    FROM match_logs m
    JOIN users u ON u.id = m.user_id
    LEFT JOIN player_profiles pp ON pp.user_id = u.id
    WHERE m.ocr_status IN ('PENDING', 'MANUAL_REVIEW') OR m.ocr_status IS NULL
    ORDER BY m.created_at ASC
    LIMIT 200
  `) as unknown as any[];
  return ok({ scorecards: rows });
}
