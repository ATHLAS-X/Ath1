import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

/**
 * Stub media endpoint. The MVP accepts a URL the user has hosted elsewhere
 * (YouTube, S3, Cloudflare R2, etc.) plus optional title.
 *
 * To switch to direct upload, replace this with:
 *   - POST /api/player/media/presign  → returns signed PUT URL for R2/S3
 *   - PATCH /api/player/media/[id]    → confirm upload, persist row
 */

const ALLOWED_TYPES = ["video", "photo", "scorecard", "certificate"];

function extractYouTubeId(url: string): string | null {
  const m = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/,
  );
  return m ? m[1] : null;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id as string;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }
  const url   = String(body.url ?? "").trim();
  const type  = String(body.media_type ?? "video").toLowerCase();
  const title = String(body.title ?? "").trim() || null;
  const desc  = String(body.description ?? "").trim() || null;

  if (!url) return NextResponse.json({ success: false, error: "URL required" }, { status: 400 });
  if (!ALLOWED_TYPES.includes(type)) {
    return NextResponse.json(
      { success: false, error: `media_type must be one of: ${ALLOWED_TYPES.join(", ")}` },
      { status: 400 },
    );
  }

  const yt = type === "video" ? extractYouTubeId(url) : null;

  const rows = (await sql`
    INSERT INTO player_media (user_id, media_type, url, youtube_video_id, title, description)
    VALUES (${userId}, ${type}, ${url}, ${yt}, ${title}, ${desc})
    RETURNING id, media_type, url, youtube_video_id, title, uploaded_at
  `) as unknown as Array<any>;

  return NextResponse.json({ success: true, media: rows[0] });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id as string;

  const rows = (await sql`
    SELECT id, media_type, url, youtube_video_id, title, uploaded_at
    FROM player_media
    WHERE user_id = ${userId}
    ORDER BY uploaded_at DESC
  `) as unknown as Array<any>;
  return NextResponse.json(rows);
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id as string;
  let body: any = {};
  try { body = await req.json(); } catch {}
  const id = String(body.id ?? "").trim();
  if (!id) return NextResponse.json({ success: false, error: "id required" }, { status: 400 });

  await sql`DELETE FROM player_media WHERE id = ${id} AND user_id = ${userId}`;
  return NextResponse.json({ success: true });
}
