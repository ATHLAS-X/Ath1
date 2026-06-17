"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle, Camera, Youtube, ClipboardPaste, ChevronRight, Video } from "lucide-react";
import StepShell from "@/components/onboarding/StepShell";
import { extractYouTubeId } from "@/lib/youtube";

interface Props {
  currentStep: number;
  completedSteps: number[];
  readOnly: boolean;
}

interface Analysis {
  batting_style: string;
  wrist_movement: string;
  foot_work: string;
  bowling_action: string;
  strong_points: string[];
  weak_points: string[];
  style_classification: string;
  technique_notes: string;
  youtube_video_id: string;
}

const STAGES = [
  "Extracting video frames…",
  "Analysing technique…",
  "Generating report…",
];

export default function StepVideoAI({ currentStep, completedSteps, readOnly }: Props) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  const videoId = useMemo(() => extractYouTubeId(url), [url]);
  const validUrl = !!videoId;

  // Cycle through loading stages every 3s while busy.
  useEffect(() => {
    if (!busy) { setStage(0); return; }
    const t = setInterval(() => setStage((s) => (s + 1) % STAGES.length), 3000);
    return () => clearInterval(t);
  }, [busy]);

  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setUrl(text);
    } catch { /* clipboard may be blocked */ }
  }

  async function analyse() {
    setError(null);
    if (!validUrl) return setError("Paste a valid YouTube URL");
    setBusy(true);
    try {
      const res = await fetch("/api/onboarding/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_url: url }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setError(data?.error ?? "Analysis failed");
        return;
      }
      setAnalysis(data.data);
    } catch (e: any) {
      setError(e?.message ?? "Network error");
    } finally {
      setBusy(false);
    }
  }

  function goNext() {
    router.push("/onboarding/coach-verify");
    return true;
  }

  const frontend = (
    <div className="space-y-5">
      {/* URL field */}
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-2" style={{ color: "#E2E8F0" }}>
          <Youtube size={14} style={{ color: "#EF4444" }} /> YouTube URL
        </label>
        <div className="flex gap-2">
          <input
            type="url"
            placeholder="https://youtube.com/watch?v=…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={readOnly || busy || !!analysis}
            className="flex-1 px-3 py-2 rounded-md"
            style={{ background: "#050D18", border: "1px solid #1E3A5F", color: "#E2E8F0", outline: "none" }}
          />
          <button
            type="button"
            onClick={paste}
            disabled={readOnly || busy}
            className="px-3 py-2 rounded-md text-sm flex items-center gap-1.5"
            style={{ background: "#060E1C", border: "1px solid #1E3A5F", color: "#60A5FA", cursor: "pointer" }}
          >
            <ClipboardPaste size={14} /> Paste
          </button>
        </div>
        {videoId && (
          <div className="flex items-center gap-3 p-2 rounded-md" style={{ background: "#050D18", border: "1px solid #1E3A5F" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
              alt="Video thumbnail"
              style={{ width: 120, height: 68, borderRadius: 4, objectFit: "cover" }}
            />
            <div className="text-xs" style={{ color: "#86EFAC" }}>
              <p className="font-mono">videoId: {videoId}</p>
              <p style={{ color: "#94A3B8" }}>Thumbnail loaded from YouTube</p>
            </div>
          </div>
        )}
      </div>

      {!busy && !analysis && (
        <button
          type="button"
          onClick={analyse}
          disabled={!validUrl || readOnly}
          className="px-5 py-2 rounded-md text-sm font-semibold inline-flex items-center gap-2"
          style={{
            background: validUrl ? "#22C55E" : "#1E3A5F",
            color: validUrl ? "#062012" : "#94A3B8",
            border: "none",
            cursor: validUrl ? "pointer" : "not-allowed",
            boxShadow: validUrl ? "0 6px 20px rgba(34,197,94,0.3)" : "none",
          }}
        >
          <Video size={14} /> Analyse My Technique
        </button>
      )}

      {busy && (
        <div className="p-4 rounded-lg space-y-3" style={{ background: "#050D18", border: "1px solid #1E3A5F" }}>
          <p className="text-sm font-semibold" style={{ color: "#E2E8F0" }}>{STAGES[stage]}</p>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#1E3A5F" }}>
            <div
              style={{
                width: "60%",
                height: "100%",
                background: "linear-gradient(90deg, transparent, #22C55E, transparent)",
                animation: "sxslide 1.4s linear infinite",
              }}
            />
          </div>
          <style>{`@keyframes sxslide{0%{transform:translateX(-100%)}100%{transform:translateX(220%)}}`}</style>
        </div>
      )}

      {analysis && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span
              className="px-3 py-1 rounded-full text-sm font-bold"
              style={{ background: "rgba(96,165,250,0.12)", color: "#60A5FA", border: "1px solid rgba(96,165,250,0.4)" }}
            >
              {analysis.style_classification}
            </span>
            <span
              className="px-2 py-1 rounded text-xs font-bold"
              style={{ background: "#22C55E", color: "#062012" }}
            >
              +2 Profile Completeness pts
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-md" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.3)" }}>
              <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "#86EFAC" }}>Strong Points</p>
              <ul className="space-y-1.5 text-sm">
                {analysis.strong_points.map((s, i) => (
                  <li key={i} className="flex items-start gap-2" style={{ color: "#E2E8F0" }}>
                    <CheckCircle2 size={14} style={{ color: "#22C55E", marginTop: 3 }} /> {s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-3 rounded-md" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.3)" }}>
              <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "#F59E0B" }}>Weak Points</p>
              <ul className="space-y-1.5 text-sm">
                {analysis.weak_points.map((w, i) => (
                  <li key={i} className="flex items-start gap-2" style={{ color: "#E2E8F0" }}>
                    <AlertTriangle size={14} style={{ color: "#F59E0B", marginTop: 3 }} /> {w}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="p-3 rounded-md text-sm" style={{ background: "#050D18", border: "1px solid #1E3A5F", color: "#E2E8F0" }}>
            <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#94A3B8" }}>Technique notes</p>
            <p>{analysis.technique_notes}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: "#94A3B8" }}>
            <Kv k="Batting" v={analysis.batting_style} />
            <Kv k="Wrist" v={analysis.wrist_movement} />
            <Kv k="Footwork" v={analysis.foot_work} />
            <Kv k="Bowling" v={analysis.bowling_action} />
          </div>

          <button
            type="button"
            onClick={goNext}
            className="px-5 py-2 rounded-md text-sm font-semibold inline-flex items-center gap-2"
            style={{ background: "#22C55E", color: "#062012", border: "none", boxShadow: "0 6px 20px rgba(34,197,94,0.3)" }}
          >
            Continue <ChevronRight size={16} />
          </button>
        </div>
      )}

      {error && <p className="text-sm" style={{ color: "#EF4444" }}>{error}</p>}
    </div>
  );

  const backend = (
    <div className="space-y-3 text-sm" style={{ color: "#94A3B8" }}>
      <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: "#E2E8F0" }}>
        <Camera size={16} style={{ color: "#22C55E" }} /> Technique-analysis pipeline
      </h3>
      <div
        className="p-3 rounded-md font-mono text-xs space-y-1"
        style={{ background: "#050D18", border: "1px solid #1E3A5F", color: "#86EFAC" }}
      >
        <p>YouTube URL → Multimodal LLM → JSON analysis</p>
        <p>model: claude-sonnet-4-20250514</p>
      </div>
      <p className="text-xs uppercase tracking-widest pt-1" style={{ color: "#64748B" }}>Output schema</p>
      <ul className="text-xs space-y-0.5 font-mono" style={{ color: "#94A3B8" }}>
        <li>batting_style: string</li>
        <li>wrist_movement: string</li>
        <li>foot_work: string</li>
        <li>bowling_action: string</li>
        <li>strong_points: string[]</li>
        <li>weak_points: string[]</li>
        <li>style_classification: string</li>
        <li>technique_notes: string</li>
      </ul>
      <p className="text-xs pt-2" style={{ color: "#64748B" }}>Persisted to <code>video_analysis</code>.</p>
    </div>
  );

  return (
    <StepShell
      step={9}
      currentStep={currentStep}
      completedSteps={completedSteps}
      readOnly={readOnly}
      frontend={frontend}
      backend={backend}
      nextDisabled={!analysis && !readOnly}
      onNext={goNext}
    />
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="p-2 rounded" style={{ background: "#050D18", border: "1px solid #1E3A5F" }}>
      <p style={{ color: "#64748B" }}>{k}</p>
      <p style={{ color: "#E2E8F0" }}>{v}</p>
    </div>
  );
}

