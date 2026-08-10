"use client";

import { useState } from "react";
import ProfileCard, { ProfileCardProps } from "@/components/ui/profile-card";

/**
 * Client wrapper around ProfileCard that handles the avatar upload roundtrip.
 * Owners get an upload affordance baked into the card.
 */
export default function MyProfileCard(initial: ProfileCardProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initial.avatarUrl);
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      const res = await fetch("/api/profile/avatar", { method: "POST", body: fd });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success && data.data?.avatar_url) {
        // Cache-bust so the new image shows immediately
        setAvatarUrl(`${data.data.avatar_url}?t=${Date.now()}`);
      } else {
        alert(data?.error ?? "Upload failed");
      }
    } catch (e: any) {
      alert(e?.message ?? "Network error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <ProfileCard
      {...initial}
      avatarUrl={avatarUrl}
      uploading={uploading}
      onUploadAvatar={initial.isOwner ? upload : undefined}
    />
  );
}
