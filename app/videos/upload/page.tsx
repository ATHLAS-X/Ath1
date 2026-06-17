"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Spinner from "@/components/Spinner";
import Loader from "@/components/Loader";
import { VIDEO_CATEGORIES, extractYouTubeId } from "@/lib/youtube";

interface Errors { title?: string; youtube_url?: string; category?: string; form?: string }

export default function VideoUploadPage() {
  const router = useRouter();
  const { status } = useSession();
  const [title, setTitle] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [category, setCategory] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  function validate(): Errors {
    const e: Errors = {};
    if (!title.trim()) e.title = "Title is required";
    else if (title.length > 200) e.title = "Title must be ≤ 200 chars";
    if (!youtubeUrl.trim()) e.youtube_url = "YouTube URL is required";
    else if (!extractYouTubeId(youtubeUrl)) e.youtube_url = "Enter a valid YouTube URL";
    if (!category) e.category = "Select a category";
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length > 0) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/videos/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          youtube_url: youtubeUrl.trim(),
          category,
        }),
      });
      const text = await res.text();
      const data = text ? (() => { try { return JSON.parse(text); } catch { return null; } })() : null;
      if (!res.ok || !data || !data.success) {
        setErrors({ form: data?.error ?? `Upload failed (${res.status})` });
        setSubmitting(false);
        return;
      }
      router.push("/videos");
    } catch (e: any) {
      setErrors({ form: e?.message ?? "Network error" });
      setSubmitting(false);
    }
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
      <div className="max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Upload Video</h1>
          <Link href="/videos" className="sx-link text-sm">← My Videos</Link>
        </div>

        <form onSubmit={handleSubmit} noValidate className="sx-card p-8 space-y-4">
          <div>
            <label htmlFor="title" className="sx-label">Title ({title.length}/200)</label>
            <input id="title" className="sx-input" maxLength={200} value={title}
              onChange={(e) => setTitle(e.target.value)} />
            {errors.title && <p className="sx-error">{errors.title}</p>}
          </div>

          <div>
            <label htmlFor="youtube_url" className="sx-label">YouTube URL</label>
            <input id="youtube_url" className="sx-input" value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..." />
            {errors.youtube_url && <p className="sx-error">{errors.youtube_url}</p>}
          </div>

          <div>
            <label htmlFor="category" className="sx-label">Category</label>
            <select id="category" className="sx-input" value={category}
              onChange={(e) => setCategory(e.target.value)}>
              <option value="">Select category…</option>
              {VIDEO_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {errors.category && <p className="sx-error">{errors.category}</p>}
          </div>

          {errors.form && <p className="sx-error">{errors.form}</p>}

          <button type="submit" disabled={submitting} className="sx-btn flex items-center justify-center gap-2">
            {submitting && <Spinner />}
            {submitting ? "Uploading..." : "Upload Video"}
          </button>
        </form>
      </div>
    </main>
  );
}
