"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import ScoreRing from "@/components/onboarding/ScoreRing";

export default function OnboardingCompletePage() {
  const router = useRouter();
  const [score, setScore] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/onboarding/score");
        const data = await res.json().catch(() => null);
        if (!cancelled) setScore(data?.data?.total_score ?? 0);
      } catch { /* ignore */ }
    })();
    const t = setTimeout(() => router.replace("/dashboard"), 4000);
    return () => { cancelled = true; clearTimeout(t); };
  }, [router]);

  const pieces = Array.from({ length: 40 }, (_, i) => i);
  const colors = ["#22C55E", "#60A5FA", "#F59E0B", "#EC4899", "#A78BFA"];

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden"
      style={{ background: "#050D18", color: "#E2E8F0" }}
    >
      {/* Confetti */}
      {pieces.map((i) => {
        const left = (i * 89) % 100;
        const delay = (i % 12) * 0.1;
        const color = colors[i % colors.length];
        return (
          <span
            key={i}
            style={{
              position: "absolute", left: `${left}%`, top: -20,
              width: 8, height: 14, background: color, borderRadius: 1,
              animation: `sxconfetti2 3.6s ease-out ${delay}s forwards`,
            }}
          />
        );
      })}
      <style>{`@keyframes sxconfetti2{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(110vh) rotate(720deg);opacity:0}}`}</style>

      <div className="text-center space-y-5 max-w-md">
        <CheckCircle2 size={56} style={{ color: "#22C55E", margin: "0 auto" }} />
        <h1 className="text-3xl font-extrabold">You&rsquo;re discoverable!</h1>
        <p style={{ color: "#94A3B8" }}>
          Your SportX profile is live and visible to scouts across India. Redirecting you to your dashboard…
        </p>
        <div className="flex justify-center">
          <ScoreRing score={score} size="lg" animate />
        </div>
        <button
          type="button"
          onClick={() => router.replace("/dashboard")}
          className="px-5 py-2 rounded-md text-sm font-semibold"
          style={{ background: "#22C55E", color: "#062012", border: "none" }}
        >
          Go to dashboard now
        </button>
      </div>
    </main>
  );
}
