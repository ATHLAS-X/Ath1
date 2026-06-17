import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: { userId: string } }) {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") ?? "T20";

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
    console.error("[player/stats]", e);
    return NextResponse.json(null);
  }
}
