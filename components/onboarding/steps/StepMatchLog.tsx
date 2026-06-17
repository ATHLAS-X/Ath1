"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileUp, Image as ImageIcon, AlertCircle, Clock, Database } from "lucide-react";
import StepShell from "@/components/onboarding/StepShell";

interface Props {
  currentStep: number;
  completedSteps: number[];
  readOnly: boolean;
}

type Format = "T20" | "ODI" | "List-A";
type MQI = "DCA League" | "Academy Cup" | "Corporate" | "Trial";

const MQI_WEIGHTS: Record<MQI, number> = {
  "DCA League": 1.0,
  "Academy Cup": 0.7,
  "Corporate": 0.4,
  "Trial": 0.2,
};

interface Match {
  id: string;
  opponent: string;
  match_date: string;
  format: Format | string;
  competition_level: string;
  mqi_tag: string;
  mqi_weight: number | string;
  runs_scored: number | null;
  wickets_taken: number | null;
  scorecard_url: string;
  ocr_status: "PENDING" | "VERIFIED" | "MANUAL_REVIEW" | string;
  verification_pts: number;
  created_at?: string;
}

function ocrBadge(status: string): { bg: string; fg: string; label: string; icon: React.ReactNode } {
  switch (status) {
    case "VERIFIED": return { bg: "rgba(34,197,94,0.12)", fg: "#22C55E", label: "VERIFIED", icon: <CheckCircle2 size={12} /> };
    case "MANUAL_REVIEW": return { bg: "rgba(245,158,11,0.12)", fg: "#F59E0B", label: "MANUAL REVIEW", icon: <AlertCircle size={12} /> };
    default: return { bg: "rgba(148,163,184,0.12)", fg: "var(--muted)", label: "PENDING", icon: <Clock size={12} /> };
  }
}

