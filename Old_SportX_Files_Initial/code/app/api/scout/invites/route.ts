import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json([]);

  try {
    const rows = (await sql`
      SELECT
        ti.id,
        u.name AS player_name,
        ti.status,
        ti.created_at AS sent_at
      FROM scout_trial_invites ti
      JOIN users u ON ti.player_user_id::uuid = u.id
      WHERE ti.scout_user_id::uuid = ${(session.user as any).id}
      ORDER BY ti.created_at DESC
      LIMIT 10
    `) as any[];

    return NextResponse.json(rows);
  } catch (e) {
    console.error("[scout/invites]", e);
    return NextResponse.json([]);
  }
}
