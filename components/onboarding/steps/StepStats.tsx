"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, BarChart3, Target } from "lucide-react";
import StepShell from "@/components/onboarding/StepShell";
import {
  calculateBPI,
  calculateCBR,
  roadmapGaps,
  BPI_BENCHMARKS,
  CBR_BENCHMARKS,
} from "@/lib/stats-math";

interface Props {
  currentStep: number;
  completedSteps: number[];
  readOnly: boolean;
}

type Format = "T20" | "ODI" | "List-A";
const FORMATS: Format[] = ["T20", "ODI", "List-A"];

interface FormState {
  matches: string;
  innings: string;
  runs: string;
  not_outs: string;
  highest_score: string;
  fifties: string;
  hundreds: string;
  powerplay_sr: string;
  middle_avg: string;
  death_sr: string;
  overs_bowled: string;
  wickets: string;
  economy: string;
  bowl_avg: string;
  bowl_sr: string;
  best_figures: string;
}

const EMPTY: FormState = {
  matches: "", innings: "", runs: "", not_outs: "", highest_score: "", fifties: "", hundreds: "",
  powerplay_sr: "", middle_avg: "", death_sr: "",
  overs_bowled: "", wickets: "", economy: "", bowl_avg: "", bowl_sr: "", best_figures: "",
};

function n(s: string): number { const x = Number(s); return Number.isFinite(x) ? x : 0; }
function maybe(s: string): number | null { if (s === "") return null; const x = Number(s); return Number.isFinite(x) ? x : null; }

function bpiColor(bpi: number) {
  if (bpi >= 28) return "#22C55E";
  if (bpi >= 20) return "#F59E0B";
  return "#EF4444";
}