/** Tiny SVG stick figure with a camera positioned in front or side. */
function AngleCard({ label, front = false }: { label: string; front?: boolean }) {
  return (
    <div className="p-3 rounded-md" style={{ background: "#060E1C", border: "1px solid #1E3A5F" }}>
      <svg viewBox="0 0 200 120" className="w-full" height="100">
        {/* batter */}
        <g stroke="#60A5FA" strokeWidth="2" fill="none">
          <circle cx="110" cy="35" r="9" />
          <line x1="110" y1="44" x2="110" y2="78" />
          <line x1="110" y1="55" x2="95" y2="68" />
          <line x1="110" y1="55" x2="125" y2="68" />
          <line x1="110" y1="78" x2="98" y2="105" />
          <line x1="110" y1="78" x2="122" y2="105" />
          {/* bat */}
          <line x1="125" y1="68" x2="140" y2="95" strokeWidth="3" stroke="#86EFAC" />
        </g>
        {/* pitch line */}
        <line x1="20" y1="110" x2="180" y2="110" stroke="#1E3A5F" strokeWidth="1" strokeDasharray="3 3" />
        {/* camera */}
        {front ? (
          <g transform="translate(35,75)">
            <rect width="22" height="14" rx="2" fill="#22C55E" />
            <circle cx="11" cy="7" r="3" fill="#062012" />
            <polygon points="22,3 30,0 30,14 22,11" fill="#22C55E" />
          </g>
        ) : (
          <g transform="translate(160,55)">
            <rect width="22" height="14" rx="2" fill="#22C55E" />
            <circle cx="11" cy="7" r="3" fill="#062012" />
            <polygon points="0,3 -8,0 -8,14 0,11" fill="#22C55E" />
          </g>
        )}
      </svg>
      <p className="text-xs text-center font-semibold" style={{ color: "#86EFAC" }}>{label}</p>
    </div>
  );
}
