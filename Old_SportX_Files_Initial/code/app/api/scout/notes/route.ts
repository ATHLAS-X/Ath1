import { sql } from "@/lib/db";
import { fail, ok, requireUserId } from "@/lib/onboarding-server";

export async function GET(req: Request) {
  const guard = await requireUserId();
  if (guard instanceof Response) return guard;
  const url = new URL(req.url);
  const playerId = url.searchParams.get("player_user_id");
  if (!playerId) return fail("player_user_id is required");
  const rows = (await sql`
    SELECT body FROM scout_notes
    WHERE scout_user_id = ${guard.userId} AND player_user_id = ${playerId}
    LIMIT 1
  `) as unknown as Array<{ body: string }>;
  return ok({ body: rows[0]?.body ?? "" });
}

export async function POST(req: Request) {
  const guard = await requireUserId();
  if (guard instanceof Response) return guard;
  let body: any;
  try { body = await req.json(); } catch { return fail("Invalid JSON"); }
  const playerId = String(body?.player_user_id ?? "").trim();
  const note = String(body?.body ?? "");
  if (!playerId) return fail("player_user_id is required");
  await sql`
    INSERT INTO scout_notes (scout_user_id, player_user_id, body, updated_at)
    VALUES (${guard.userId}, ${playerId}, ${note}, NOW())
    ON CONFLICT (scout_user_id, player_user_id) DO UPDATE SET
      body = EXCLUDED.body,
      updated_at = NOW()
  `;
  return ok({ saved: true });
}
