import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import type { PlayerProfile } from "@/lib/profile";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const rows = (await sql`
    SELECT id, user_id, city, state, district, date_of_birth,
           playing_role, batting_style, bowling_style,
           matches_played, runs_scored, wickets_taken, highest_score,
           best_bowling, bio, avatar_url
    FROM player_profiles WHERE user_id = ${session.user.id} LIMIT 1
  `) as unknown as PlayerProfile[];

  return NextResponse.json({
    success: true,
    data: { userId: session.user.id, profile: rows[0] ?? null },
  });
}
