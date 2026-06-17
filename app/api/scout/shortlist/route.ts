import { sql } from "@/lib/db";
import { fail, ok, requireUserId } from "@/lib/onboarding-server";

export async function POST(req: Request) {
  const guard = await requireUserId();
  if (guard instanceof Response) return guard;
  let body: any;
  try { body = await req.json(); } catch { return fail("Invalid JSON"); }
  const playerId = String(body?.player_user_id ?? "").trim();
  if (!playerId) return fail("player_user_id is required");
  if (playerId === guard.userId) return fail("Cannot shortlist yourself");

  await sql`
    INSERT INTO scout_shortlist (scout_user_id, player_user_id, notes)
    VALUES (${guard.userId}, ${playerId}, ${String(body?.notes ?? "")})
    ON CONFLICT (scout_user_id, player_user_id) DO NOTHING
  `;
  return ok({ shortlisted: true });
}

export async function DELETE(req: Request) {
  const guard = await requireUserId();
  if (guard instanceof Response) return guard;
  let body: any;
  try { body = await req.json(); } catch { return fail("Invalid JSON"); }
  const playerId = String(body?.player_user_id ?? "").trim();
  if (!playerId) return fail("player_user_id is required");

  await sql`
    DELETE FROM scout_shortlist
    WHERE scout_user_id = ${guard.userId} AND player_user_id = ${playerId}
  `;
  return ok({ shortlisted: false });
}
