import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

async function guardBatch(adminUserId: string, batchId: string) {
  const rows = (await sql`
    SELECT b.id, a.id AS academy_id FROM batches b
    JOIN academies a ON a.id = b.academy_id
    WHERE b.id = ${batchId} AND a.user_id = ${adminUserId} AND b.batch_status != 'DELETED'
    LIMIT 1
  `) as any[];
  return rows[0] ?? null;
}

/* POST — add a player to a batch.
   Body: { player_profile_id: string }
   The player must already belong to this academy. */
export async function POST(req: Request, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "academy_admin") {
    return NextResponse.json({ success: false, error: "Academy admins only" }, { status: 403 });
  }
  const adminUserId = (session.user as any).id as string;
  const batch = await guardBatch(adminUserId, ctx.params.id);
  if (!batch) return NextResponse.json({ success: false, error: "Batch not found" }, { status: 404 });

  let body: any = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const playerProfileId = String(body.player_profile_id ?? "").trim();
  if (!playerProfileId) return NextResponse.json({ success: false, error: "player_profile_id is required" }, { status: 400 });

  const playerRows = (await sql`
    SELECT id FROM player_profiles
    WHERE id = ${playerProfileId} AND academy_id = ${batch.academy_id}
    LIMIT 1
  `) as any[];
  if (!playerRows[0]) return NextResponse.json({ success: false, error: "Player not found in this academy" }, { status: 404 });

  await sql`
    INSERT INTO batch_players (batch_id, player_profile_id)
    VALUES (${ctx.params.id}, ${playerProfileId})
    ON CONFLICT (batch_id, player_profile_id) DO NOTHING
  `;

  return NextResponse.json({ success: true });
}

/* DELETE — remove a player from a batch.
   Body: { player_profile_id: string } */
export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "academy_admin") {
    return NextResponse.json({ success: false, error: "Academy admins only" }, { status: 403 });
  }
  const batch = await guardBatch((session.user as any).id, ctx.params.id);
  if (!batch) return NextResponse.json({ success: false, error: "Batch not found" }, { status: 404 });

  let body: any = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const playerProfileId = String(body.player_profile_id ?? "").trim();
  if (!playerProfileId) return NextResponse.json({ success: false, error: "player_profile_id is required" }, { status: 400 });

  await sql`
    DELETE FROM batch_players
    WHERE batch_id = ${ctx.params.id} AND player_profile_id = ${playerProfileId}
  `;

  return NextResponse.json({ success: true });
}
