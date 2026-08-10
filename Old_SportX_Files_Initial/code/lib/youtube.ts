export const VIDEO_CATEGORIES = [
  "Batting",
  "Bowling",
  "Wicket-Keeping",
  "Fielding",
  "Match Highlights",
  "Net Session",
] as const;

export type VideoCategory = (typeof VIDEO_CATEGORIES)[number];

export interface PlayerVideo {
  id: string;
  user_id: string;
  title: string;
  youtube_url: string;
  youtube_video_id: string | null;
  category: string | null;
  created_at: string;
}

/**
 * Extract a YouTube video ID from any of:
 *   https://www.youtube.com/watch?v=XXXX
 *   https://youtu.be/XXXX
 *   https://www.youtube.com/shorts/XXXX
 * Returns null if not a valid YouTube URL.
 */
export function extractYouTubeId(input: string): string | null {
  if (!input) return null;
  const url = input.trim();

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\./, "");
  const idRe = /^[A-Za-z0-9_-]{6,15}$/;

  if (host === "youtu.be") {
    const id = parsed.pathname.slice(1).split("/")[0];
    return idRe.test(id) ? id : null;
  }
  if (host === "youtube.com" || host === "m.youtube.com") {
    if (parsed.pathname === "/watch") {
      const id = parsed.searchParams.get("v") ?? "";
      return idRe.test(id) ? id : null;
    }
    const shortsMatch = parsed.pathname.match(/^\/shorts\/([^/?#]+)/);
    if (shortsMatch && idRe.test(shortsMatch[1])) return shortsMatch[1];
  }
  return null;
}

export function youtubeThumbnail(id: string): string {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}
