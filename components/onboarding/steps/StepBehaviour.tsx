"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Lock, Brain, ChevronLeft, ChevronRight } from "lucide-react";
import StepShell from "@/components/onboarding/StepShell";
import { BEHAVIOUR_QUESTIONS } from "@/lib/behaviour-questions";

interface Props {
  currentStep: number;
  completedSteps: number[];
  readOnly: boolean;
}

interface Result {
  strengths: string[];
  gaps: string[];
  mental_rating: number;
  coaching_tip: string;
}

function ringColor(r: number) {
  if (r >= 70) return "#22C55E";
  if (r >= 40) return "#F59E0B";
  return "#EF4444";
}

export default function StepBehaviour({ currentStep, completedSteps, readOnly }: Props) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [freeText, setFreeText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const total = BEHAVIOUR_QUESTIONS.length;
  const showFreeText = idx === total;
  const allAnswered = Object.keys(answers).length === total;
  const wordCount = useMemo(() => freeText.split(/\s+/).filter(Boolean).length, [freeText]);
  const canSubmit = allAnswered && wordCount >= 50;

  function pick(qid: number, letter: string) {
    setAnswers((a) => ({ ...a, [String(qid)]: letter }));
    // auto-advance
    setTimeout(() => setIdx((i) => Math.min(total, i + 1)), 120);
  }

  async function submit() {
    setError(null);
    if (!canSubmit) return setError("Answer all questions and write at least 50 words.");
    setBusy(true);
    try {
      const res = await fetch("/api/onboarding/behaviour", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mcq_answers: answers, free_text: freeText }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setError(data?.error ?? "Could not analyse responses");
        return;
      }
      setResult({
        strengths: data.data.strengths ?? [],
        gaps: data.data.gaps ?? [],
        mental_rating: data.data.mental_rating ?? 0,
        coaching_tip: data.data.coaching_tip ?? "",
      });
    } catch (e: any) {
      setError(e?.message ?? "Network error");
    } finally {
      setBusy(false);
    }
  }

  function goNext() {
    router.push("/onboarding/video-ai");
    return true;
  }

  const q = BEHAVIOUR_QUESTIONS[idx];
  const ringStroke = result ? ringColor(result.mental_rating) : "#22C55E";
  const circumference = 2 * Math.PI * 42;
  const dash = result ? (result.mental_rating / 100) * circumference : 0;

  const frontend = (
    <div className="space-y-5">
      <div
        className="p-3 rounded-lg flex items-center gap-2"
        style={{ background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.25)" }}
      >
        <Lock size={14} style={{ color: "#60A5FA" }} />
        <p className="text-sm" style={{ color: "#E2E8F0" }}>
          Behavioural Assessment — <strong style={{ color: "#60A5FA" }}>private to you</strong>, not shown to scouts.
        </p>
      </div>

      {!result && !busy && !showFreeText && q && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs" style={{ color: "#94A3B8" }}>
            <span>Question {idx + 1} of {total}</span>
            <div className="flex-1 mx-3 h-1 rounded-full" style={{ background: "#1E3A5F" }}>
              <div style={{
                width: `${((idx + 1) / total) * 100}%`,
                height: "100%", background: "#22C55E", borderRadius: 999,
                transition: "width 200ms ease",
              }} />
            </div>
          </div>
          <p className="text-lg font-semibold" style={{ color: "#E2E8F0" }}>{q.prompt}</p>
          <div className="grid grid-cols-1 gap-2">
            {q.options.map((opt) => {
              const active = answers[String(q.id)] === opt.letter;
              return (
                <button
                  key={opt.letter}
                  type="button"
                  onClick={() => !readOnly && pick(q.id, opt.letter)}
                  disabled={readOnly}
                  className="flex items-center gap-3 px-4 py-3 rounded-md text-left"
                  style={{
                    background: active ? "rgba(34,197,94,0.10)" : "#050D18",
                    border: active ? "1px solid #22C55E" : "1px solid #1E3A5F",
                    color: "#E2E8F0",
                    cursor: readOnly ? "not-allowed" : "pointer",
                  }}
                >
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm"
                    style={{
                      background: active ? "#22C55E" : "#1E3A5F",
                      color: active ? "#062012" : "#94A3B8",
                    }}
                  >
                    {opt.letter}
                  </span>
                  <span className="text-sm">{opt.text}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIdx((i) => Math.max(0, i - 1))}
              disabled={idx === 0}
              className="flex items-center gap-1 text-sm"
              style={{ color: idx === 0 ? "#475569" : "#94A3B8", cursor: idx === 0 ? "not-allowed" : "pointer" }}
            >
              <ChevronLeft size={14} /> Back
            </button>
            <button
              type="button"
              onClick={() => setIdx((i) => Math.min(total, i + 1))}
              disabled={!answers[String(q.id)]}
              className="flex items-center gap-1 text-sm"
              style={{ color: answers[String(q.id)] ? "#60A5FA" : "#475569", cursor: answers[String(q.id)] ? "pointer" : "not-allowed" }}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {!result && !busy && showFreeText && (
        <div className="space-y-3">
          <p className="text-lg font-semibold" style={{ color: "#E2E8F0" }}>
            Describe a match moment that showed your leadership or composure.
          </p>
          <p className="text-xs" style={{ color: "#94A3B8" }}>Minimum 50 words.</p>
          <textarea
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            rows={6}
            disabled={readOnly}
            placeholder="Set the scene, what was at stake, and what you did and why..."
            className="w-full px-3 py-2 rounded-md text-sm"
            style={{ background: "#050D18", border: "1px solid #1E3A5F", color: "#E2E8F0", outline: "none" }}
          />
          <div className="flex items-center justify-between text-xs">
            <span style={{ color: wordCount >= 50 ? "#86EFAC" : "#94A3B8" }}>
              {wordCount} / 50 words
            </span>
            <button
              type="button"
              onClick={() => setIdx(total - 1)}
              className="flex items-center gap-1"
              style={{ color: "#94A3B8" }}
            >
              <ChevronLeft size={14} /> Back to questions
            </button>
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit || busy || readOnly}
            className="px-5 py-2 rounded-md text-sm font-semibold"
            style={{
              background: canSubmit && !busy ? "#22C55E" : "#1E3A5F",
              color: canSubmit && !busy ? "#062012" : "#94A3B8",
              border: "none",
              cursor: canSubmit && !busy ? "pointer" : "not-allowed",
              boxShadow: canSubmit && !busy ? "0 6px 20px rgba(34,197,94,0.3)" : "none",
            }}
          >
            Submit for Analysis
          </button>
        </div>
      )}

      {busy && (
        <div className="py-10 text-center space-y-3">
          <Loader2 className="inline-block animate-spin" size={28} style={{ color: "#22C55E" }} />
          <p style={{ color: "#94A3B8" }}>Analysing your responses…</p>
        </div>
      )}

      {result && (
        <div className="space-y-5">
          <div className="flex items-center gap-5 p-4 rounded-lg" style={{ background: "#050D18", border: "1px solid #1E3A5F" }}>
            <svg width="120" height="120" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#1E3A5F" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="42" fill="none"
                stroke={ringStroke} strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${dash} ${circumference - dash}`}
                transform="rotate(-90 50 50)"
              />
              <text x="50" y="55" textAnchor="middle" fontSize="22" fontWeight="700" fill={ringStroke} fontFamily="ui-monospace">
                {result.mental_rating}
              </text>
            </svg>
            <div>
              <p className="text-xs uppercase tracking-widest" style={{ color: "#94A3B8" }}>Mental Rating</p>
              <p className="text-sm mt-1" style={{ color: "#E2E8F0" }}>
                Private profile of how you handle pressure, feedback, and adaptation.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-md" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.25)" }}>
              <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "#86EFAC" }}>Strengths</p>
              <ul className="space-y-1 text-sm">
                {result.strengths.slice(0, 3).map((s, i) => (
                  <li key={i} className="flex items-start gap-2" style={{ color: "#E2E8F0" }}>
                    <CheckCircle2 size={14} style={{ color: "#22C55E", marginTop: 3 }} /> {s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-3 rounded-md" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.25)" }}>
              <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "#F59E0B" }}>Growth areas</p>
              <ul className="space-y-1 text-sm">
                {result.gaps.slice(0, 2).map((g, i) => (
                  <li key={i} className="flex items-start gap-2" style={{ color: "#E2E8F0" }}>
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: "#F59E0B", marginTop: 6 }} /> {g}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="p-3 rounded-md" style={{ background: "#050D18", border: "1px solid #1E3A5F" }}>
            <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#60A5FA" }}>Coaching tip</p>
            <p className="text-sm" style={{ color: "#E2E8F0" }}>{result.coaching_tip}</p>
          </div>

          <button
            type="button"
            onClick={goNext}
            className="px-5 py-2 rounded-md text-sm font-semibold inline-flex items-center gap-2"
            style={{
              background: "#22C55E", color: "#062012", border: "none",
              boxShadow: "0 6px 20px rgba(34,197,94,0.3)",
            }}
          >
            Continue to Video Analysis <ChevronRight size={16} />
          </button>
        </div>
      )}

      {error && <p className="text-sm" style={{ color: "#EF4444" }}>{error}</p>}
    </div>
  );

  const backend = (
    <div className="space-y-3 text-sm" style={{ color: "#94A3B8" }}>
      <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: "#E2E8F0" }}>
        <Brain size={16} style={{ color: "#22C55E" }} /> Mindset analyser
      </h3>
      <div
        className="p-3 rounded-md font-mono text-xs space-y-1"
        style={{ background: "#050D18", border: "1px solid #1E3A5F", color: "#86EFAC" }}
      >
        <p>model: claude-sonnet-4-20250514</p>
        <p>system: cricket sports psychologist</p>
        <p>returns: strengths[], gaps[], mental_rating (0–100), coaching_tip</p>
      </div>
      <p className="text-xs" style={{ color: "#94A3B8" }}>
        MCQ patterns + free text feed the model. If <code>ANTHROPIC_API_KEY</code> is unset the API falls back to a deterministic
        rule-based analysis so the flow still completes.
      </p>
      <p className="text-xs" style={{ color: "#86EFAC" }}>
        Mindset contributes <strong>10%</strong> of your SportX Score.
      </p>
      <p className="text-xs" style={{ color: "#64748B" }}>Persisted to <code>behavioral_assessment</code>.</p>
    </div>
  );

  return (
    <StepShell
      step={8}
      currentStep={currentStep}
      completedSteps={completedSteps}
      readOnly={readOnly}
      frontend={frontend}
      backend={backend}
      nextDisabled={!result && !readOnly}
      onNext={goNext}
    />
  );
}
