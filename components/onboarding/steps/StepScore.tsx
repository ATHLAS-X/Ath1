"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, TrendingUp, Lock, Loader2, Sparkles } from "lucide-react";
import StepShell from "@/components/onboarding/StepShell";
import ScoreRing from "@/components/onboarding/ScoreRing";
import Toast from "@/components/Toast";

interface Props { currentStep: number; completedSteps: number[]; readOnly: boolean; }

interface ScoreData {
  total: number;
  breakdown: {
    performance: number; experience: number; fitness: number;
    verification: number; mindset: number; profile: number;
  };
  verification_pts: number;
  profile_strength: "STRONG" | "MID" | "WEAK";
  trajectory_boost: boolean;
  delta_vs_30d: number;
  coach_verified: boolean;
  roadmap: Array<{ title: string; reward: string }>;
}

const CATEGORIES: Array<{ key: keyof ScoreData["breakdown"]; label: string; max: number; pct: number; color: string }> = [
  { key: "performance",  label: "Performance",  max: 40, pct: 40, color: "#60A5FA" },
  { key: "experience",   label: "Experience",   max: 15, pct: 15, color: "#A78BFA" },
  { key: "fitness",      label: "Fitness",      max: 15, pct: 15, color: "#F59E0B" },
  { key: "verification", label: "Verification", max: 15, pct: 15, color: "#22C55E" },
  { key: "mindset",      label: "Mindset",      max: 10, pct: 10, color: "#EC4899" },
  { key: "profile",      label: "Profile",      max:  5, pct:  5, color: "#94A3B8" },
];

