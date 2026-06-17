"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Target, Layers, Hand, CheckCircle2, TrendingUp, CircleDot, Shield, Users } from "lucide-react";
import StepShell from "@/components/onboarding/StepShell";

interface Props {
  currentStep: number;
  completedSteps: number[];
  readOnly: boolean;
}

type Role = "Batsman" | "Bowler" | "All-Rounder" | "Wicket-Keeper";
type Batting = "Right" | "Left";
type Bowling =
  | "Right-arm Fast"
  | "Left-arm Pace"
  | "Off-spin"
  | "Leg-spin"
  | "Chinaman"
  | "Does Not Bowl";

const ROLE_CARDS: { value: Role; label: string; icon: React.ReactNode; blurb: string }[] = [
  { value: "Batsman", label: "Batsman", icon: <TrendingUp size={28} />, blurb: "Top, middle, or finishing role" },
  { value: "Bowler", label: "Bowler", icon: <Target size={28} />, blurb: "Pace, spin, or new-ball specialist" },
  { value: "All-Rounder", label: "All-Rounder", icon: <Layers size={28} />, blurb: "Bat + bowl across phases" },
  { value: "Wicket-Keeper", label: "Wicket-Keeper", icon: <Shield size={28} />, blurb: "Glove work + finishing batter" },
];

const BOWLING_OPTS: Bowling[] = [
  "Right-arm Fast",
  "Left-arm Pace",
  "Off-spin",
  "Leg-spin",
  "Chinaman",
  "Does Not Bowl",
];

const PHASES = [
  "Powerplay Opener",
  "Middle-Order Anchor",
  "Death Finisher",
  "Death Bowler",
  "Spinner",
] as const;

function weightSummary(role: Role | null): string {
  switch (role) {
    case "Batsman": return "BPI weighted 60% of Performance";
    case "Bowler": return "CBR weighted 60% of Performance";
    case "All-Rounder": return "BPI 35% + CBR 35%";
    case "Wicket-Keeper": return "Batting + stumping rate";
    default: return "Select a role to preview score weights";
  }
}

