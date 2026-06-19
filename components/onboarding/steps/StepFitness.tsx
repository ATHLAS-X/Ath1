"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileUp, Activity, AlertTriangle, Heart, Timer, Dumbbell, Wind } from "lucide-react";
import StepShell from "@/components/onboarding/StepShell";
import { calculateFitness, bmiFrom, parseMmSs } from "@/lib/fitness-math";

interface Props {
  currentStep: number;
  completedSteps: number[];
  readOnly: boolean;
}

function num(s: string): number | null {
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function ringColor(score: number) {
  if (score >= 70) return "#22C55E";
  if (score >= 40) return "#F59E0B";
  return "#EF4444";
}

export default function StepFitness({ currentStep, completedSteps, readOnly }: Props) {
  const router = useRouter();
  const [sprint, setSprint] = useState("");
  const [pushups, setPushups] = useState("");
  const [rhr, setRhr] = useState("");
  const [yoyo, setYoyo] = useState("");
  const [run, setRun] = useState(""); // mm:ss
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [cert, setCert] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const runSeconds = useMemo(() => parseMmSs(run), [run]);
  const bmi = useMemo(() => bmiFrom(num(height), num(weight)), [height, weight]);

  const breakdown = useMemo(() => calculateFitness({
    sprint: num(sprint),
    pushups: num(pushups),
    rhr: num(rhr),
    yoyo: num(yoyo),
    run2km: runSeconds,
    height: num(height),
    weight: num(weight),
  }), [sprint, pushups, rhr, yoyo, runSeconds, height, weight]);

  const advisory = (bmi != null && bmi > 32) || (num(sprint) != null && (num(sprint) as number) > 5.5);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      if (sprint) fd.append("sprint_time", sprint);
      if (pushups) fd.append("pushups_60s", pushups);
      if (rhr) fd.append("resting_hr_bpm", rhr);
      if (yoyo) fd.append("yoyo_level", yoyo);
      if (runSeconds != null) fd.append("run_2km_seconds", String(runSeconds));
      if (height) fd.append("height_cm", height);
      if (weight) fd.append("weight_kg", weight);
      if (cert) fd.append("medical_cert", cert);
      const res = await fetch("/api/onboarding/fitness", { method: "POST", body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setError(data?.error ?? "Could not save fitness data");
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
    router.push("/onboarding/behaviour");
    return true;
  }

  const inputStyle: React.CSSProperties = {
    background: "#050D18", border: "1px solid #1E3A5F", color: "#E2E8F0",
    padding: "8px 10px", borderRadius: 6, outline: "none", width: "100%", fontSize: 14,
  };

  // (Field is module-scoped below as FitField — see end of file.)

  const score = breakdown.fitnessScore;
  const ringStroke = ringColor(score);
  const circumference = 2 * Math.PI * 42;
  const dash = (score / 100) * circumference;

  const frontend = (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FitField disabled={readOnly} inputStyle={inputStyle}
          label="30m Sprint (seconds)"
          hint="Excellent < 4.3s · Good < 4.7s · Needs work > 5.2s"
          value={sprint} onChange={setSprint}
          icon={<Timer size={12} style={{ color: "#60A5FA" }} />}
          placeholder="e.g. 4.6"
        />
        <FitField disabled={readOnly} inputStyle={inputStyle}
          label="Push-ups in 60s"
          hint="IPL standard: 55+ · Domestic: 40+ · District: 30+"
          value={pushups} onChange={setPushups}
          icon={<Dumbbell size={12} style={{ color: "#60A5FA" }} />}
          placeholder="e.g. 42"
          inputMode="numeric"
        />
        <FitField disabled={readOnly} inputStyle={inputStyle}
          label="Resting Heart Rate (BPM)"
          hint="Fit: < 60 · Average: 60–80 · Concern: > 85"
          value={rhr} onChange={setRhr}
          icon={<Heart size={12} style={{ color: "#60A5FA" }} />}
          placeholder="e.g. 58"
          inputMode="numeric"
        />
        <FitField disabled={readOnly} inputStyle={inputStyle}
          label="Yo-Yo Test Level"
          hint="IPL: > 16.1 · Domestic: > 13.5 · Below avg: < 11"
          value={yoyo} onChange={setYoyo}
          icon={<Activity size={12} style={{ color: "#60A5FA" }} />}
          placeholder="e.g. 14.5"
        />
        <FitField disabled={readOnly} inputStyle={inputStyle}
          label="2km Run Time (mm:ss)"
          hint="NCA excellent: < 7:30 · Good: < 8:00 · Min: < 8:30"
          value={run} onChange={setRun}
          icon={<Wind size={12} style={{ color: "#60A5FA" }} />}
          placeholder="e.g. 7:42"
          type="text"
          inputMode="text"
        />
        <div className="grid grid-cols-2 gap-2">
          <FitField disabled={readOnly} inputStyle={inputStyle}
            label="Height (cm)" hint="BMI is auto-calculated"
            value={height} onChange={setHeight}
            icon={<span style={{ color: "#60A5FA" }}>↕</span>}
            placeholder="e.g. 175"
          />
          <FitField disabled={readOnly} inputStyle={inputStyle}
            label="Weight (kg)" hint=" "
            value={weight} onChange={setWeight}
            icon={<span style={{ color: "#60A5FA" }}>⚖</span>}
            placeholder="e.g. 70"
          />
        </div>
      </div>

      {/* BMI readout */}
      <div className="p-3 rounded-md flex items-center justify-between" style={{ background: "#050D18", border: "1px solid #1E3A5F" }}>
        <span className="text-sm" style={{ color: "#94A3B8" }}>BMI</span>
        <span className="text-lg font-mono font-bold" style={{ color: bmi == null ? "#475569" : bmi > 32 ? "#EF4444" : "#86EFAC" }}>
          {bmi == null ? "—" : bmi.toFixed(1)}
        </span>
      </div>

      {/* Medical cert upload */}
      <div className="space-y-2">
        <label
          className="flex items-center gap-3 px-3 py-3 rounded-md cursor-pointer"
          style={{ background: "#050D18", border: "1px dashed #1E3A5F", color: "#94A3B8" }}
        >
          <FileUp size={18} style={{ color: "#60A5FA" }} />
          <span className="text-sm flex-1">{cert ? cert.name : "Medical certificate (PDF or image)"}</span>
          <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: "#1E3A5F", color: "#94A3B8" }}>
            Optional but recommended
          </span>
          <input
            type="file"
            accept="image/*,application/pdf"
            disabled={readOnly}
            onChange={(e) => setCert(e.target.files?.[0] ?? null)}
            className="hidden"
          />
        </label>
      </div>

      {/* Live fitness score ring */}
      <div className="p-4 rounded-lg flex items-center gap-5" style={{ background: "#050D18", border: "1px solid #1E3A5F" }}>
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke="#1E3A5F" strokeWidth="8" />
          <circle
            cx="50" cy="50" r="42" fill="none"
            stroke={ringStroke} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference - dash}`}
            transform="rotate(-90 50 50)"
            style={{ transition: "stroke-dasharray 300ms ease, stroke 200ms ease" }}
          />
          <text x="50" y="55" textAnchor="middle" fontSize="22" fontWeight="700" fill={ringStroke} fontFamily="ui-monospace">
            {score}
          </text>
        </svg>
        <div className="flex-1 space-y-1">
          <p className="text-xs uppercase tracking-widest" style={{ color: "#94A3B8" }}>Live Fitness Score</p>
          <p className="text-sm" style={{ color: "#E2E8F0" }}>
            Weighted of <strong>Sprint 25%</strong> + Push-ups 20% + Endurance 25% + BMI 15% + Resting HR 15%.
          </p>
          <p className="text-xs" style={{ color: ringStroke }}>
            {score >= 70 ? "Strong fitness profile" : score >= 40 ? "Room to improve" : "Below district fitness"}
          </p>
        </div>
      </div>

      {advisory && (
        <div
          className="p-4 rounded-lg flex items-start gap-3"
          style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.4)" }}
        >
          <AlertTriangle size={20} style={{ color: "#F59E0B", marginTop: 1 }} />
          <div className="space-y-1">
            <p className="font-semibold" style={{ color: "#E2E8F0" }}>Fitness Improvement Plan recommended</p>
            <p className="text-sm" style={{ color: "#94A3B8" }}>
              {bmi != null && bmi > 32 ? `BMI ${bmi.toFixed(1)} is above 32. ` : ""}
              {num(sprint) != null && (num(sprint) as number) > 5.5 ? `Sprint ${sprint}s is above the 5.5s threshold. ` : ""}
              We'll add a coach-led plan to your dashboard after onboarding.
            </p>
          </div>
        </div>
      )}

      {!saved ? (
        <button
          type="button"
          onClick={submit}
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
          {busy ? "Saving…" : "Submit Fitness Data"}
        </button>
      ) : (
        <div
          className="p-3 rounded-lg flex items-center gap-2"
          style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.4)" }}
        >
          <CheckCircle2 size={18} style={{ color: "#22C55E" }} />
          <p className="text-sm" style={{ color: "#E2E8F0" }}>
            Fitness data saved. Score: <strong style={{ color: ringStroke }}>{score}/100</strong>.
          </p>
        </div>
      )}

      {error && <p className="text-sm" style={{ color: "#EF4444" }}>{error}</p>}
    </div>
  );

  const backend = (
    <div className="space-y-3 text-sm" style={{ color: "#94A3B8" }}>
      <h3 className="text-base font-semibold" style={{ color: "#E2E8F0" }}>BCCI U-19 fitness benchmarks</h3>
      <div className="rounded-md overflow-hidden" style={{ border: "1px solid #1E3A5F" }}>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: "rgba(34,197,94,0.08)", color: "#86EFAC" }}>
              <th className="text-left px-3 py-2">Metric</th>
              <th className="px-2 py-2">Excellent</th>
              <th className="px-2 py-2">Good</th>
              <th className="px-2 py-2">Needs work</th>
            </tr>
          </thead>
          <tbody style={{ color: "#E2E8F0" }}>
            {[
              ["30m Sprint", "< 4.3s", "< 4.7s", "> 5.2s"],
              ["Push-ups / 60s", "55+", "40+", "30+"],
              ["Yo-Yo", "> 16.1", "> 13.5", "< 11"],
              ["BMI", "21–24", "19–26", "> 28"],
            ].map((row, i) => (
              <tr key={row[0]} style={{ background: i % 2 ? "#050D18" : "#060E1C" }}>
                {row.map((cell, j) => (
                  <td key={j} className={j === 0 ? "text-left px-3 py-2" : "text-center px-2 py-2 font-mono"}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs" style={{ color: "#86EFAC" }}>
        Fitness contributes <strong>15%</strong> of your AthlasX Score.
      </p>
      <p className="text-xs" style={{ color: "#64748B" }}>Persisted to <code>fitness_data</code>.</p>
    </div>
  );

  return (
    <StepShell
      step={7}
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

/**
 * Module-scoped field component so React keeps the underlying <input>
 * mounted across the parent's re-renders — otherwise the cursor jumps mid-typing.
 */
function FitField({
  label, hint, value, onChange, icon, placeholder, type = "number",
  inputMode, disabled, inputStyle,
}: {
  label: string; hint: string; value: string; onChange: (v: string) => void;
  icon: React.ReactNode; placeholder?: string; type?: string;
  inputMode?: "decimal" | "numeric" | "text";
  disabled: boolean;
  inputStyle: React.CSSProperties;
}) {
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "#E2E8F0" }}>
        {icon}{label}
      </label>
      <input
        type={type}
        inputMode={inputMode ?? (type === "number" ? "decimal" : undefined)}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={inputStyle}
      />
      <p className="text-[10px]" style={{ color: "#64748B" }}>{hint}</p>
    </div>
  );
}