export default function StepMatchLog({ currentStep, completedSteps, readOnly }: Props) {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [opponent, setOpponent] = useState("");
  const [date, setDate] = useState("");
  const [format, setFormat] = useState<Format>("T20");
  const [comp, setComp] = useState("");
  const [mqi, setMqi] = useState<MQI>("DCA League");
  const [runs, setRuns] = useState("");
  const [wkts, setWkts] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch existing matches
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/onboarding/matches");
        const data = await res.json().catch(() => null);
        if (!cancelled && data?.success) setMatches(data.data.matches ?? []);
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Build a preview thumbnail from the selected file
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreview(null); // PDF — no inline preview
  }, [file]);

  const canSubmit = useMemo(
    () => !!opponent && !!date && !!comp && !!file,
    [opponent, date, comp, file]
  );

  async function add() {
    setError(null);
    if (!canSubmit) return setError("Fill all fields and upload a scorecard");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("opponent", opponent);
      fd.append("match_date", date);
      fd.append("format", format);
      fd.append("competition_level", comp);
      fd.append("mqi_tag", mqi);
      fd.append("runs_scored", runs || "0");
      fd.append("wickets_taken", wkts || "0");
      fd.append("scorecard", file as File);
      const res = await fetch("/api/onboarding/match", { method: "POST", body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setError(data?.error ?? "Could not save match");
        return;
      }
      // Reload list
      const listRes = await fetch("/api/onboarding/matches");
      const listData = await listRes.json().catch(() => null);
      if (listData?.success) setMatches(listData.data.matches ?? []);
      // Reset form
      setOpponent(""); setDate(""); setComp(""); setRuns(""); setWkts(""); setFile(null);
    } catch (e: any) {
      setError(e?.message ?? "Network error");
    } finally {
      setBusy(false);
    }
  }

  function goNext() {
    router.push("/onboarding/fitness");
    return true;
  }

  const inputStyle: React.CSSProperties = {
    background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--text)",
    padding: "8px 10px", borderRadius: 6, outline: "none", width: "100%", fontSize: 14,
  };

  const frontend = (
    <div className="space-y-5">
      {/* Add match form */}
      <div className="p-4 rounded-lg space-y-3" style={{ background: "var(--input-bg)", border: "1px solid var(--border)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Add a match</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--muted)" }}>
            <span>Opponent</span>
            <input value={opponent} onChange={(e) => setOpponent(e.target.value)} disabled={readOnly} style={inputStyle} />
          </label>
          <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--muted)" }}>
            <span>Match date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={readOnly} style={inputStyle} />
          </label>
          <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--muted)" }}>
            <span>Format</span>
            <select value={format} onChange={(e) => setFormat(e.target.value as Format)} disabled={readOnly} style={inputStyle}>
              <option value="T20">T20</option>
              <option value="ODI">ODI</option>
              <option value="List-A">List-A</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--muted)" }}>
            <span>Competition level</span>
            <input value={comp} onChange={(e) => setComp(e.target.value)} disabled={readOnly} placeholder="e.g. U-19 Districts" style={inputStyle} />
          </label>
          <label className="flex flex-col gap-1 text-xs col-span-2" style={{ color: "var(--muted)" }}>
            <span>MQI tag</span>
            <select value={mqi} onChange={(e) => setMqi(e.target.value as MQI)} disabled={readOnly} style={inputStyle}>
              {(Object.keys(MQI_WEIGHTS) as MQI[]).map((t) => (
                <option key={t} value={t}>{t} ({MQI_WEIGHTS[t].toFixed(1)}×)</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--muted)" }}>
            <span>Runs scored</span>
            <input type="number" inputMode="numeric" value={runs} onChange={(e) => setRuns(e.target.value)} disabled={readOnly} style={inputStyle} />
          </label>
          <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--muted)" }}>
            <span>Wickets taken</span>
            <input type="number" inputMode="numeric" value={wkts} onChange={(e) => setWkts(e.target.value)} disabled={readOnly} style={inputStyle} />
          </label>
        </div>

        {/* Scorecard upload */}
        <div className="space-y-2">
          <label
            className="flex items-center gap-3 px-3 py-3 rounded-md cursor-pointer"
            style={{ background: "var(--input-bg)", border: "1px dashed var(--border)", color: "var(--muted)" }}
          >
            <FileUp size={18} style={{ color: "var(--accent)" }} />
            <span className="text-sm flex-1">{file ? file.name : "Upload scorecard (PDF / JPG / PNG)"}</span>
            <input
              type="file"
              accept="image/*,application/pdf"
              disabled={readOnly}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>
          {preview && (
            <div className="rounded-md overflow-hidden" style={{ border: "1px solid var(--border)", maxWidth: 220 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Scorecard preview" style={{ display: "block", width: "100%", height: "auto" }} />
            </div>
          )}
          {file && !preview && (
            <p className="text-xs flex items-center gap-1" style={{ color: "var(--muted)" }}>
              <ImageIcon size={12} /> {file.name} — PDF preview not rendered inline.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={add}
          disabled={!canSubmit || busy || readOnly}
          className="px-4 py-2 rounded-md text-sm font-semibold mt-1"
          style={{
            background: canSubmit && !busy ? "var(--accent)" : "var(--border)",
            color: canSubmit && !busy ? "#000" : "var(--muted)",
            cursor: canSubmit && !busy ? "pointer" : "not-allowed",
            border: "none",
          }}
        >
          {busy ? "Uploading…" : "Add Match"}
        </button>

        {error && <p className="text-sm" style={{ color: "#EF4444" }}>{error}</p>}
      </div>

      {/* Match list */}
      <div className="space-y-2">
        <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
          Logged matches {matches.length > 0 && <span style={{ color: "var(--muted)", fontWeight: 400 }}>({matches.length})</span>}
        </p>
        {matches.length === 0 ? (
          <div className="p-4 rounded-md text-sm text-center" style={{ background: "var(--input-bg)", border: "1px dashed var(--border)", color: "#64748B" }}>
            No matches yet. Add at least one to continue.
          </div>
        ) : (
          <ul className="space-y-2">
            {matches.map((m) => {
              const badge = ocrBadge(m.ocr_status);
              const w = typeof m.mqi_weight === "string" ? Number(m.mqi_weight) : m.mqi_weight;
              return (
                <li
                  key={m.id}
                  className="p-3 rounded-md flex items-start gap-3"
                  style={{ background: "var(--input-bg)", border: "1px solid var(--border)" }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold truncate" style={{ color: "var(--text)" }}>vs {m.opponent}</p>
                      <span className="text-xs" style={{ color: "var(--muted)" }}>{String(m.match_date).slice(0, 10)} · {m.format}</span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                        style={{ background: "rgba(255,255,255,0.08)", color: "var(--accent)", border: "1px solid rgba(255,255,255,0.16)" }}
                      >
                        {m.mqi_tag} ({Number.isFinite(w) ? w.toFixed(1) : w}×)
                      </span>
                    </div>
                    <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                      {m.competition_level} · Runs {m.runs_scored ?? 0} · Wkts {m.wickets_taken ?? 0}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className="text-[10px] px-2 py-1 rounded font-bold flex items-center gap-1"
                      style={{ background: badge.bg, color: badge.fg, border: `1px solid ${badge.fg}55` }}
                    >
                      {badge.icon} {badge.label}
                    </span>
                    {m.verification_pts > 0 && (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded font-bold"
                        style={{ background: "var(--accent)", color: "#000" }}
                      >
                        +{m.verification_pts} pts
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );

  const backend = (
    <div className="space-y-3 text-sm" style={{ color: "var(--muted)" }}>
      <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--text)" }}>
        <Database size={16} style={{ color: "#22C55E" }} /> Match Quality Index
      </h3>
      <div className="rounded-md overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: "rgba(34,197,94,0.08)", color: "#86EFAC" }}>
              <th className="text-left px-3 py-2">Tag</th>
              <th className="text-right px-3 py-2">Weight</th>
            </tr>
          </thead>
          <tbody>
            {(Object.keys(MQI_WEIGHTS) as MQI[]).map((t, i) => (
              <tr key={t} style={{ background: i % 2 ? "var(--input-bg)" : "var(--input-bg)", color: "var(--text)" }}>
                <td className="px-3 py-2">{t}</td>
                <td className="px-3 py-2 text-right font-mono">{MQI_WEIGHTS[t].toFixed(1)}×</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div
        className="p-3 rounded-md font-mono text-xs"
        style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "#86EFAC" }}
      >
        Effective MQI-weighted BPI = Σ(BPI × MQI) / Σ(MQI)
      </div>
      <p className="text-xs pt-2" style={{ color: "#64748B" }}>
        OCR pipeline: &gt; 80% confidence → auto-verified; &lt; 80% → P8 review queue.
      </p>
      <p className="text-xs" style={{ color: "#64748B" }}>
        Persisted to <code>match_logs</code>; +3 <code>verification_pts</code> per verified scorecard.
      </p>
    </div>
  );

  return (
    <StepShell
      step={6}
      currentStep={currentStep}
      completedSteps={completedSteps}
      readOnly={readOnly}
      frontend={frontend}
      backend={backend}
      nextDisabled={matches.length === 0 && !readOnly}
      nextLabel="Continue"
      onNext={goNext}
    />
  );
}
