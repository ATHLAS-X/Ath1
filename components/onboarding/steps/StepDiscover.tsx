"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Share2, ChevronRight, Inbox, Trophy, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import StepShell from "@/components/onboarding/StepShell";
import ScoreRing from "@/components/onboarding/ScoreRing";
import Toast from "@/components/Toast";
import CompletionCelebration from "@/components/onboarding/CompletionCelebration";

interface Props { currentStep: number; completedSteps: number[]; readOnly: boolean; }

interface ScoreRow {
  total_score: number;
  profile_strength: "STRONG" | "MID" | "WEAK";
  verification_pts: number;
  coach_verified: boolean;
  status?: string;
  elasticsearch_indexed?: boolean;
}

export default function StepDiscover({ currentStep, completedSteps, readOnly }: Props) {
  const router = useRouter();
  const { data: session } = useSession();
  const [score, setScore] = useState<ScoreRow | null>(null);
  const [matches, setMatches] = useState(0);
  const [videos, setVideos] = useState(0);
  const [activated, setActivated] = useState(false);
  const [busy, setBusy] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // On mount: fetch score, then auto-activate discovery.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        const [scoreRes, matchRes, vidRes] = await Promise.all([
          fetch("/api/onboarding/score"),
          fetch("/api/onboarding/matches"),
          fetch("/api/videos"),
        ]);
        const scoreJson = await scoreRes.json().catch(() => null);
        const matchJson = await matchRes.json().catch(() => null);
        const vidJson = await vidRes.json().catch(() => null);
        if (cancelled) return;
        setScore(scoreJson?.data ?? null);
        setMatches(matchJson?.data?.matches?.length ?? 0);
        setVideos(vidJson?.data?.videos?.length ?? 0);

        // Activate discovery
        const actRes = await fetch("/api/onboarding/discover/activate", { method: "POST" });
        const actJson = await actRes.json().catch(() => null);
        if (cancelled) return;
        if (actRes.ok && actJson?.success) {
          setActivated(true);
          setToast("Step 12 complete — you're live for scout discovery!");
          // Refresh score row to pick up status:ACTIVE
          const fresh = await fetch("/api/onboarding/score");
          const freshJson = await fresh.json().catch(() => null);
          if (!cancelled && freshJson?.success) setScore(freshJson.data);
        } else {
          setError(actJson?.error ?? "Could not activate discovery");
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Network error");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function goDashboard() {
    router.push("/onboarding/complete");
    return true;
  }

  function share() {
    const url = `${window.location.origin}/profile/${session?.user?.id ?? ""}`;
    navigator.clipboard.writeText(url).then(
      () => setToast("Profile link copied to clipboard"),
      () => setToast("Could not copy — " + url),
    );
  }

  const total = score?.total_score ?? 0;
  const active = activated && (score?.coach_verified || total > 60);
  const strength = score?.profile_strength ?? "WEAK";
  const strengthColor = strength === "STRONG" ? "#22C55E" : strength === "MID" ? "#F59E0B" : "#EF4444";

  const frontend = (
    <div className="space-y-6 relative">
      {/* Confetti overlays — in-card pieces + full-screen 200-particle celebration */}
      {activated && <Confetti />}
      {activated && <CompletionCelebration />}

      {busy && !score && (
        <div className="py-10 text-center space-y-3">
          <Loader2 className="inline-block animate-spin" size={28} style={{ color: "#22C55E" }} />
          <p style={{ color: "#94A3B8" }}>Going live for scout discovery…</p>
        </div>
      )}

      {score && (
        <>
          {/* Celebration */}
          <div
            className="p-6 rounded-lg flex flex-col sm:flex-row items-center gap-5"
            style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.3)" }}
          >
            <div className="flex flex-col items-center gap-2">
              <CheckCircle2 size={36} style={{ color: "#22C55E" }} />
              <ScoreRing score={total} size="md" animate />
            </div>
            <div className="flex-1 space-y-2 text-center sm:text-left">
              <h2 className="text-2xl font-extrabold" style={{ color: "#E2E8F0" }}>You&rsquo;re Live!</h2>
              <p className="text-sm" style={{ color: "#94A3B8" }}>
                Your profile is now discoverable to scouts across India.
              </p>
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                style={{ background: `${strengthColor}1A`, color: strengthColor, border: `1px solid ${strengthColor}55` }}
              >
                <Trophy size={12} /> {strength} PROFILE
              </span>
            </div>
          </div>

          {/* Discovery status */}
          <div className="p-4 rounded-lg" style={{ background: "#050D18", border: "1px solid #1E3A5F" }}>
            {active ? (
              <p className="text-sm font-semibold" style={{ color: "#22C55E" }}>
                🟢 Profile Active — Scouts can find you
              </p>
            ) : (
              <p className="text-sm font-semibold" style={{ color: "#F59E0B" }}>
                🟡 Profile Pending — Reach score 60+ or get coach-verified to activate
              </p>
            )}
          </div>

          {/* Quick stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Score" value={total} />
            <Stat label="Verification Pts" value={score.verification_pts ?? 0} />
            <Stat label="Matches Logged" value={matches} />
            <Stat label="Videos Uploaded" value={videos} />
          </div>

          {/* What happens next */}
          <div className="space-y-2">
            <p className="text-sm font-semibold" style={{ color: "#E2E8F0" }}>What happens next</p>
            <ul className="space-y-2">
              {[
                "Scouts filter by role, age, location, and specialty.",
                "You'll get a push notification + SMS when shortlisted for a trial.",
                "Post-trial: if signed, +3 verification points are auto-awarded.",
              ].map((t, i) => (
                <li
                  key={i}
                  className="p-3 rounded-md text-sm flex items-start gap-2"
                  style={{ background: "#050D18", border: "1px solid #1E3A5F", color: "#E2E8F0" }}
                >
                  <span style={{
                    width: 22, height: 22, borderRadius: 999,
                    background: "rgba(34,197,94,0.12)", color: "#22C55E",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: 12,
                  }}>{i + 1}</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Trial invite inbox */}
          <div className="p-4 rounded-lg text-center space-y-2" style={{ background: "#050D18", border: "1px dashed #1E3A5F" }}>
            <Inbox size={20} style={{ color: "#60A5FA", margin: "0 auto" }} />
            <p className="text-sm font-semibold" style={{ color: "#E2E8F0" }}>No trial invites yet</p>
            <p className="text-xs" style={{ color: "#94A3B8" }}>Scouts are discovering you. Check back soon.</p>
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={goDashboard}
              className="px-5 py-2 rounded-md text-sm font-semibold inline-flex items-center gap-2"
              style={{ background: "#22C55E", color: "#062012", border: "none", boxShadow: "0 6px 20px rgba(34,197,94,0.3)" }}
            >
              Go to Dashboard <ChevronRight size={16} />
            </button>
            <button
              type="button"
              onClick={share}
              className="px-4 py-2 rounded-md text-sm font-semibold inline-flex items-center gap-2"
              style={{ background: "#060E1C", border: "1px solid #1E3A5F", color: "#60A5FA" }}
            >
              <Share2 size={14} /> Share Your Profile
            </button>
          </div>
        </>
      )}

      {error && <p className="text-sm" style={{ color: "#EF4444" }}>{error}</p>}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );

  const backend = (
    <div className="space-y-3 text-sm" style={{ color: "#94A3B8" }}>
      <h3 className="text-base font-semibold" style={{ color: "#E2E8F0" }}>Discovery index</h3>
      <div
        className="p-3 rounded-md font-mono text-xs space-y-1"
        style={{ background: "#050D18", border: "1px solid #1E3A5F", color: "#86EFAC" }}
      >
        <p>Fields: role · sportx_score · age · phase_specialty · district · coach_verified · profile_strength</p>
      </div>
      <p className="text-xs uppercase tracking-widest pt-1" style={{ color: "#64748B" }}>Ranking</p>
      <p className="text-xs" style={{ color: "#94A3B8" }}>
        score + trajectory boost (×1.2) + recency
      </p>
      <p className="text-xs uppercase tracking-widest pt-1" style={{ color: "#64748B" }}>Propagation</p>
      <p className="text-xs" style={{ color: "#94A3B8" }}>
        WebSocket fan-out to scouts within a 60s SLA.
      </p>
      <p className="text-xs pt-2" style={{ color: "#64748B" }}>
        Flips <code>sportx_score.status</code> to <strong>ACTIVE</strong> and <code>elasticsearch_indexed</code> to <strong>true</strong>.
      </p>
    </div>
  );

  return (
    <StepShell
      step={12}
      currentStep={currentStep}
      completedSteps={completedSteps}
      readOnly={readOnly}
      frontend={frontend}
      backend={backend}
      nextLabel="Finish"
      onNext={goDashboard}
    />
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="p-3 rounded-md text-center" style={{ background: "#050D18", border: "1px solid #1E3A5F" }}>
      <p className="text-[10px] uppercase tracking-widest" style={{ color: "#94A3B8" }}>{label}</p>
      <p className="text-xl font-bold font-mono mt-1" style={{ color: "#E2E8F0" }}>{value}</p>
    </div>
  );
}

/** CSS-only confetti burst — 24 pieces falling for ~3 seconds. */
function Confetti() {
  const pieces = Array.from({ length: 24 }, (_, i) => i);
  const colors = ["#22C55E", "#60A5FA", "#F59E0B", "#EC4899", "#A78BFA"];
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 5 }}>
      {pieces.map((i) => {
        const left = (i * 137) % 100;
        const delay = (i % 8) * 0.12;
        const color = colors[i % colors.length];
        return (
          <span
            key={i}
            style={{
              position: "absolute", left: `${left}%`, top: -20,
              width: 8, height: 12, background: color, borderRadius: 1,
              animation: `sxconfetti 3s ease-out ${delay}s forwards`,
              transform: "rotate(0deg)",
            }}
          />
        );
      })}
      <style>{`@keyframes sxconfetti{
        0%{transform:translateY(0) rotate(0deg);opacity:1}
        100%{transform:translateY(560px) rotate(720deg);opacity:0}
      }`}</style>
    </div>
  );
}
