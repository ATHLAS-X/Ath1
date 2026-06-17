import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id;

  /* Stub roadmap — real implementation would call an LLM with the player's profile. */
  const roadmap = {
    top_3_actions: [
      "Improve death-overs economy below 7.5",
      "Add 2 yorker-length variations to net sessions",
      "Play 3 verified DCA matches this season",
    ],
    generated_at: new Date().toISOString(),
  };

  try {
    await sql`
      UPDATE sportx_score
      SET roadmap = ${JSON.stringify(roadmap)}::jsonb
      WHERE user_id = ${userId}
    `;
    return NextResponse.json({ success: true, roadmap });
  } catch (e) {
    console.error("[roadmap/generate]", e);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
