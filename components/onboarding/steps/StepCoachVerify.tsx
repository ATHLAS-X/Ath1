"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ShieldCheck, Mail, Clock, AlertTriangle, ChevronRight, Copy, Send } from "lucide-react";
import StepShell from "@/components/onboarding/StepShell";

interface Props {
  currentStep: number;
  completedSteps: number[];
  readOnly: boolean;
}

type Strength = "STRONG" | "MID" | "WEAK";

interface Status {
  coach_verified: boolean;
  invites: Array<{ coach_name: string; coach_email: string; status: string; created_at: string }>;
  coaches: Array<{ coach_name: string; academy_club: string; coach_status: string; created_at: string }>;
  items: { matches: number; videos: number; fitness: number; total: number };
  profile_strength: Strength;
}

export default function StepCoachVerify({ currentStep, completedSteps, readOnly }: Props) {
  const router = useRouter();
  const [coachName, setCoachName] = useState("");
  const [coachEmail, setCoachEmail] = useState("");
  const [coachPhone, setCoachPhone] = useState("");
  const [skipped, setSkipped] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);

  // Poll status every 3s while we're awaiting approval.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/onboarding/coach/status");
        const data = await res.json().catch(() => null);
        if (!cancelled && data?.success) setStatus(data.data);
      } catch { /* swallow */ }
    }
    load();
    const t = setInterval(load, 3000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(coachEmail);
  const canInvite = !skipped && !!coachName && validEmail;

  async function invite() {
    setError(null);
    if (!canInvite) return setError("Coach name and a valid email are required");
    setBusy(true);
    try {
      const res = await fetch("/api/onboarding/coach/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coach_name: coachName, coach_email: coachEmail, coach_phone: coachPhone || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setError(data?.error ?? "Could not send invite");
        return;
      }
      setInviteUrl(data.data.invite_url);
    } catch (e: any) {
      setError(e?.message ?? "Network error");
    } finally {
      setBusy(false);
    }
  }

  async function skip() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/onboarding/coach/skip", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setError(data?.error ?? "Could not skip");
        return;
      }
      setSkipped(true);
    } catch (e: any) {
      setError(e?.message ?? "Network error");
    } finally {
      setBusy(false);
    }
  }

  function copyLink() {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl).catch(() => {});
  }

  function goNext() {
    router.push("/onboarding/score");
    return true;
  }

  const lastInvite = status?.invites?.[0];
  const lastCoach = status?.coaches?.[0];
  const verified = !!status?.coach_verified;
  const pending = !verified && (status?.coaches?.some((c) => c.coach_status === "PENDING_REVIEW") || !!lastInvite);

  const strength: Strength = status?.profile_strength ?? "WEAK";
  const strengthMeta: Record<Strength, { color: string; label: string; icon: React.ReactNode; blurb: string }> = {
    STRONG: { color: "#22C55E", label: "STRONG", icon: <CheckCircle2 size={14} />, blurb: "Coach verified · 3+ items" },
    MID:    { color: "#F59E0B", label: "MID",    icon: <Clock size={14} />,        blurb: "Coach verified · 1–2 items" },
    WEAK:   { color: "#EF4444", label: "WEAK",   icon: <AlertTriangle size={14} />, blurb: "No coach yet — discovery via score > 60" },
  };

  const frontend = (
    <div className="space-y-5">
      {/* Intro */}
      <div className="p-4 rounded-lg" style={{ background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.25)" }}>
        <p className="text-sm" style={{ color: "#E2E8F0" }}>
          Coach verification unlocks your profile for <strong style={{ color: "#60A5FA" }}>scout discovery</strong>.
        </p>
      </div>

      {/* Invite form OR "no coach" state */}
      {!skipped ? (
        <div className="p-4 rounded-lg space-y-3" style={{ background: "#050D18", border: "1px solid #1E3A5F" }}>
          <p className="text-sm font-semibold flex items-center gap-2" style={{ color: "#E2E8F0" }}>
            <Mail size={14} style={{ color: "#60A5FA" }} /> Invite your coach
          </p>
          <input
            placeholder="Coach name"
            value={coachName}
            onChange={(e) => setCoachName(e.target.value)}
            disabled={readOnly || !!inviteUrl}
            className="w-full px-3 py-2 rounded-md"
            style={{ background: "#060E1C", border: "1px solid #1E3A5F", color: "#E2E8F0", outline: "none" }}
          />
          <input
            type="email"
            placeholder="Coach email"
            value={coachEmail}
            onChange={(e) => setCoachEmail(e.target.value)}
            disabled={readOnly || !!inviteUrl}
            className="w-full px-3 py-2 rounded-md"
            style={{ background: "#060E1C", border: "1px solid #1E3A5F", color: "#E2E8F0", outline: "none" }}
          />
          <input
            type="tel"
            placeholder="Coach phone (optional)"
            value={coachPhone}
            onChange={(e) => setCoachPhone(e.target.value)}
            disabled={readOnly || !!inviteUrl}
            className="w-full px-3 py-2 rounded-md"
            style={{ background: "#060E1C", border: "1px solid #1E3A5F", color: "#E2E8F0", outline: "none" }}
          />
          {!inviteUrl ? (
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={invite}
                disabled={!canInvite || busy || readOnly}
                className="px-4 py-2 rounded-md text-sm font-semibold inline-flex items-center gap-2"
                style={{
                  background: canInvite && !busy ? "#22C55E" : "#1E3A5F",
                  color: canInvite && !busy ? "#062012" : "#94A3B8",
                  cursor: canInvite && !busy ? "pointer" : "not-allowed",
                  border: "none",
                }}
              >
                <Send size={14} /> {busy ? "Sending…" : "Send Invite"}
              </button>
              <button
                type="button"
                onClick={skip}
                disabled={busy || readOnly}
                className="text-sm underline"
                style={{ color: "#94A3B8" }}
              >
                I don&rsquo;t have a coach yet
              </button>
            </div>
          ) : (
            <div className="p-3 rounded-md" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.3)" }}>
              <p className="text-sm" style={{ color: "#E2E8F0" }}>
                Invitation sent! Share this link with your coach if the email doesn&rsquo;t arrive:
              </p>
              <div className="flex items-center gap-2 mt-2">
                <code className="flex-1 px-2 py-1 rounded text-xs" style={{ background: "#050D18", color: "#86EFAC", border: "1px solid #1E3A5F", overflow: "auto" }}>
                  {inviteUrl}
                </code>
                <button
                  type="button"
                  onClick={copyLink}
                  className="px-2 py-1 rounded text-xs flex items-center gap-1"
                  style={{ background: "#060E1C", border: "1px solid #1E3A5F", color: "#60A5FA" }}
                >
                  <Copy size={12} /> Copy
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 rounded-lg" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.3)" }}>
          <p className="text-sm" style={{ color: "#E2E8F0" }}>
            No coach yet. Your profile will be discoverable once your AthlasX Score exceeds <strong style={{ color: "#F59E0B" }}>60</strong>.
          </p>
        </div>
      )}

      {/* Verification status */}
      <div className="p-4 rounded-lg space-y-2" style={{ background: "#050D18", border: "1px solid #1E3A5F" }}>
        <p className="text-xs uppercase tracking-widest" style={{ color: "#94A3B8" }}>Verification status</p>
        {verified ? (
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: "#22C55E" }}>
              <CheckCircle2 size={16} /> VERIFIED ✅ Coach confirmed
              {lastCoach && <span style={{ color: "#94A3B8", fontWeight: 400 }}>· {lastCoach.coach_name} @ {lastCoach.academy_club}</span>}
            </span>
            <span className="px-2 py-1 rounded text-xs font-bold" style={{ background: "#22C55E", color: "#062012" }}>+5 pts</span>
          </div>
        ) : pending ? (
          <span className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: "#F59E0B" }}>
            <Clock size={16} /> Coach invite sent — awaiting registration
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 text-sm" style={{ color: "#94A3B8" }}>
            <Clock size={16} /> No coach invited yet
          </span>
        )}
      </div>

      {/* Profile strength */}
      <div className="p-4 rounded-lg" style={{ background: "#050D18", border: "1px solid #1E3A5F" }}>
        <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "#94A3B8" }}>Profile Strength</p>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold"
            style={{
              background: `${strengthMeta[strength].color}1A`,
              color: strengthMeta[strength].color,
              border: `1px solid ${strengthMeta[strength].color}55`,
            }}
          >
            {strengthMeta[strength].icon} {strengthMeta[strength].label}
          </span>
          <span className="text-xs" style={{ color: "#94A3B8" }}>{strengthMeta[strength].blurb}</span>
        </div>
        {status && (
          <p className="text-xs mt-3" style={{ color: "#64748B" }}>
            Items: matches {status.items.matches} · videos {status.items.videos} · fitness {status.items.fitness}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={goNext}
        className="px-5 py-2 rounded-md text-sm font-semibold inline-flex items-center gap-2"
        style={{ background: "#22C55E", color: "#062012", border: "none", boxShadow: "0 6px 20px rgba(34,197,94,0.3)" }}
      >
        Continue to Score <ChevronRight size={16} />
      </button>

      {error && <p className="text-sm" style={{ color: "#EF4444" }}>{error}</p>}
    </div>
  );

  const backend = (
    <div className="space-y-3 text-sm" style={{ color: "#94A3B8" }}>
      <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: "#E2E8F0" }}>
        <ShieldCheck size={16} style={{ color: "#22C55E" }} /> Coach verification logic
      </h3>
      <div
        className="p-3 rounded-md font-mono text-xs space-y-1"
        style={{ background: "#050D18", border: "1px solid #1E3A5F", color: "#86EFAC" }}
      >
        <p>coach_verified:true  →  +5 verification points</p>
        <p>discoverable WHEN coach_verified OR score &gt; 60</p>
        <p>coach cert →  P8 manual review within 72h</p>
      </div>
      <ul className="text-xs space-y-1" style={{ color: "#94A3B8" }}>
        <li><strong style={{ color: "#22C55E" }}>STRONG</strong> — coach verified + 3+ items</li>
        <li><strong style={{ color: "#F59E0B" }}>MID</strong> — coach verified + 1–2 items</li>
        <li><strong style={{ color: "#EF4444" }}>WEAK</strong> — no coach yet</li>
      </ul>
      <p className="text-xs pt-2" style={{ color: "#64748B" }}>
        Persisted to <code>coach_invites</code>, <code>coach_registry</code>, and <code>player_profiles.coach_verified</code>.
      </p>
    </div>
  );

  return (
    <StepShell
      step={10}
      currentStep={currentStep}
      completedSteps={completedSteps}
      readOnly={readOnly}
      frontend={frontend}
      backend={backend}
      onNext={goNext}
    />
  );
}
