import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { canViewPlayerProfile } from "@/lib/authz";

/**
 * Fails closed, deliberately: 401 with no session at all, 404 if the
 * requester isn't authorized to view this specific profile (also covers
 * "profile doesn't exist" — same status either way so existence isn't
 * leaked), 500 only for a genuine unexpected DB/server error. Never a
 * silent 200 on failure — that was the bug (see Master 9 #21).
 */
export async function GET(req: NextRequest, { params }: { params: { userId: string } }) {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") ?? "T20";

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let profile: { user_id: string; visibility: string | null } | undefined;
  try {
    const profileRows = (await sql`
      SELECT user_id, visibility FROM player_profiles WHERE user_id = ${params.userId} LIMIT 1
    `) as unknown as Array<{ user_id: string; visibility: string | null }>;
    profile = profileRows[0];
  } catch (e) {
    console.error("[player/stats] profile lookup failed", e);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }

  /* 404, not 403 — don't reveal whether a profile exists at all. Also
     covers "exists but not authorized to view" with the same status. */
  if (!profile || !canViewPlayerProfile(session, profile)) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  try {
    const rows = (await sql`
      SELECT format, matches, innings, runs, not_outs, highest_score, fifties, hundreds,
             powerplay_sr, middle_avg, death_sr, overs_bowled, wickets, economy,
             bowl_avg, bowl_sr, best_figures, bpi, cbr
      FROM performance_stats
      WHERE user_id = ${params.userId} AND format = ${format}
      LIMIT 1
    `) as any[];
    return NextResponse.json(rows[0] ?? null);
  } catch (e) {
    console.error("[player/stats] stats lookup failed", e);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
