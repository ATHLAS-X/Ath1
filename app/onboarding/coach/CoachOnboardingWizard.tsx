"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import "@/app/athlasx.css";

/* Coach onboarding — V1 self-signup path (the doc's V2 row).
   Coaches added by academies redeem an invite at /coach/register?token=…
   and never see this wizard. Here we collect the same data: identity,
   academy linkage, official certification, then submit for AthlasX review. */

interface FormState {
  coach_name: string;
  academy_club: string;
  official_id: string;
  cert_url: string;
}

interface Props {
  initial: FormState;
  coachStatus: string;
  userName: string;
  userEmail: string;
}

const STEPS = [
  { n: "Coach Identity",   d: "Name + phone" },
  { n: "Affiliation",      d: "Academy or club" },
  { n: "Certification",    d: "Credentials + upload" },
  { n: "Review",           d: "Submit for review" },
];

const STATUS_LABEL: Record<string, string> = {
  DRAFT:           "Draft",
  PENDING_REVIEW:  "Awaiting AthlasX review",
  APPROVED:        "Verified",
  REJECTED:        "Rejected",
};

export default function CoachOnboardingWizard(p: Props) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(p.initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitted, setSubmitted] = useState(
    p.coachStatus === "PENDING_REVIEW" || p.coachStatus === "APPROVED",
  );

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  const saveStep = useCallback(async (): Promise<boolean> => {
    setError(null); setBusy(true);
    try {
      const res = await fetch("/api/coach/profile/save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!data?.success) { setError(data?.error ?? "Save failed"); return false; }
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      return true;
    } finally { setBusy(false); }
  }, [form]);

  const submit = useCallback(async () => {
    setError(null); setBusy(true);
    try {
      await fetch("/api/coach/profile/save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const res = await fetch("/api/coach/profile/submit", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!data?.success) {
        const missing = Array.isArray(data?.missing) ? ` (Missing: ${data.missing.join(", ")})` : "";
        setError((data?.error ?? "Submit failed") + missing);
        return;
      }
      setSubmitted(true);
      setStep(3);
    } finally { setBusy(false); }
  }, [form]);

  const next = async () => {
    const ok = await saveStep();
    if (ok && step < 3) setStep(step + 1);
  };
  const prev = () => step > 0 && setStep(step - 1);

  const cantContinue = (() => {
    if (step === 0) return !form.coach_name.trim();
    if (step === 1) return !form.academy_club.trim();
    if (step === 2) return !form.official_id.trim() || !form.cert_url.trim();
    return false;
  })();

  return (
    <div className="sx-root cw-root">
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <div className="cw-shell">

        {submitted && step === 3 && <SubmittedBanner status={p.coachStatus} />}

        <div className="cw-stepper">
          {STEPS.map((s, i) => (
            <button key={s.n}
              type="button"
              className={`cw-step${i === step ? " on" : ""}${i < step ? " done" : ""}`}
              onClick={() => i <= step && setStep(i)}>
              <div className="cw-step-dot">{i < step ? "✓" : i + 1}</div>
              <div className="cw-step-text">
                <div className="cw-step-n">{s.n}</div>
                <div className="cw-step-d">{s.d}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="card cw-card">
          {step === 0 && <Step1 form={form} set={set} userName={p.userName} userEmail={p.userEmail} />}
          {step === 1 && <Step2 form={form} set={set} />}
          {step === 2 && <Step3 form={form} set={set} />}
          {step === 3 && <Step4 form={form} submitted={submitted} userName={p.userName} userEmail={p.userEmail} status={p.coachStatus} />}

          {error && <p className="cw-error">{error}</p>}

          {!submitted && (
            <div className="cw-actions">
              <button className="btn" disabled={busy || step === 0} onClick={prev}>← Back</button>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {saved && <span style={{ fontSize: 12, color: "var(--green)" }}>✓ Saved</span>}
                {step < 3 ? (
                  <button className="btn green" disabled={busy || cantContinue} onClick={next}>
                    {busy ? "Saving…" : "Save & Continue →"}
                  </button>
                ) : (
                  <button className="btn green" disabled={busy} onClick={submit}>
                    {busy ? "Submitting…" : "Submit for AthlasX Review"}
                  </button>
                )}
              </div>
            </div>
          )}

          {submitted && (
            <div className="cw-actions" style={{ justifyContent: "center" }}>
              <Link href="/dashboard/coach" className="btn green" style={{ textDecoration: "none" }}>
                Go to Coach Dashboard
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Step1({ form, set, userName, userEmail }: {
  form: FormState; set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  userName: string; userEmail: string;
}) {
  return (
    <>
      <div className="cw-head">
        <span className="sect-title">Step 1 of 4</span>
        <h2 className="cw-h2">Coach Identity</h2>
        <p className="cw-sub">
          We already have your sign-up details. Confirm your display name —
          the one academies and players will see on your profile.
        </p>
      </div>

      <div className="cw-grid">
        <Field label="Email (from sign-up)">
          <input className="sinput" value={userEmail} disabled />
        </Field>
        <Field label="Display Name *" hint="Defaults to the name you signed up with">
          <input className="sinput" value={form.coach_name}
            onChange={(e) => set("coach_name", e.target.value)}
            placeholder={userName} />
        </Field>
      </div>

      <p className="cw-note">
        ⓘ Independent coach (V2)? You&apos;re in the right place. Coaches added
        by an academy follow the invite link they received — they don&apos;t
        see this wizard.
      </p>
    </>
  );
}

function Step2({ form, set }: {
  form: FormState; set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}) {
  return (
    <>
      <div className="cw-head">
        <span className="sect-title">Step 2 of 4</span>
        <h2 className="cw-h2">Affiliation</h2>
        <p className="cw-sub">
          Coaches are scoped to one academy or club at a time. You&apos;ll only
          be able to log fitness, evaluations, and milestones for players
          inside this org. Leave blank if you&apos;re fully independent.
        </p>
      </div>

      <div className="cw-grid">
        <div style={{ gridColumn: "1 / -1" }}>
          <Field label="Academy / Club Name *" hint="e.g. MRF Pace Foundation, Mumbai Cricket Association">
            <input className="sinput" value={form.academy_club}
              onChange={(e) => set("academy_club", e.target.value)}
              placeholder="Type your academy or club name" />
          </Field>
        </div>
      </div>

      <p className="cw-note">
        ⓘ A coach with no academy can still complete onboarding — but
        evaluation permissions stay off until an academy admin links you.
      </p>
    </>
  );
}

function Step3({ form, set }: {
  form: FormState; set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}) {
  return (
    <>
      <div className="cw-head">
        <span className="sect-title">Step 3 of 4</span>
        <h2 className="cw-h2">Certification</h2>
        <p className="cw-sub">
          AthlasX reviews credentials before granting the&nbsp;
          <code>can_submit_evaluations</code> and&nbsp;
          <code>can_submit_fitness_assessments</code> flags. A verified coach&apos;s
          rating turns a player into <strong>Performance Verified</strong>.
        </p>
      </div>

      <div className="cw-grid">
        <Field label="Official ID *" hint="BCCI L1 / L2, NIS, NCA, or your federation ID">
          <input className="sinput" value={form.official_id}
            onChange={(e) => set("official_id", e.target.value)}
            placeholder="e.g. BCCI L2 — 12345" />
        </Field>
        <div style={{ gridColumn: "1 / -1" }}>
          <Field label="Certification URL *" hint="Link to a scan of your certificate, ID card, or federation page">
            <input className="sinput" value={form.cert_url}
              onChange={(e) => set("cert_url", e.target.value)}
              placeholder="https://…" />
          </Field>
        </div>
      </div>
    </>
  );
}

function Step4({ form, submitted, userName, userEmail, status }: {
  form: FormState; submitted: boolean; userName: string; userEmail: string; status: string;
}) {
  return (
    <>
      <div className="cw-head">
        <span className="sect-title">Step 4 of 4</span>
        <h2 className="cw-h2">{submitted ? "Submitted ✓" : "Review & Submit"}</h2>
        <p className="cw-sub">
          {submitted
            ? "Your profile is now in the AthlasX admin review queue. You'll be notified when verification completes."
            : "Double-check the details before submitting. After submit you can't edit until review completes."}
        </p>
      </div>

      <div className="cw-review">
        <ReviewRow k="Sign-up name"     v={userName} />
        <ReviewRow k="Email"            v={userEmail} />
        <ReviewRow k="Display name"     v={form.coach_name} />
        <ReviewRow k="Academy / Club"   v={form.academy_club} />
        <ReviewRow k="Official ID"      v={form.official_id} />
        <ReviewRow k="Certification"    v={form.cert_url} link />
        <ReviewRow k="Coach status"     v={STATUS_LABEL[status] ?? status} />
      </div>

      {!submitted && (
        <p className="cw-note">
          ⓘ Submitting locks the profile until AthlasX (or the linked academy)
          reviews your credentials. Both <code>can_submit_evaluations</code> and
          <code> can_submit_fitness_assessments</code> stay off until then.
        </p>
      )}
    </>
  );
}

function SubmittedBanner({ status }: { status: string }) {
  const approved = status === "APPROVED";
  return (
    <div className="cw-success-banner">
      <div className="cw-success-dot">{approved ? "✓" : "⏳"}</div>
      <div>
        <div className="cw-success-h">
          {approved ? "Coach Verified" : "Awaiting AthlasX review"}
        </div>
        <div className="cw-success-s">
          Current status: <strong>{STATUS_LABEL[status] ?? status}</strong>.
          {approved
            ? " Evaluation permissions are now active for your linked academy's players."
            : " You'll get fitness + evaluation permissions once AthlasX (or your linked academy) approves."}
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="cw-field">
      <span className="f-label" style={{ marginTop: 0 }}>{label}</span>
      {children}
      {hint && <span className="cw-hint">{hint}</span>}
    </label>
  );
}

function ReviewRow({ k, v, link }: { k: string; v: string; link?: boolean }) {
  return (
    <div className="cw-rev-row">
      <span className="cw-rev-k">{k}</span>
      {link && v && v.startsWith("http")
        ? <a className="cw-rev-v" href={v} target="_blank" rel="noreferrer" style={{ color: "var(--blue)", textDecoration: "underline" }}>{v}</a>
        : <span className="cw-rev-v">{v || "—"}</span>}
    </div>
  );
}

const STYLES = `
.cw-root { min-height: 100vh; padding: 24px 18px 48px; }
.cw-shell { max-width: 880px; margin: 0 auto; }
.cw-stepper { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 18px; }
.cw-step { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 11px; background: var(--card-alt); border: 1px solid var(--line); cursor: pointer; text-align: left; transition: all 0.15s; min-width: 0; }
.cw-step:hover:not(:disabled) { border-color: var(--line2); }
.cw-step.done { background: linear-gradient(168deg, rgba(46,224,123,0.08), transparent); border-color: var(--green-bd); }
.cw-step.on { background: linear-gradient(168deg, rgba(46,224,123,0.13), rgba(46,224,123,0.04)); border-color: var(--green-bd); box-shadow: 0 6px 18px -10px var(--green-glow); }
.cw-step-dot { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font-family: var(--num); font-size: 11.5px; font-weight: 700; background: var(--card-base); border: 1.5px solid var(--line2); color: var(--mut); flex-shrink: 0; }
.cw-step.on .cw-step-dot { border-color: var(--green); color: var(--green); }
.cw-step.done .cw-step-dot { background: radial-gradient(circle at 32% 28%, #46ff97, #0e6e33 75%); border-color: rgba(46,224,123,0.5); color: #04140a; }
.cw-step-text { min-width: 0; }
.cw-step-n { font-family: var(--num); font-size: 12.5px; font-weight: 700; color: var(--text); }
.cw-step-d { font-size: 10px; color: var(--mut); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.cw-card { padding: 28px 26px; }
.cw-head { margin-bottom: 22px; }
.cw-h2 { font-family: var(--num); font-size: 24px; font-weight: 700; margin: 6px 0 8px; }
.cw-sub { font-size: 13px; color: var(--mut); line-height: 1.55; max-width: 640px; }
.cw-sub code { background: var(--card-alt); padding: 1px 6px; border-radius: 5px; font-size: 11.5px; color: var(--green); }

.cw-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
@media (max-width: 700px) { .cw-grid, .cw-stepper { grid-template-columns: 1fr; } }
.cw-field { display: block; }
.cw-hint { display: block; font-size: 11px; color: var(--mut); margin-top: 5px; }

.cw-error { margin-top: 14px; padding: 10px 12px; border-radius: 9px; background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.3); color: var(--red); font-size: 12.5px; }
.cw-note { margin-top: 16px; padding: 12px; border-radius: 10px; background: rgba(251,191,36,0.08); border: 1px solid rgba(251,191,36,0.25); color: var(--amber); font-size: 12.5px; line-height: 1.55; }
.cw-note code { background: rgba(0,0,0,0.3); padding: 1px 6px; border-radius: 5px; font-size: 11px; color: var(--amber); }

.cw-actions { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--line); }

.cw-review { display: flex; flex-direction: column; gap: 0; }
.cw-rev-row { display: flex; gap: 12px; padding: 10px 0; align-items: flex-start; }
.cw-rev-row + .cw-rev-row { border-top: 1px solid var(--line); }
.cw-rev-k { width: 180px; flex-shrink: 0; font-size: 12px; color: var(--mut); }
.cw-rev-v { flex: 1; font-size: 12.5px; font-weight: 600; color: var(--text); word-break: break-word; }

.cw-success-banner { display: flex; align-items: center; gap: 14px; padding: 16px 18px; border-radius: 12px; background: linear-gradient(168deg, rgba(46,224,123,0.12), rgba(46,224,123,0.04)); border: 1px solid var(--green-bd); margin-bottom: 18px; }
.cw-success-dot { width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; font-size: 20px; background: radial-gradient(circle at 32% 28%, #46ff97, #0e6e33 75%); box-shadow: 0 0 16px var(--green-glow); flex-shrink: 0; }
.cw-success-h { font-family: var(--num); font-size: 16px; font-weight: 700; }
.cw-success-s { font-size: 12.5px; color: var(--mut); line-height: 1.5; margin-top: 3px; }
`;
