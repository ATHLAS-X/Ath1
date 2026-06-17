"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import VideoCard from "@/components/VideoCard";
import Loader from "@/components/Loader";
import type { PlayerVideo } from "@/lib/youtube";

export default function MyVideosPage() {
  const { status } = useSession();
  const [videos, setVideos] = useState<PlayerVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/videos");
        const text = await res.text();
        const data = text ? (() => { try { return JSON.parse(text); } catch { return null; } })() : null;
        if (cancelled) return;
        if (!res.ok || !data || !data.success) {
          setError(data?.error ?? `Failed to load (${res.status})`);
        } else {
          setVideos(data.data?.videos ?? []);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Network error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [status]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this video?")) return;
    setDeletingId(id);
    const res = await fetch(`/api/videos/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      setVideos((vs) => vs.filter((v) => v.id !== id));
    } else {
      alert(data.error ?? "Delete failed");
    }
    setDeletingId(null);
  }

  if (status !== "authenticated") {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader fullScreen />
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">
            My Videos {videos.length > 0 && (
              <span style={{ color: "var(--muted)" }}>({videos.length})</span>
            )}
          </h1>
          <Link href="/videos/upload" className="sx-btn sm:w-auto px-5">Upload New Video</Link>
        </div>

        {loading ? (
          <p style={{ color: "var(--muted)" }}>Loading videos...</p>
        ) : error ? (
          <p className="sx-error">{error}</p>
        ) : videos.length === 0 ? (
          <div className="sx-card p-10 text-center">
            <p style={{ color: "var(--muted)" }}>No videos uploaded yet. Add your first video.</p>
            <Link href="/videos/upload" className="sx-btn inline-block mt-4 sm:w-auto px-6">Upload Video</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map((v) => (
              <VideoCard
                key={v.id}
                video={v}
                showDelete
                onDelete={handleDelete}
                deleting={deletingId === v.id}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
