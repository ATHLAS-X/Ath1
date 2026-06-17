import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json([]);

  try {
    /* Ensure table exists (idempotent) */
    await sql`
      CREATE TABLE IF NOT EXISTS trial_invites (
        id SERIAL PRIMARY KEY,
        scout_user_id TEXT NOT NULL,
        player_user_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Pending',
        sent_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(scout_user_id, player_user_id)
      )
    `;

    const rows = (await sql`
      SELECT
        ti.id,
        u.name AS player_name,
        ti.status,
        ti.sent_at
      FROM trial_invites ti
      JOIN users u ON ti.player_user_id = u.id
      WHERE ti.scout_user_id = ${session.user.id}
      ORDER BY ti.sent_at DESC
      LIMIT 10
    `) as any[];

    return NextResponse.json(rows);
  } catch (e) {
    console.error("[scout/invites]", e);
    return NextResponse.json([]);
  }
}
