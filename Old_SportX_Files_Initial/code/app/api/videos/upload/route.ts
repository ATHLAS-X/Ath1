import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { VIDEO_CATEGORIES, extractYouTubeId } from "@/lib/youtube";

interface UploadBody {
  title?: string;
  youtube_url?: string;
  category?: string;
}

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("Unauthorized", 401);

  let body: UploadBody;
  try {
    body = (await req.json()) as UploadBody;
  } catch {
    return err("Invalid JSON", 400);
  }

  const title = body.title?.trim();
  const youtube_url = body.youtube_url?.trim();
  const category = body.category;

  if (!title) return err("Title is required", 400);
  if (title.length > 200) return err("Title too long", 400);
  if (!youtube_url) return err("YouTube URL is required", 400);
  if (!category || !VIDEO_CATEGORIES.includes(category as (typeof VIDEO_CATEGORIES)[number])) {
    return err("Valid category required", 400);
  }

  const videoId = extractYouTubeId(youtube_url);
  if (!videoId) return err("Invalid YouTube URL", 400);

  const inserted = (await sql`
    INSERT INTO player_videos (user_id, title, youtube_url, youtube_video_id, category)
    VALUES (${session.user.id}, ${title}, ${youtube_url}, ${videoId}, ${category})
    RETURNING id, user_id, title, youtube_url, youtube_video_id, category, created_at
  `) as unknown as Record<string, unknown>[];

  return NextResponse.json({ success: true, data: { video: inserted[0] } }, { status: 201 });
}
