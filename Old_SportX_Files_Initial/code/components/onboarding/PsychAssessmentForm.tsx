"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import type { QuestionBank, PsychSubmissionPayload, ScenarioResponse } from "@/lib/types/psychology";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEPS = [
  { label: "ACSI-28", desc: "Rate each statement honestly" },
  { label: "Situations", desc: "10 match scenarios" },
  { label: "Reflection", desc: "5 open-ended questions" },
  { label: "Review", desc: "Confirm and submit" },
] as const;

const LIKERT_OPTIONS = [
  { value: 1, label: "Almost Never" },
  { value: 2, label: "Sometimes" },
  { value: 3, label: "Often" },
  { value: 4, label: "Almost Always" },
];

type FormStep = 0 | 1 | 2 | 3;
type Phase = "loading" | "form" | "submitting" | "polling" | "complete" | "error";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PsychAssessmentForm({ userName }: { userName: string }) {
  // Question bank
  const [bank, setBank] = useState<QuestionBank | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form step
  const [step, setStep] = useState<FormStep>(0);

  // ACSI-28 + lie scale answers (item number → 1-4)
  const [acsiAnswers, setAcsiAnswers] = useState<Record<number, number>>({});
  const [lieAnswers, setLieAnswers] = useState<number[]>([]);

  // Scenario answers
  const [scenarioAnswers, setScenarioAnswers] = useState<Record<string, ScenarioResponse>>({});

  // Open-ended answers
  const [openAnswers, setOpenAnswers] = useState<Record<string, string>>({});

  // Consent
  const [consentChecked, setConsentChecked] = useState(false);

  // Submission state
  const [phase, setPhase] = useState<Phase>("loading");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [startTime] = useState(() => Date.now());

  // ── Load question bank ────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/onboarding/behaviour/questionnaire")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data) {
          setBank(data.data);
          setPhase("form");
        } else {
          setLoadError(data.error ?? "Failed to load questionnaire");
        }
      })
      .catch((e) => setLoadError(e?.message ?? "Network error"));
  }, []);

  // ── Subscale groups (memoized) ────────────────────────────────────────
  const subscaleGroups = useMemo(() => {
    if (!bank) return [];
    const groups: { name: string; key: string; items: typeof bank.acsi_items }[] = [];
    const seen = new Set<string>();
    for (const item of bank.acsi_items) {
      if (!seen.has(item.subscale)) {
        seen.add(item.subscale);
        const def = bank.subscales[item.subscale];
        groups.push({
          key: item.subscale,
          name: def?.name ?? item.subscale,
          items: bank.acsi_items.filter((i) => i.subscale === item.subscale),
        });
      }
    }
    return groups;
  }, [bank]);

  // ── Validation helpers ────────────────────────────────────────────────
  const acsiComplete = useMemo(() => {
    if (!bank) return false;
    const needed = bank.acsi_items.length + bank.lie_scale_items.length;
    const answered = Object.keys(acsiAnswers).length + lieAnswers.filter((v) => v > 0).length;
    return answered >= needed;
  }, [bank, acsiAnswers, lieAnswers]);

  const scenariosComplete = useMemo(() => {
    if (!bank) return false;
    return bank.scenarios.every((s) => {
      const a = scenarioAnswers[s.id];
      if (!a) return false;
      if (a.selected === "Other" && !(a.other_text ?? "").trim()) return false;
      return true;
    });
  }, [bank, scenarioAnswers]);

  const openEndedComplete = useMemo(() => {
    if (!bank) return false;
    return bank.open_ended_questions.every((q) => {
      const text = openAnswers[q.id] ?? "";
      return text.trim().length >= 50;
    });
  }, [bank, openAnswers]);

  const canSubmit = acsiComplete && scenariosComplete && openEndedComplete && consentChecked;

  // ── ACSI item answer handler ──────────────────────────────────────────
  const setAcsi = useCallback((itemNum: number, value: number) => {
    setAcsiAnswers((prev) => ({ ...prev, [itemNum]: value }));
  }, []);

  const setLie = useCallback((index: number, value: number) => {
    setLieAnswers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  // ── Submit ────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setPhase("submitting");
    setSubmitError(null);

    const payload: PsychSubmissionPayload = {
      acsi_responses: acsiAnswers,
      scenario_responses: scenarioAnswers,
      open_ended_responses: openAnswers,
      lie_scale_responses: lieAnswers,
      primary_role: "", // injected server-side from profile
      completion_time_minutes: Math.max(1, Math.round((Date.now() - startTime) / 60000)),
    };

    try {
      const res = await fetch("/api/onboarding/behaviour", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 504 && data.task_id) {
        // Server timed out polling — we resume polling on the status endpoint.
        setTaskId(data.task_id);
        setPhase("polling");
        return;
      }
      if (!res.ok || !data.success) {
        setSubmitError(data.error ?? "Submission failed");
        setPhase("form");
        setStep(3);
        return;
      }

      setTaskId(data.data?.task_id ?? null);
      setResult(data.data);
      setPhase("complete");
    } catch (e: any) {
      setSubmitError(e?.message ?? "Network error");
      setPhase("form");
      setStep(3);
    }
  }

  // ── Poll status endpoint ──────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "polling" || !taskId) return;
    let cancelled = false;

    const poll = async () => {
      for (let i = 0; i < 60; i++) {
        if (cancelled) return;
        await new Promise((r) => setTimeout(r, 5000));
        if (cancelled) return;

        try {
          const res = await fetch(`/api/onboarding/behaviour/status/${taskId}`);
          const data = await res.json().catch(() => ({}));

          if (data?.data?.status === "COMPLETE" || data?.data?.status === "COMPLETED") {
            setResult(data.data.result);
            setPhase("complete");
            return;
          }
          if (data?.data?.status === "FAILED") {
            setSubmitError(data.data.error_message ?? "Analysis failed");
            setPhase("error");
            return;
          }
        } catch {
          // Network error — keep trying
        }
      }
      // Gave up
      setSubmitError("Analysis is taking longer than expected. Please check back later.");
      setPhase("error");
    };

    poll();
    return () => { cancelled = true; };
  }, [phase, taskId]);

  // Initialize lie answers array when bank loads
  useEffect(() => {
    if (bank && lieAnswers.length === 0) {
      setLieAnswers(new Array(bank.lie_scale_items.length).fill(0));
    }
  }, [bank, lieAnswers.length]);

  // ── Render ────────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="pa-center">
        {loadError ? (
          <div className="pa-error-box">
            <p>{loadError}</p>
            <button className="pa-btn pa-btn--fill" onClick={() => window.location.reload()}>
              Retry
            </button>
          </div>
        ) : (
          <div className="pa-spinner-wrap">
            <div className="pa-spinner" />
            <p style={{ marginTop: 16, color: "var(--obs-text-dim)" }}>
              Loading Cricket Development Profile…
            </p>
          </div>
        )}
      </div>
    );
  }

  if (phase === "submitting" || phase === "polling") {
    return (
      <div className="pa-center">
        <div className="pa-spinner-wrap">
          <div className="pa-spinner" />
          <p style={{ marginTop: 16, color: "var(--obs-text-dim)" }}>
            {phase === "submitting" ? "Submitting your assessment…" : "Analysing your responses…"}
          </p>
          <p style={{ fontSize: 12, color: "var(--obs-text-faint)", marginTop: 8 }}>
            This may take up to 2 minutes. Please keep this page open.
          </p>
        </div>
      </div>
    );
  }

  if (phase === "complete" && result) {
    const dev = result.player_development_summary ?? result;
    const caveats = result.mandatory_caveats ?? [];

    return (
      <div className="pa-result">
        <h2 className="pa-result-title">Your Development Profile</h2>

        {dev.strengths?.length > 0 && (
          <div className="pa-result-section">
            <h3>Strengths</h3>
            <ul>{dev.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
          </div>
        )}

        {dev.development_areas?.length > 0 && (
          <div className="pa-result-section">
            <h3>Development Areas</h3>
            <ul>{dev.development_areas.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
          </div>
        )}

        {dev.suggested_focus?.length > 0 && (
          <div className="pa-result-section">
            <h3>Suggested Focus</h3>
            <ul>{dev.suggested_focus.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
          </div>
        )}

        {caveats.length > 0 && (
          <div className="pa-caveats">
            <h4>Important Notes</h4>
            <ul>{caveats.map((c: string, i: number) => <li key={i}>{c}</li>)}</ul>
          </div>
        )}
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="pa-center">
        <div className="pa-error-box">
          <p>{submitError ?? "Something went wrong."}</p>
          <button
            className="pa-btn pa-btn--fill"
            onClick={() => { setPhase("form"); setStep(3); setSubmitError(null); }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ── Form phase ────────────────────────────────────────────────────────
  if (!bank) return null;

  const progress = (() => {
    const totalAcsi = bank.acsi_items.length + bank.lie_scale_items.length;
    const answeredAcsi = Object.keys(acsiAnswers).length + lieAnswers.filter((v) => v > 0).length;
    const answeredScenarios = Object.keys(scenarioAnswers).length;
    const answeredOpen = Object.values(openAnswers).filter((v) => v.trim().length >= 50).length;
    const total = totalAcsi + bank.scenarios.length + bank.open_ended_questions.length;
    const done = answeredAcsi + answeredScenarios + answeredOpen;
    return Math.round((done / total) * 100);
  })();

  return (
    <div className="pa-form">
      <style dangerouslySetInnerHTML={{ __html: FORM_STYLES }} />

      {/* Step tabs */}
      <div className="pa-tabs">
        {STEPS.map((s, i) => (
          <button
            key={s.label}
            type="button"
            className={`pa-tab ${i === step ? "pa-tab--active" : ""} ${i < step ? "pa-tab--done" : ""}`}
            onClick={() => i <= step && setStep(i as FormStep)}
          >
            <span className="pa-tab-num">{i < step ? "✓" : i + 1}</span>
            <span className="pa-tab-label">{s.label}</span>
          </button>
        ))}
      </div>

      {/* Progress bar */}
      <div className="pa-progress">
        <div className="pa-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Step 0: ACSI-28 */}
      {step === 0 && (
        <div className="pa-section">
          <p className="pa-instructions">{bank.instructions}</p>

          {subscaleGroups.map((group) => (
            <div key={group.key} className="pa-subscale">
              <h3 className="pa-subscale-title">{group.name}</h3>
              {group.items.map((item) => (
                <div key={item.number} className="pa-item">
                  <p className="pa-item-text">
                    <span className="pa-item-num">{item.number}.</span>
                    {item.text}
                  </p>
                  <div className="pa-likert">
                    {LIKERT_OPTIONS.map((opt) => (
                      <label key={opt.value} className={`pa-likert-opt ${acsiAnswers[item.number] === opt.value ? "pa-likert-opt--sel" : ""}`}>
                        <input
                          type="radio"
                          name={`acsi_${item.number}`}
                          value={opt.value}
                          checked={acsiAnswers[item.number] === opt.value}
                          onChange={() => setAcsi(item.number, opt.value)}
                        />
                        <span className="pa-likert-dot" />
                        <span className="pa-likert-label">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}

          {/* Lie scale items — rendered identically to ACSI items */}
          <div className="pa-subscale">
            <h3 className="pa-subscale-title">Additional Items</h3>
            {bank.lie_scale_items.map((item, idx) => (
              <div key={item.id} className="pa-item">
                <p className="pa-item-text">
                  <span className="pa-item-num">{29 + idx}.</span>
                  {item.text}
                </p>
                <div className="pa-likert">
                  {LIKERT_OPTIONS.map((opt) => (
                    <label key={opt.value} className={`pa-likert-opt ${lieAnswers[idx] === opt.value ? "pa-likert-opt--sel" : ""}`}>
                      <input
                        type="radio"
                        name={`lie_${idx}`}
                        value={opt.value}
                        checked={lieAnswers[idx] === opt.value}
                        onChange={() => setLie(idx, opt.value)}
                      />
                      <span className="pa-likert-dot" />
                      <span className="pa-likert-label">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="pa-counter">
            {Object.keys(acsiAnswers).length + lieAnswers.filter((v) => v > 0).length} / {bank.acsi_items.length + bank.lie_scale_items.length} items answered
          </div>
        </div>
      )}

      {/* Step 1: Scenarios */}
      {step === 1 && (
        <div className="pa-section">
          <p className="pa-instructions">
            Read each match scenario carefully and choose the response that best describes what you would actually do — not what you think sounds best.
          </p>

          {bank.scenarios.map((scenario) => {
            const answer = scenarioAnswers[scenario.id];
            return (
              <div key={scenario.id} className="pa-scenario">
                <h3 className="pa-scenario-title">{scenario.title}</h3>
                <p className="pa-scenario-prompt">{scenario.prompt}</p>
                <div className="pa-scenario-opts">
                  {Object.entries(scenario.options).map(([letter, text]) => (
                    <label
                      key={letter}
                      className={`pa-scenario-opt ${answer?.selected === letter ? "pa-scenario-opt--sel" : ""}`}
                    >
                      <input
                        type="radio"
                        name={scenario.id}
                        checked={answer?.selected === letter}
                        onChange={() => setScenarioAnswers((prev) => ({
                          ...prev,
                          [scenario.id]: { selected: letter as any, other_text: "" },
                        }))}
                      />
                      <span className="pa-opt-letter">{letter}</span>
                      <span>{text}</span>
                    </label>
                  ))}
                  <label className={`pa-scenario-opt ${answer?.selected === "Other" ? "pa-scenario-opt--sel" : ""}`}>
                    <input
                      type="radio"
                      name={scenario.id}
                      checked={answer?.selected === "Other"}
                      onChange={() => setScenarioAnswers((prev) => ({
                        ...prev,
                        [scenario.id]: { selected: "Other", other_text: prev[scenario.id]?.other_text ?? "" },
                      }))}
                    />
                    <span className="pa-opt-letter">E</span>
                    <span>Other</span>
                  </label>
                  {answer?.selected === "Other" && (
                    <textarea
                      className="pa-textarea"
                      placeholder="Describe what you would actually do…"
                      value={answer.other_text ?? ""}
                      onChange={(e) => setScenarioAnswers((prev) => ({
                        ...prev,
                        [scenario.id]: { ...prev[scenario.id], other_text: e.target.value },
                      }))}
                    />
                  )}
                </div>
              </div>
            );
          })}

          <div className="pa-counter">
            {Object.keys(scenarioAnswers).length} / {bank.scenarios.length} scenarios answered
          </div>
        </div>
      )}

      {/* Step 2: Open-ended */}
      {step === 2 && (
        <div className="pa-section">
          <p className="pa-instructions">
            Take your time with these questions. There are no right or wrong answers — coaches want to understand how you think, not test you.
          </p>

          {bank.open_ended_questions.map((q) => {
            const text = openAnswers[q.id] ?? "";
            const charCount = text.trim().length;
            const met = charCount >= 50;
            return (
              <div key={q.id} className="pa-open">
                <p className="pa-open-text">{q.text}</p>
                <textarea
                  className="pa-textarea pa-textarea--tall"
                  placeholder="Write your answer here…"
                  value={text}
                  onChange={(e) => setOpenAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                />
                <div className={`pa-charcount ${met ? "pa-charcount--ok" : ""}`}>
                  {charCount} / 50 characters minimum {met ? "✓" : ""}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Step 3: Review + Consent */}
      {step === 3 && (
        <div className="pa-section">
          <h3 className="pa-review-title">Review Your Assessment</h3>

          <div className="pa-review-grid">
            <div className={`pa-review-card ${acsiComplete ? "pa-review-card--ok" : ""}`}>
              <span className="pa-review-check">{acsiComplete ? "✓" : "○"}</span>
              <div>
                <strong>Section A: ACSI-28</strong>
                <span className="pa-review-sub">
                  {Object.keys(acsiAnswers).length + lieAnswers.filter((v) => v > 0).length} / {(bank.acsi_items.length + bank.lie_scale_items.length)} items
                </span>
              </div>
            </div>
            <div className={`pa-review-card ${scenariosComplete ? "pa-review-card--ok" : ""}`}>
              <span className="pa-review-check">{scenariosComplete ? "✓" : "○"}</span>
              <div>
                <strong>Section B: Scenarios</strong>
                <span className="pa-review-sub">{Object.keys(scenarioAnswers).length} / {bank.scenarios.length} scenarios</span>
              </div>
            </div>
            <div className={`pa-review-card ${openEndedComplete ? "pa-review-card--ok" : ""}`}>
              <span className="pa-review-check">{openEndedComplete ? "✓" : "○"}</span>
              <div>
                <strong>Section C: Reflection</strong>
                <span className="pa-review-sub">
                  {Object.values(openAnswers).filter((v) => v.trim().length >= 50).length} / {bank.open_ended_questions.length} questions
                </span>
              </div>
            </div>
          </div>

          <div className="pa-consent">
            <p className="pa-consent-text">
              I understand that this assessment is a developmental tool, not a clinical diagnosis.
              My responses will be used by the AthlasX platform to generate personalised
              development recommendations. I confirm that my answers reflect my genuine views
              and experiences.
            </p>
            <label className="pa-consent-check">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
              />
              <span>I agree to the above</span>
            </label>
          </div>

          {submitError && <div className="pa-error-msg">{submitError}</div>}
        </div>
      )}

      {/* Navigation */}
      <div className="pa-nav">
        {step > 0 && (
          <button
            type="button"
            className="pa-btn pa-btn--ghost"
            onClick={() => setStep((s) => (s - 1) as FormStep)}
          >
            Back
          </button>
        )}
        <div style={{ flex: 1 }} />
        {step < 3 ? (
          <button
            type="button"
            className="pa-btn pa-btn--fill"
            onClick={() => setStep((s) => (s + 1) as FormStep)}
            disabled={
              (step === 0 && !acsiComplete) ||
              (step === 1 && !scenariosComplete) ||
              (step === 2 && !openEndedComplete)
            }
          >
            Continue →
          </button>
        ) : (
          <button
            type="button"
            className="pa-btn pa-btn--fill"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            Submit Assessment
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const FORM_STYLES = `
.pa-center { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300px; padding: 40px 20px; }
.pa-spinner-wrap { text-align: center; }
.pa-spinner { width: 40px; height: 40px; border: 3px solid rgba(255,138,30,0.2); border-top-color: #FF8A1E; border-radius: 50%; animation: pa-spin 0.8s linear infinite; margin: 0 auto; }
@keyframes pa-spin { to { transform: rotate(360deg); } }

.pa-error-box { background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.3); border-radius: 12px; padding: 20px 24px; text-align: center; max-width: 400px; }
.pa-error-box p { color: #F87171; margin: 0 0 16px; font-size: 14px; }
.pa-error-msg { margin-top: 12px; padding: 10px 14px; background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.3); border-radius: 9px; color: #F87171; font-size: 13px; }

/* Tabs */
.pa-tabs { display: flex; gap: 4px; margin-bottom: 8px; }
.pa-tab { display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 10px; border: 1px solid rgba(245,245,240,0.1); background: transparent; color: rgba(245,245,240,0.5); cursor: pointer; font-family: 'Barlow Semi Condensed', sans-serif; font-size: 13px; font-weight: 600; transition: all 0.2s; }
.pa-tab:hover { background: rgba(245,245,240,0.04); }
.pa-tab--active { border-color: #FF8A1E; background: rgba(255,138,30,0.08); color: #FFA64D; }
.pa-tab--done { color: rgba(245,245,240,0.7); }
.pa-tab--done .pa-tab-num { color: #38d39f; border-color: #38d39f; }
.pa-tab-num { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; font-size: 11px; font-weight: 700; border: 1.5px solid currentColor; flex-shrink: 0; }
.pa-tab--active .pa-tab-num { background: #FF8A1E; color: #1a0e02; border-color: #FF8A1E; }
.pa-tab-label { white-space: nowrap; }

/* Progress */
.pa-progress { height: 3px; background: rgba(245,245,240,0.1); border-radius: 3px; margin-bottom: 24px; overflow: hidden; }
.pa-progress-fill { height: 100%; background: linear-gradient(90deg, #FF8A1E, #FFA64D); transition: width 0.5s ease; }

/* Section */
.pa-section { padding-bottom: 20px; }
.pa-instructions { font-size: 14px; color: rgba(245,245,240,0.6); line-height: 1.6; margin: 0 0 24px; padding: 16px; background: rgba(255,138,30,0.06); border: 1px solid rgba(255,138,30,0.15); border-radius: 10px; }

/* ACSI items */
.pa-subscale { margin-bottom: 28px; }
.pa-subscale-title { font-family: 'Barlow Semi Condensed', sans-serif; font-size: 14px; text-transform: uppercase; letter-spacing: 1.5px; color: #FFA64D; font-weight: 700; margin: 0 0 14px; padding-bottom: 8px; border-bottom: 1px solid rgba(245,245,240,0.1); }
.pa-item { margin-bottom: 16px; padding: 14px 16px; background: rgba(245,245,240,0.03); border: 1px solid rgba(245,245,240,0.08); border-radius: 10px; }
.pa-item-text { margin: 0 0 10px; font-size: 14px; line-height: 1.5; color: rgba(245,245,240,0.9); }
.pa-item-num { font-weight: 700; color: rgba(245,245,240,0.4); margin-right: 6px; font-size: 12px; }
.pa-likert { display: flex; gap: 6px; flex-wrap: wrap; }
.pa-likert-opt { display: flex; align-items: center; gap: 6px; padding: 6px 12px; border: 1px solid rgba(245,245,240,0.12); border-radius: 8px; cursor: pointer; font-size: 12.5px; color: rgba(245,245,240,0.6); transition: all 0.15s; }
.pa-likert-opt:hover { background: rgba(245,245,240,0.04); border-color: rgba(245,245,240,0.2); }
.pa-likert-opt--sel { background: rgba(255,138,30,0.12); border-color: #FF8A1E; color: #FFA64D; }
.pa-likert-opt input { display: none; }
.pa-likert-dot { width: 14px; height: 14px; border-radius: 50%; border: 2px solid rgba(245,245,240,0.25); flex-shrink: 0; position: relative; }
.pa-likert-opt--sel .pa-likert-dot { border-color: #FF8A1E; }
.pa-likert-opt--sel .pa-likert-dot::after { content: ""; position: absolute; inset: 2px; border-radius: 50%; background: #FF8A1E; }

/* Counter */
.pa-counter { font-size: 12px; color: rgba(245,245,240,0.5); text-align: right; padding: 8px 0; }

/* Scenarios */
.pa-scenario { margin-bottom: 24px; padding: 18px; background: rgba(245,245,240,0.03); border: 1px solid rgba(245,245,240,0.08); border-radius: 12px; }
.pa-scenario-title { font-family: 'Barlow Semi Condensed', sans-serif; font-size: 15px; font-weight: 700; color: #FFA64D; margin: 0 0 8px; }
.pa-scenario-prompt { font-size: 14px; line-height: 1.55; color: rgba(245,245,240,0.85); margin: 0 0 14px; }
.pa-scenario-opts { display: flex; flex-direction: column; gap: 6px; }
.pa-scenario-opt { display: flex; align-items: flex-start; gap: 10px; padding: 10px 14px; border: 1px solid rgba(245,245,240,0.1); border-radius: 9px; cursor: pointer; font-size: 13.5px; line-height: 1.45; color: rgba(245,245,240,0.7); transition: all 0.15s; }
.pa-scenario-opt:hover { background: rgba(245,245,240,0.04); }
.pa-scenario-opt--sel { background: rgba(255,138,30,0.1); border-color: rgba(255,138,30,0.4); color: #FFA64D; }
.pa-scenario-opt input { display: none; }
.pa-opt-letter { font-weight: 700; font-size: 12px; color: rgba(245,245,240,0.4); min-width: 18px; margin-top: 1px; }
.pa-scenario-opt--sel .pa-opt-letter { color: #FF8A1E; }

/* Textarea */
.pa-textarea { width: 100%; min-height: 80px; padding: 10px 14px; background: rgba(245,245,240,0.05); border: 1.5px solid rgba(245,245,240,0.15); border-radius: 8px; color: #F5F5F0; font-family: inherit; font-size: 14px; resize: vertical; outline: none; margin-top: 8px; transition: border-color 0.15s; }
.pa-textarea:focus { border-color: #FF8A1E; }
.pa-textarea--tall { min-height: 120px; }

/* Open-ended */
.pa-open { margin-bottom: 24px; }
.pa-open-text { font-size: 14px; line-height: 1.55; color: rgba(245,245,240,0.85); margin: 0 0 8px; padding: 12px 14px; background: rgba(245,245,240,0.03); border: 1px solid rgba(245,245,240,0.08); border-radius: 10px; }
.pa-charcount { font-size: 11px; color: rgba(245,245,240,0.4); text-align: right; margin-top: 4px; }
.pa-charcount--ok { color: #38d39f; }

/* Review */
.pa-review-title { font-family: 'Barlow Semi Condensed', sans-serif; font-size: 18px; font-weight: 700; color: #F5F5F0; margin: 0 0 18px; }
.pa-review-grid { display: flex; flex-direction: column; gap: 10px; margin-bottom: 24px; }
.pa-review-card { display: flex; align-items: center; gap: 14px; padding: 14px 18px; background: rgba(245,245,240,0.03); border: 1px solid rgba(245,245,240,0.1); border-radius: 10px; }
.pa-review-card--ok { border-color: rgba(56,211,159,0.3); background: rgba(56,211,159,0.06); }
.pa-review-check { font-size: 18px; color: rgba(245,245,240,0.3); }
.pa-review-card--ok .pa-review-check { color: #38d39f; }
.pa-review-card strong { display: block; font-size: 14px; color: #F5F5F0; }
.pa-review-sub { display: block; font-size: 12px; color: rgba(245,245,240,0.5); margin-top: 2px; }

/* Consent */
.pa-consent { padding: 18px; background: rgba(96,165,250,0.06); border: 1px solid rgba(96,165,250,0.2); border-radius: 12px; margin-bottom: 18px; }
.pa-consent-text { font-size: 13px; line-height: 1.6; color: rgba(245,245,240,0.75); margin: 0 0 14px; }
.pa-consent-check { display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 14px; font-weight: 600; color: #F5F5F0; }
.pa-consent-check input { accent-color: #FF8A1E; width: 18px; height: 18px; }

/* Navigation */
.pa-nav { display: flex; align-items: center; gap: 12px; padding: 18px 0; margin-top: 8px; border-top: 1px solid rgba(245,245,240,0.1); }

/* Buttons */
.pa-btn { padding: 10px 22px; cursor: pointer; font-family: 'Barlow Semi Condensed', sans-serif; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; font-size: 14px; border-radius: 9px; border: 1.5px solid transparent; transition: all 0.2s; white-space: nowrap; }
.pa-btn--fill { background: #FF8A1E; color: #1a0e02; border-color: #FF8A1E; }
.pa-btn--fill:hover { background: #FFA64D; border-color: #FFA64D; }
.pa-btn--fill:disabled { opacity: 0.4; cursor: default; pointer-events: none; }
.pa-btn--ghost { background: transparent; color: #F5F5F0; border-color: rgba(245,245,240,0.15); }
.pa-btn--ghost:hover { border-color: rgba(245,245,240,0.4); background: rgba(245,245,240,0.04); }

/* Result */
.pa-result { padding: 20px 0; }
.pa-result-title { font-family: 'Barlow Semi Condensed', sans-serif; font-size: 22px; font-weight: 700; color: #FFA64D; margin: 0 0 24px; text-transform: uppercase; letter-spacing: 0.05em; }
.pa-result-section { margin-bottom: 20px; padding: 18px; background: rgba(245,245,240,0.03); border: 1px solid rgba(245,245,240,0.1); border-radius: 12px; }
.pa-result-section h3 { font-family: 'Barlow Semi Condensed', sans-serif; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #FFA64D; font-weight: 700; margin: 0 0 10px; }
.pa-result-section ul { margin: 0; padding: 0 0 0 18px; }
.pa-result-section li { font-size: 14px; line-height: 1.6; color: rgba(245,245,240,0.8); margin-bottom: 6px; }
.pa-caveats { margin-top: 20px; padding: 16px; background: rgba(251,191,36,0.06); border: 1px solid rgba(251,191,36,0.2); border-radius: 12px; }
.pa-caveats h4 { font-family: 'Barlow Semi Condensed', sans-serif; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #FBBF24; font-weight: 700; margin: 0 0 8px; }
.pa-caveats ul { margin: 0; padding: 0 0 0 16px; }
.pa-caveats li { font-size: 12px; line-height: 1.5; color: rgba(245,245,240,0.6); margin-bottom: 4px; }

@media (max-width: 600px) {
  .pa-tabs { flex-wrap: wrap; }
  .pa-tab-label { display: none; }
  .pa-likert { flex-direction: column; }
}
`;
