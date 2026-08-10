"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ClaimButton({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function claim() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/claim/${token}`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || !data.success) {
      setError(data.error ?? "Claim failed");
      return;
    }
    router.push(data.redirect ?? "/onboarding/player");
  }

  return (
    <>
      <button className="btn green" onClick={claim} disabled={busy} style={{ width: "100%" }}>
        {busy ? "Claiming…" : "Claim this profile"}
      </button>
      {error && (
        <p style={{ color: "var(--red)", fontSize: 12.5, marginTop: 10 }}>{error}</p>
      )}
    </>
  );
}
