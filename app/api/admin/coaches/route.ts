import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-server";
import { ok } from "@/lib/onboarding-server";

/**
 * One row per coach (grouped by coach_name + academy + cert_url) with the
 * count of pending players who invited that coach and an array of their names.
 */
export async function GET() {
  const guard = await requireAdmin();
  if (guard instanceof Response) return guard;

  const rows = (await sql`
    SELECT
      MIN(cr.id::text)                     AS id,
      cr.coach_name,
      cr.academy_club,
      cr.official_id,
      cr.cert_url,
      COUNT(*)::int                        AS player_count_waiting,
      MIN(cr.created_at)                   AS created_at,
      ARRAY_AGG(u.name ORDER BY cr.created_at) AS inviting_player_names,
      ARRAY_AGG(u.id::text ORDER BY cr.created_at) AS inviting_player_ids,
      ARRAY_AGG(COALESCE(pp.city, ''))      AS inviting_player_cities,
      MIN(ci.coach_email)                   AS coach_email
    FROM coach_registry cr
    JOIN users u ON u.id = cr.user_id
    LEFT JOIN player_profiles pp ON pp.user_id = u.id
    LEFT JOIN coach_invites ci ON ci.id = cr.invite_id
    WHERE cr.coach_status = 'PENDING_REVIEW'
    GROUP BY cr.coach_name, cr.academy_club, cr.official_id, cr.cert_url
    ORDER BY MIN(cr.created_at) ASC
    LIMIT 200
  `) as unknown as any[];
  return ok({ coaches: rows });
}
