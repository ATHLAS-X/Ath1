import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import type { PlayerVideo } from "@/lib/youtube";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = (await sql`
      SELECT id, user_id, title, youtube_url, youtube_video_id, category, created_at
      FROM player_videos
      WHERE user_id = ${session.user.id}
      ORDER BY created_at DESC
    `) as unknown as PlayerVideo[];

    return NextResponse.json({ success: true, data: { videos: rows } });
  } catch (e: any) {
    console.error("GET /api/videos failed:", e);
    return NextResponse.json(
      { success: false, error: e?.message ?? "Database error" },
      { status: 500 }
    );
  }
}
