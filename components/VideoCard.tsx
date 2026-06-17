"use client";

import { Trash2 } from "lucide-react";
import { youtubeThumbnail, type PlayerVideo } from "@/lib/youtube";

interface Props {
  video: PlayerVideo;
  showDelete?: boolean;
  onDelete?: (id: string) => void;
  deleting?: boolean;
}

const CATEGORY_COLORS: Record<string, { bg: string; fg: string }> = {
  Batting: { bg: "#1e3a5f", fg: "#7cc4ff" },
  Bowling: { bg: "#5f1e1e", fg: "#ff8a8a" },
  "Wicket-Keeping": { bg: "#5f521e", fg: "#ffd86b" },
  Fielding: { bg: "#3e1e5f", fg: "#c79bff" },
  "Match Highlights": { bg: "#2a2a2a", fg: "#ffffff" },
  "Net Session": { bg: "#3a3a3a", fg: "#c0c0c0" },
};

export default function VideoCard({ video, showDelete = false, onDelete, deleting = false }: Props) {
  const cat = video.category ?? "";
  const color = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS["Net Session"];

  return (
    <div className="sx-card overflow-hidden flex flex-col">
      <a
        href={video.youtube_url}
        target="_blank"
        rel="noopener noreferrer"
        className="block relative aspect-video bg-black"
      >
        {video.youtube_video_id && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={youtubeThumbnail(video.youtube_video_id)}
            alt={video.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
      </a>
      <div className="p-4 flex-1 flex flex-col">
        <h3 className="font-semibold line-clamp-2">{video.title}</h3>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {cat && (
            <span
              className="px-2 py-0.5 rounded-full text-xs font-semibold"
              style={{ background: color.bg, color: color.fg }}
            >
              {cat}
            </span>
          )}
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            {new Date(video.created_at).toLocaleDateString()}
          </span>
        </div>
        {showDelete && onDelete && (
          <button
            type="button"
            onClick={() => onDelete(video.id)}
            disabled={deleting}
            className="mt-4 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold border transition-colors"
            style={{ borderColor: "var(--error)", color: "var(--error)" }}
          >
            <Trash2 size={14} />
            {deleting ? "Deleting..." : "Delete"}
          </button>
        )}
      </div>
    </div>
  );
}