export default function StepStats({ currentStep, completedSteps, readOnly }: Props) {
  const router = useRouter();
  const [format, setFormat] = useState<Format>("T20");
  const [forms, setForms] = useState<Record<Format, FormState>>({
    T20: { ...EMPTY }, ODI: { ...EMPTY }, "List-A": { ...EMPTY },
  });
  const [role, setRole] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedFormats, setSavedFormats] = useState<Set<Format>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Get role to decide which sections to show.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/onboarding/cricket-profile");
        const data = await res.json().catch(() => null);
        if (!cancelled && data?.data?.player_role) setRole(data.data.player_role);
      } catch { /* leave role null → show everything */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const cur = forms[format];
  function set<K extends keyof FormState>(k: K, v: string) {
    setForms((f) => ({ ...f, [format]: { ...f[format], [k]: v } }));
  }

  const showBatting = !role || role === "Batsman" || role === "All-Rounder" || role === "Wicket-Keeper";
  const showBowling = !role || role === "Bowler" || role === "All-Rounder";

  // Live BPI/CBR from current form values
  const bpi = useMemo(
    () => calculateBPI({
      matches: n(cur.matches), innings: n(cur.innings), runs: n(cur.runs),
      not_outs: n(cur.not_outs), highest_score: n(cur.highest_score),
      fifties: n(cur.fifties), hundreds: n(cur.hundreds),
      powerplay_sr: maybe(cur.powerplay_sr), middle_avg: maybe(cur.middle_avg), death_sr: maybe(cur.death_sr),
    }),
    [cur.runs, cur.innings, cur.not_outs, cur.powerplay_sr, cur.death_sr, cur.matches, cur.highest_score, cur.fifties, cur.hundreds, cur.middle_avg],
  );
  const cbr = useMemo(
    () => calculateCBR({
      overs_bowled: n(cur.overs_bowled), wickets: n(cur.wickets),
      economy: maybe(cur.economy), bowl_avg: maybe(cur.bowl_avg), bowl_sr: maybe(cur.bowl_sr),
      best_figures: cur.best_figures || null,
    }),
    [cur.economy, cur.bowl_avg, cur.bowl_sr, cur.overs_bowled, cur.wickets, cur.best_figures],
  );
  const gaps = useMemo(() => roadmapGaps(bpi, cbr), [bpi, cbr]);

  async function save() {
    setError(null);
    setBusy(true);
    try {
      const payload = { format, ...Object.fromEntries(Object.entries(cur).map(([k, v]) => [k, v === "" ? null : v])) };
      const res = await fetch("/api/onboarding/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setError(data?.error ?? "Could not save stats");
        return;
      }
      setSavedFormats((s) => new Set(s).add(format));
    } catch (e: any) {
      setError(e?.message ?? "Network error");
    } finally {
      setBusy(false);
    }
  }

  function goNext() {
    router.push("/onboarding/match-log");
    return true;
  }

  // (Field component lifted to module scope below — see <StatField />.)

  const frontend = (
    <div className="space-y-5">
      {/* Format tabs */}
      <div className="flex gap-1 p-1 rounded-md" style={{ background: "#050D18", border: "1px solid #1E3A5F" }}>
        {FORMATS.map((f) => {
          const active = f === format;
          const isSaved = savedFormats.has(f);
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              className="flex-1 px-3 py-1.5 rounded text-sm font-semibold flex items-center justify-center gap-1.5"
              style={{
                background: active ? "#1E3A5F" : "transparent",
                color: active ? "#22C55E" : "#94A3B8",
                border: "none",
                cursor: "pointer",
              }}
            >
              {f}
              {isSaved && <CheckCircle2 size={12} style={{ color: "#22C55E" }} />}
            </button>
          );
        })}
      </div>

      {/* Batting */}
      {showBatting && (
        <div className="space-y-3">
          <p className="text-sm font-semibold flex items-center gap-2" style={{ color: "#E2E8F0" }}>
            <BarChart3 size={14} style={{ color: "#60A5FA" }} /> Batting — {format}
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            <StatField value={cur} onChange={set} disabled={readOnly} label="Matches" k="matches" />
            <StatField value={cur} onChange={set} disabled={readOnly} label="Innings" k="innings" />
            <StatField value={cur} onChange={set} disabled={readOnly} label="Runs" k="runs" />
            <StatField value={cur} onChange={set} disabled={readOnly} label="Not-outs" k="not_outs" />
            <StatField value={cur} onChange={set} disabled={readOnly} label="Highest Score" k="highest_score" />
            <StatField value={cur} onChange={set} disabled={readOnly} label="50s" k="fifties" />
            <StatField value={cur} onChange={set} disabled={readOnly} label="100s" k="hundreds" />
          </div>
          <p className="text-xs uppercase tracking-widest pt-1" style={{ color: "#64748B" }}>Phase split</p>
          <div className="grid grid-cols-3 gap-3">
            <StatField value={cur} onChange={set} disabled={readOnly} label="Powerplay SR" k="powerplay_sr" placeholder="e.g. 142.3" />
            <StatField value={cur} onChange={set} disabled={readOnly} label="Middle-overs Avg" k="middle_avg" placeholder="e.g. 38.5" />
            <StatField value={cur} onChange={set} disabled={readOnly} label="Death-overs SR" k="death_sr" placeholder="e.g. 165.0" />
          </div>
        </div>
      )}

      {/* Bowling */}
      {showBowling && (
        <div className="space-y-3">
          <p className="text-sm font-semibold flex items-center gap-2" style={{ color: "#E2E8F0" }}>
            <Target size={14} style={{ color: "#60A5FA" }} /> Bowling — {format}
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            <StatField value={cur} onChange={set} disabled={readOnly} label="Overs Bowled" k="overs_bowled" />
            <StatField value={cur} onChange={set} disabled={readOnly} label="Wickets" k="wickets" />
            <StatField value={cur} onChange={set} disabled={readOnly} label="Economy" k="economy" />
            <StatField value={cur} onChange={set} disabled={readOnly} label="Average" k="bowl_avg" />
            <StatField value={cur} onChange={set} disabled={readOnly} label="Strike Rate" k="bowl_sr" />
            <StatField value={cur} onChange={set} disabled={readOnly} label="Best Figures" k="best_figures" type="text" placeholder="4/22" />
          </div>
        </div>
      )}

      {/* Live BPI preview */}
      <div
        className="p-4 rounded-lg"
        style={{
          background: `rgba(${bpi >= 28 ? "34,197,94" : bpi >= 20 ? "245,158,11" : "239,68,68"},0.06)`,
          border: `1px solid ${bpiColor(bpi)}66`,
        }}
      >
        <p className="text-xs uppercase tracking-widest" style={{ color: "#94A3B8" }}>Live BPI Preview</p>
        <p className="font-mono text-sm mt-1" style={{ color: "#E2E8F0" }}>
          BPI = Avg × (SR / 100) = <strong style={{ color: bpiColor(bpi) }}>{bpi.toFixed(2)}</strong>
        </p>
        <p className="text-xs mt-1" style={{ color: bpiColor(bpi) }}>
          {bpi >= 28 ? "Above state threshold (28)" : bpi >= 20 ? "Between district avg and state threshold" : "Below district average (22)"}
        </p>
      </div>

      {/* Roadmap gap */}
      <div className="p-4 rounded-lg" style={{ background: "#050D18", border: "1px solid #1E3A5F" }}>
        <p className="text-xs uppercase tracking-widest" style={{ color: "#94A3B8" }}>Roadmap gap</p>
        <p className="text-sm mt-2" style={{ color: "#E2E8F0" }}>
          District avg BPI: <strong>{BPI_BENCHMARKS.district.toFixed(1)}</strong> ·
          Your BPI: <strong style={{ color: bpiColor(bpi) }}> {bpi.toFixed(2)}</strong> ·
          State threshold: <strong>{BPI_BENCHMARKS.state.toFixed(1)}</strong> ·
          Gap: <strong style={{ color: gaps.bpi_gap_to_state <= 0 ? "#22C55E" : "#F59E0B" }}>
            {gaps.bpi_gap_to_state > 0 ? `+${gaps.bpi_gap_to_state.toFixed(2)} to close` : "cleared"}
          </strong>
        </p>
        {showBowling && cbr > 0 && (
          <p className="text-sm mt-1" style={{ color: "#E2E8F0" }}>
            CBR: <strong>{cbr.toFixed(2)}</strong> · State: <strong>{CBR_BENCHMARKS.state}</strong> ·
            Gap: <strong style={{ color: gaps.cbr_gap_to_state <= 0 ? "#22C55E" : "#F59E0B" }}>
              {gaps.cbr_gap_to_state > 0 ? `${gaps.cbr_gap_to_state.toFixed(2)} to drop` : "cleared"}
            </strong>
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={save}
        disabled={busy || readOnly}
        className="px-5 py-2 rounded-md text-sm font-semibold"
        style={{
          background: busy || readOnly ? "#1E3A5F" : "#22C55E",
          color: busy || readOnly ? "#94A3B8" : "#062012",
          border: "none",
          cursor: busy || readOnly ? "not-allowed" : "pointer",
          boxShadow: busy || readOnly ? "none" : "0 6px 20px rgba(34,197,94,0.3)",
        }}
      >
        {busy ? "Saving…" : `Save ${format} Stats`}
      </button>

      {error && <p className="text-sm" style={{ color: "#EF4444" }}>{error}</p>}
    </div>
  );

  const backend = (
    <div className="space-y-3 text-sm" style={{ color: "#94A3B8" }}>
      <h3 className="text-base font-semibold" style={{ color: "#E2E8F0" }}>Formulas &amp; benchmarks</h3>
      <div
        className="p-3 rounded-md font-mono text-xs space-y-1"
        style={{ background: "#050D18", border: "1px solid #1E3A5F", color: "#86EFAC" }}
      >
        <p>BPI = Avg × (SR / 100)</p>
        <p>CBR = ∛(Economy × Avg × SR)</p>
      </div>
      <p className="text-xs uppercase tracking-widest pt-1" style={{ color: "#64748B" }}>BPI benchmarks</p>
      <ul className="text-xs space-y-0.5" style={{ color: "#94A3B8" }}>
        <li>IPL — {BPI_BENCHMARKS.ipl}</li>
        <li>National — 35–38</li>
        <li>State — 28–32</li>
        <li>District avg — {BPI_BENCHMARKS.district}</li>
      </ul>
      <p className="text-xs uppercase tracking-widest pt-1" style={{ color: "#64748B" }}>CBR benchmarks</p>
      <ul className="text-xs space-y-0.5" style={{ color: "#94A3B8" }}>
        <li>IPL — {CBR_BENCHMARKS.ipl}</li>
        <li>National — 18–22</li>
        <li>State — 22–26</li>
      </ul>
      <p className="text-xs pt-2" style={{ color: "#64748B" }}>
        Persisted to <code>performance_stats</code> (one row per format) with <code>roadmap_gaps</code> JSONB.
      </p>
    </div>
  );

  return (
    <StepShell
      step={5}
      currentStep={currentStep}
      completedSteps={completedSteps}
      readOnly={readOnly}
      frontend={frontend}
      backend={backend}
      nextDisabled={savedFormats.size === 0 && !readOnly}
      onNext={goNext}
    />
  );
}

const STAT_INPUT_STYLE: React.CSSProperties = {
  background: "#050D18", border: "1px solid #1E3A5F", color: "#E2E8F0",
  padding: "8px 10px", borderRadius: 6, outline: "none", width: "100%", fontSize: 14,
};

/**
 * Module-scoped so it doesn't get re-created on every parent render — which is
 * what was making the inputs lose focus mid-keystroke.
 */
function StatField({
  value, onChange, disabled, label, k, type = "number", placeholder,
}: {
  value: FormState;
  onChange: <K extends keyof FormState>(k: K, v: string) => void;
  disabled: boolean;
  label: string;
  k: keyof FormState;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs" style={{ color: "#94A3B8" }}>
      <span>{label}</span>
      <input
        type={type}
        inputMode={type === "number" ? "decimal" : undefined}
        placeholder={placeholder}
        value={value[k]}
        disabled={disabled}
        onChange={(e) => onChange(k, e.target.value)}
        style={STAT_INPUT_STYLE}
      />
    </label>
  );
}
