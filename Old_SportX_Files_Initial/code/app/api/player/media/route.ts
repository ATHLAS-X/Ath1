import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

/**
 * Stub media endpoint — beta, external-link-only. The MVP accepts a URL the
 * user has hosted elsewhere (YouTube, S3, Cloudflare R2, etc.) plus an
 * optional title; there is no real file upload here, by design, not by
 * accident. Every response includes `beta: true` and `external_link_only:
 * true` so the frontend can say so honestly instead of presenting this as
 * full upload support.
 *
 * To switch to direct upload (the same gap app/videos/upload/page.tsx would
 * hit if it ever called this route instead of submitting a YouTube link to
 * /api/videos/upload), this needs:
 *   - A real object-storage destination (the existing local
 *     public/uploads/<userId>/... pattern from lib/onboarding-server.ts's
 *     saveUpload() doesn't scale to video-sized files) — most likely signed
 *     PUT URLs against S3/Cloudflare R2/OCI Object Storage.
 *   - POST /api/player/media/presign → returns a signed PUT URL + upload id.
 *   - Client uploads the file bytes directly to that signed URL (bypassing
 *     this server entirely for the multi-MB/GB transfer).
 *   - PATCH /api/player/media/[id] → client confirms the upload completed;
 *     server verifies the object exists (HEAD request) before persisting
 *     the row — never trust the client's "done" claim alone.
 *   - Magic-byte/size validation equivalent to lib/upload-validation.ts,
 *     but applied server-side via the storage provider's webhook or a HEAD
 *     + range-read, since the bytes never pass through this server to
 *     validate inline.
 *   - A virus/malware scan step before the object is ever served, since
 *     direct-to-storage uploads skip this server's request pipeline.
 */

const ALLOWED_TYPES = ["video", "photo", "scorecard", "certificate"];
const MEDIA_STUB_FLAGS = { beta: true, external_link_only: true } as const;

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

  return NextResponse.json({ success: true, media: rows[0], ...MEDIA_STUB_FLAGS });
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
  /* Response body stays a bare array — PlayerProfileWizard.tsx does
     .then((r) => r.json()).then(setMedia), expecting the array directly.
     Surface the beta/external-link-only flags via a header instead of
     changing that shape. */
  return NextResponse.json(rows, {
    headers: { "X-Media-Stub": "beta,external-link-only" },
  });
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
