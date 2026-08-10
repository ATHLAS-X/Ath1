import { sql } from "@/lib/db";
import { fail, ok, requireUserId } from "@/lib/onboarding-server";

/* Player-initiated request for scout endorsement (Level 4).
   Recorded as a SCOUT-type row in `verifications` so it shows up in the
   admin / scout review surfaces alongside other verification types. */

export async function POST(req: Request) {
  const guard = await requireUserId();
  if (guard instanceof Response) return guard;

  let body: any;
  try { body = await req.json(); } catch { return fail("Invalid JSON"); }
  const note = String(body?.note ?? "").trim();
  const preferredScoutId = body?.preferred_scout_id ? String(body.preferred_scout_id) : null;

  /* One open request per player at a time — re-submitting replaces the pending row. */
  await sql`
    DELETE FROM verifications
    WHERE player_user_id = ${guard.userId} AND verification_type = 'SCOUT' AND status = 'Pending'
  `;
  const rows = (await sql`
    INSERT INTO verifications
      (player_user_id, verification_type, status, evidence_metadata, submitted_by_user_id)
    VALUES
      (${guard.userId}, 'SCOUT', 'Pending',
       ${JSON.stringify({ note, preferred_scout_id: preferredScoutId })}::jsonb,
       ${guard.userId})
    RETURNING id, created_at
  `) as any[];
  return ok({ id: rows[0]?.id, submitted_at: rows[0]?.created_at });
}

export async function GET() {
  const guard = await requireUserId();
  if (guard instanceof Response) return guard;
  const rows = (await sql`
    SELECT id, status, evidence_metadata, created_at, reviewed_at, rejection_reason
    FROM verifications
    WHERE player_user_id = ${guard.userId} AND verification_type = 'SCOUT'
    ORDER BY created_at DESC LIMIT 5
  `) as any[];
  return ok({ requests: rows });
}