export default function StepRole({ currentStep, completedSteps, readOnly }: Props) {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [batting, setBatting] = useState<Batting | null>(null);
  const [bowling, setBowling] = useState<Bowling | "">("");
  const [phases, setPhases] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const canSave = useMemo(
    () => !!role && !!batting && bowling !== "",
    [role, batting, bowling]
  );

  function togglePhase(p: string) {
    setPhases((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  }

  async function save() {
    setError(null);
    if (!canSave) return setError("Pick role, batting hand, and bowling style");
    setBusy(true);
    try {
      const res = await fetch("/api/onboarding/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player_role: role,
          batting_style: batting,
          bowling_style: bowling,
          phase_specialty: phases,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setError(data?.error ?? "Could not save role");
        return;
      }
      setSaved(true);
    } catch (e: any) {
      setError(e?.message ?? "Network error");
    } finally {
      setBusy(false);
    }
  }

  function goNext() {
    router.push("/onboarding/stats");
    return true;
  }

  const frontend = (
    <div className="space-y-5">
      {/* Role cards */}
      <div className="space-y-2">
        <p className="text-sm font-medium" style={{ color: "#E2E8F0" }}>Primary role</p>
        <div className="grid grid-cols-2 gap-3">
          {ROLE_CARDS.map((r) => {
            const active = role === r.value;
            return (
              <button
                key={r.value}
                type="button"
                onClick={() => !readOnly && setRole(r.value)}
                disabled={readOnly}
                className="flex flex-col items-start gap-2 p-4 rounded-lg text-left"
                style={{
                  background: active ? "rgba(34,197,94,0.08)" : "#050D18",
                  border: active ? "2px solid #22C55E" : "1px solid #1E3A5F",
                  color: "#E2E8F0",
                  cursor: readOnly ? "not-allowed" : "pointer",
                  boxShadow: active ? "0 0 24px rgba(34,197,94,0.18)" : "none",
                  transition: "all 150ms ease",
                }}
              >
                <span style={{ color: active ? "#22C55E" : "#60A5FA" }}>{r.icon}</span>
                <span className="font-semibold">{r.label}</span>
                <span className="text-xs" style={{ color: "#94A3B8" }}>{r.blurb}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Batting hand */}
      <div className="space-y-2">
        <p className="text-sm font-medium" style={{ color: "#E2E8F0" }}>Batting hand</p>
        <div className="flex gap-2">
          {(["Right", "Left"] as Batting[]).map((b) => {
            const active = batting === b;
            return (
              <button
                key={b}
                type="button"
                onClick={() => !readOnly && setBatting(b)}
                disabled={readOnly}
                className="px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-2"
                style={{
                  background: active ? "rgba(34,197,94,0.12)" : "#050D18",
                  border: active ? "1px solid #22C55E" : "1px solid #1E3A5F",
                  color: active ? "#22C55E" : "#E2E8F0",
                  cursor: readOnly ? "not-allowed" : "pointer",
                }}
              >
                <Hand size={14} /> {b}-handed
              </button>
            );
          })}
        </div>
      </div>

      {/* Bowling */}
      <div className="space-y-2">
        <p className="text-sm font-medium" style={{ color: "#E2E8F0" }}>Bowling style</p>
        <select
          value={bowling}
          onChange={(e) => setBowling(e.target.value as Bowling)}
          disabled={readOnly}
          className="w-full px-3 py-2 rounded-md"
          style={{ background: "#050D18", border: "1px solid #1E3A5F", color: "#E2E8F0", outline: "none" }}
        >
          <option value="" disabled>Select a bowling style…</option>
          {BOWLING_OPTS.map((b) => (
            <option key={b} value={b} style={{ background: "#050D18" }}>{b}</option>
          ))}
        </select>
      </div>

      {/* Phases */}
      <div className="space-y-2">
        <p className="text-sm font-medium" style={{ color: "#E2E8F0" }}>Phase specialty <span style={{ color: "#64748B" }}>(multi-select)</span></p>
        <div className="flex flex-wrap gap-2">
          {PHASES.map((p) => {
            const active = phases.includes(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => !readOnly && togglePhase(p)}
                disabled={readOnly}
                className="px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5"
                style={{
                  background: active ? "rgba(34,197,94,0.12)" : "#050D18",
                  border: active ? "1px solid #22C55E" : "1px solid #1E3A5F",
                  color: active ? "#86EFAC" : "#94A3B8",
                  cursor: readOnly ? "not-allowed" : "pointer",
                }}
              >
                <CircleDot size={12} /> {p}
              </button>
            );
          })}
        </div>
      </div>

      {!saved ? (
        <button
          type="button"
          onClick={save}
          disabled={!canSave || busy || readOnly}
          className="px-5 py-2 rounded-md text-sm font-semibold"
          style={{
            background: canSave && !busy ? "#22C55E" : "#1E3A5F",
            color: canSave && !busy ? "#062012" : "#94A3B8",
            cursor: canSave && !busy ? "pointer" : "not-allowed",
            border: "none",
            boxShadow: canSave && !busy ? "0 6px 20px rgba(34,197,94,0.3)" : "none",
          }}
        >
          {busy ? "Saving…" : "Save & Continue"}
        </button>
      ) : (
        <div
          className="p-3 rounded-lg flex items-center gap-2"
          style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.4)" }}
        >
          <CheckCircle2 size={18} style={{ color: "#22C55E" }} />
          <p className="text-sm" style={{ color: "#E2E8F0" }}>
            Role saved. Score weights configured for <strong>{role}</strong>.
          </p>
        </div>
      )}

      {error && <p className="text-sm" style={{ color: "#EF4444" }}>{error}</p>}
    </div>
  );

  const backend = (
    <div className="space-y-3 text-sm" style={{ color: "#94A3B8" }}>
      <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: "#E2E8F0" }}>
        <Users size={16} style={{ color: "#22C55E" }} /> Live score-weight preview
      </h3>
      <div
        className="p-3 rounded-md"
        style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.25)" }}
      >
        <p className="text-sm" style={{ color: "#86EFAC" }}>{weightSummary(role)}</p>
      </div>
      <ul className="text-xs space-y-1 mt-2" style={{ color: "#64748B" }}>
        <li><strong>Batsman</strong> — BPI 60%</li>
        <li><strong>Bowler</strong> — CBR 60%</li>
        <li><strong>All-Rounder</strong> — BPI 35% + CBR 35%</li>
        <li><strong>Wicket-Keeper</strong> — Batting + stumping rate</li>
      </ul>
      <p className="text-xs pt-2" style={{ color: "#64748B" }}>
        Persisted to <code>cricket_profile</code> + <code>player_profiles.score_weights</code> (JSONB).
      </p>
    </div>
  );

  return (
    <StepShell
      step={4}
      currentStep={currentStep}
      completedSteps={completedSteps}
      readOnly={readOnly}
      frontend={frontend}
      backend={backend}
      nextDisabled={!saved && !readOnly}
      onNext={goNext}
    />
  );
}
