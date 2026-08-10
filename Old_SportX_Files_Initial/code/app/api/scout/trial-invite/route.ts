import { sql } from "@/lib/db";
import { fail, ok, requireUserId } from "@/lib/onboarding-server";

export async function POST(req: Request) {
  const guard = await requireUserId();
  if (guard instanceof Response) return guard;
  let body: any;
  try { body = await req.json(); } catch { return fail("Invalid JSON"); }
  const playerId = String(body?.player_user_id ?? "").trim();
  if (!playerId) return fail("player_user_id is required");
  if (playerId === guard.userId) return fail("Cannot invite yourself");

  await sql`
    INSERT INTO scout_trial_invites (scout_user_id, player_user_id, message, status)
    VALUES (${guard.userId}, ${playerId}, ${String(body?.message ?? "")}, 'SENT')
  `;
  return ok({ invited: true });
}