export default function StepScore({ currentStep, completedSteps, readOnly }: Props) {
  const router = useRouter();
  const [score, setScore] = useState<ScoreData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [revealed, setRevealed] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  // Auto-calculate on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        const res = await fetch("/api/onboarding/score/calculate", { method: "POST" });
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !data?.success) {
          setError(data?.error ?? "Could not calculate score");
          return;
        }
        setScore(data.data);
        setToast("Score calculated — view your roadmap below");
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Network error");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Sequentially reveal category bars (100ms each).
  useEffect(() => {
    if (!score) return;
    setRevealed(0);
    const id = setInterval(() => {
      setRevealed((n) => {
        if (n >= CATEGORIES.length) { clearInterval(id); return n; }
        return n + 1;
      });
    }, 100);
    return () => clearInterval(id);
  }, [score]);

  function goNext() {
    router.push("/onboarding/discover");
    return true;
  }

  const frontend = (
    <div className="space-y-6">
      {busy && !score && (
        <div className="py-10 text-center space-y-3">
          <Loader2 className="inline-block animate-spin" size={28} style={{ color: "#22C55E" }} />
          <p style={{ color: "#94A3B8" }}>Crunching your numbers…</p>
        </div>
      )}

      {score && (
        <>
          <div className="flex flex-col items-center gap-3">
            <ScoreRing score={score.total} size="lg" animate />
            {score.trajectory_boost && (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                style={{ background: "rgba(34,197,94,0.12)", color: "#22C55E", border: "1px solid rgba(34,197,94,0.4)" }}
              >
                <TrendingUp size={12} /> ↑ Trending · ×1.2 ranking boost
              </span>
            )}
            {!score.trajectory_boost && score.delta_vs_30d !== 0 && (
              <span className="text-xs" style={{ color: "#94A3B8" }}>
                Δ vs 30d ago: <strong style={{ color: score.delta_vs_30d >= 0 ? "#86EFAC" : "#F59E0B" }}>
                  {score.delta_vs_30d >= 0 ? "+" : ""}{score.delta_vs_30d}
                </strong>
              </span>
            )}
          </div>

          {/* Category bars */}
          <div className="space-y-2">
            {CATEGORIES.map((c, i) => {
              const value = score.breakdown[c.key];
              const fill = Math.round((value / c.max) * 100);
              const visible = i < revealed;
              return (
                <div key={c.key} className="space-y-1" style={{ opacity: visible ? 1 : 0, transition: "opacity 200ms ease" }}>
                  <div className="flex justify-between text-xs" style={{ color: "#94A3B8" }}>
                    <span>{c.label} <span style={{ color: "#64748B" }}>({c.pct}%)</span></span>
                    <span style={{ color: "#E2E8F0", fontFamily: "ui-monospace" }}>
                      {value} <span style={{ color: "#64748B" }}>/ {c.max}</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: "#1E3A5F" }}>
                    <div
                      style={{
                        width: visible ? `${fill}%` : "0%",
                        height: "100%",
                        background: c.color,
                        borderRadius: 999,
                        transition: "width 600ms ease",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Roadmap */}
          {score.roadmap.length > 0 && (
            <div
              className="p-4 rounded-lg space-y-3"
              style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.3)" }}
            >
              <div className="flex items-center gap-2">
                <Lock size={14} style={{ color: "#22C55E" }} />
                <p className="text-sm font-semibold" style={{ color: "#E2E8F0" }}>
                  Your path to {score.profile_strength === "STRONG" ? "the National benchmark" : score.profile_strength === "MID" ? "STRONG profile" : "MID profile"}
                </p>
                <span className="text-[10px] px-2 py-0.5 rounded ml-auto" style={{ background: "#1E3A5F", color: "#94A3B8" }}>
                  PRIVATE
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {score.roadmap.map((r, i) => (
                  <div key={i} className="p-3 rounded-md flex items-start gap-3" style={{ background: "#050D18", border: "1px solid #1E3A5F" }}>
                    <Sparkles size={14} style={{ color: "#22C55E", marginTop: 2 }} />
                    <div className="flex-1">
                      <p className="text-sm" style={{ color: "#E2E8F0" }}>{r.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: "#86EFAC" }}>{r.reward}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={goNext}
            className="px-5 py-2 rounded-md text-sm font-semibold inline-flex items-center gap-2"
            style={{ background: "#22C55E", color: "#062012", border: "none", boxShadow: "0 6px 20px rgba(34,197,94,0.3)" }}
          >
            View My Public Profile <ChevronRight size={16} />
          </button>
        </>
      )}

      {error && <p className="text-sm" style={{ color: "#EF4444" }}>{error}</p>}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );

  const backend = (
    <div className="space-y-3 text-sm" style={{ color: "#94A3B8" }}>
      <h3 className="text-base font-semibold" style={{ color: "#E2E8F0" }}>SportX Score formula</h3>
      <div
        className="p-3 rounded-md font-mono text-xs space-y-1"
        style={{ background: "#050D18", border: "1px solid #1E3A5F", color: "#86EFAC" }}
      >
        <p>Performance 40% | Experience 15% | Fitness 15%</p>
        <p>Verification 15% | Mindset 10% | Profile 5%</p>
      </div>
      <p className="text-xs uppercase tracking-widest pt-1" style={{ color: "#64748B" }}>Verification pts</p>
      <ul className="text-xs space-y-0.5" style={{ color: "#94A3B8" }}>
        <li>Coach +5</li>
        <li>Aadhaar +3</li>
        <li>Each verified scorecard +3 (cap +6)</li>
        <li>Parent +1</li>
      </ul>
      <p className="text-xs uppercase tracking-widest pt-1" style={{ color: "#64748B" }}>Trajectory boost</p>
      <p className="text-xs" style={{ color: "#94A3B8" }}>
        Score +5pts in 30 days → ×1.2 in search ranking.
      </p>
      <p className="text-xs pt-2" style={{ color: "#64748B" }}>Persisted to <code>sportx_score</code>.</p>
    </div>
  );

  return (
    <StepShell
      step={11}
      currentStep={currentStep}
      completedSteps={completedSteps}
      readOnly={readOnly}
      frontend={frontend}
      backend={backend}
      nextDisabled={!score && !readOnly}
      onNext={goNext}
    />
  );
}
