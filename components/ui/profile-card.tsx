/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { Share2, Camera, ShieldCheck, ChevronRight } from "lucide-react";

export interface ProfileCardProps {
  name: string;
  /** Public photo URL. If null, we render an "Upload your photo" placeholder. */
  avatarUrl: string | null;
  /** @handle text (e.g. "@harshit"). */
  handle: string;
  /** Optional small caption beneath the handle (e.g. "Joined Jun 2024"). */
  caption?: string;
  /** Player role from cricket_profile. */
  role?: string | null;
  /** Location string (city, state). */
  location?: string | null;
  /** Total AthlasX score (0–100). */
  score?: number | null;
  /** Profile-strength label. */
  strength?: "STRONG" | "MID" | "WEAK" | null;
  /** True if a coach has approved the player. */
  coachVerified?: boolean;
  /** Is the viewer the owner of this profile? Controls the upload affordance + CTAs. */
  isOwner?: boolean;
  /** URL the share button should point to (e.g. /profile/<userId>). */
  shareUrl?: string;
  /** Fires when the owner picks a file to upload. */
  onUploadAvatar?: (file: File) => void | Promise<void>;
  /** True while an avatar upload is in flight. */
  uploading?: boolean;
}

const STRENGTH_TONE: Record<NonNullable<ProfileCardProps["strength"]>, { bg: string; fg: string }> = {
  STRONG: { bg: "rgba(255,255,255,0.16)", fg: "#ffffff" },
  MID:    { bg: "rgba(255,255,255,0.12)", fg: "#e5e5e5" },
  WEAK:   { bg: "rgba(255,255,255,0.08)", fg: "#a3a3a3" },
};

export function ProfileCard({
  name,
  avatarUrl,
  handle,
  caption,
  role,
  location,
  score,
  strength,
  coachVerified,
  isOwner,
  shareUrl,
  onUploadAvatar,
  uploading,
}: ProfileCardProps) {
  function copyShareLink() {
    if (!shareUrl) return;
    const url = typeof window !== "undefined"
      ? `${window.location.origin}${shareUrl}`
      : shareUrl;
    navigator.clipboard.writeText(url).catch(() => {});
  }

  return (
    <>
      <style>{`
        .sx-pc-card { transition: transform 700ms ease-out; }
        .sx-pc-card:hover { transform: scale(1.01); }
        .sx-pc-image { transition: transform 700ms ease-out; }
        .sx-pc-image-container:hover .sx-pc-image { transform: scale(1.03); }
        .sx-pc-handle { transition: transform 500ms ease-out; }
        .sx-pc-handle:hover { transform: translateX(4px); }
        .sx-pc-avatar { transition: transform 500ms ease-out; }
        .sx-pc-avatar:hover { transform: scale(1.08); }
      `}</style>

      <div className="w-full max-w-md mx-auto">
        <div
          className="sx-pc-card overflow-hidden"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 24,
            boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
          }}
        >
          {/* Photo */}
          <div className="relative overflow-hidden sx-pc-image-container">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={name}
                className="w-full aspect-square object-cover sx-pc-image"
              />
            ) : (
              <div
                className="w-full aspect-square flex flex-col items-center justify-center text-center px-6"
                style={{ background: "#0a0a0a", color: "var(--muted)" }}
              >
                <Camera size={36} style={{ marginBottom: 12, opacity: 0.6 }} />
                <p className="font-semibold" style={{ color: "var(--text)" }}>
                  {isOwner ? "Add a photo of you" : "No photo yet"}
                </p>
                <p className="text-xs mt-1">
                  {isOwner
                    ? "A clean, well-lit headshot lifts scout response rates."
                    : "This player hasn't uploaded a photo yet."}
                </p>
                {isOwner && (
                  <label
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold cursor-pointer"
                    style={{
                      background: "var(--accent)", color: "#000",
                      padding: "8px 16px", borderRadius: 8,
                    }}
                  >
                    <Camera size={14} /> {uploading ? "Uploading…" : "Upload photo"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f && onUploadAvatar) onUploadAvatar(f);
                      }}
                    />
                  </label>
                )}
              </div>
            )}

            {avatarUrl && (
              <>
                <div
                  className="absolute inset-x-0 bottom-0 pointer-events-none"
                  style={{
                    height: 160,
                    background: "linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0))",
                  }}
                />
                {/* Owner overlay: change photo */}
                {isOwner && (
                  <label
                    className="absolute top-4 right-4 inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                    style={{
                      background: "rgba(0,0,0,0.6)", color: "#fff",
                      padding: "6px 10px", borderRadius: 6,
                      backdropFilter: "blur(6px)",
                      border: "1px solid rgba(255,255,255,0.15)",
                    }}
                  >
                    <Camera size={12} /> {uploading ? "Uploading…" : "Change"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f && onUploadAvatar) onUploadAvatar(f);
                      }}
                    />
                  </label>
                )}
              </>
            )}

            {/* Name overlay */}
            <div className="absolute top-5 left-5 right-5 flex items-start justify-between gap-2 pointer-events-none">
              <div>
                <h2
                  className="text-2xl font-bold"
                  style={{ color: "#fff", textShadow: "0 2px 12px rgba(0,0,0,0.55)" }}
                >
                  {name}
                </h2>
                {role && (
                  <p
                    className="text-xs uppercase tracking-widest mt-1"
                    style={{ color: "#e5e5e5", textShadow: "0 2px 8px rgba(0,0,0,0.55)" }}
                  >
                    {role}{location ? ` · ${location}` : ""}
                  </p>
                )}
              </div>
              {coachVerified && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    background: "rgba(255,255,255,0.15)", color: "#fff",
                    padding: "4px 8px", borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.25)",
                    backdropFilter: "blur(6px)",
                  }}
                >
                  <ShieldCheck size={10} /> Verified
                </span>
              )}
            </div>

            {/* Bottom-left score chip */}
            {avatarUrl && typeof score === "number" && (
              <div className="absolute bottom-5 left-5 flex items-end gap-3">
                <div
                  className="flex flex-col items-start"
                  style={{ color: "#fff" }}
                >
                  <span className="text-[10px] uppercase tracking-widest" style={{ color: "#cbd5e1" }}>
                    AthlasX Score
                  </span>
                  <span className="text-3xl font-extrabold leading-none">{score}</span>
                </div>
                {strength && (
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
                    style={{
                      background: STRENGTH_TONE[strength].bg,
                      color: STRENGTH_TONE[strength].fg,
                      border: "1px solid rgba(255,255,255,0.18)",
                      backdropFilter: "blur(6px)",
                    }}
                  >
                    {strength}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Footer row */}
          <div className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-9 h-9 rounded-full overflow-hidden sx-pc-avatar"
                style={{ border: "1px solid var(--border)", flexShrink: 0 }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center font-bold"
                    style={{ background: "#0a0a0a", color: "var(--accent)" }}
                  >
                    {name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="sx-pc-handle min-w-0">
                <div className="text-sm truncate" style={{ color: "var(--text)" }}>{handle}</div>
                <div className="text-xs truncate" style={{ color: "var(--muted)" }}>
                  {caption ?? (location ?? "")}
                </div>
              </div>
            </div>

            {isOwner ? (
              <button
                type="button"
                onClick={copyShareLink}
                className="sx-btn inline-flex items-center gap-1.5"
                style={{ width: "auto", padding: "8px 14px" }}
              >
                <Share2 size={14} /> Share
              </button>
            ) : (
              <Link
                href={shareUrl ?? "#"}
                className="sx-btn inline-flex items-center gap-1.5"
                style={{ width: "auto", padding: "8px 14px" }}
              >
                View <ChevronRight size={14} />
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default ProfileCard;
