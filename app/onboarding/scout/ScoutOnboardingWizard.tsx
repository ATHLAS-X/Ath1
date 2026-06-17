"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import "@/app/sportx.css";

/* Scout Onboarding wizard — implements Part 1 of the V1 spec
   (SportX_Onboarding_Workflows_Scout_Coach.docx).
   Four user-facing steps:
     1. Scout Profile         (Identity + Designation)
     2. Organization Affiliation (Org + Proof)
     3. Scouting Preferences  (Age groups, Roles, Regions)
     4. Review & Submit       → L0 Pending until admin promotes to L1 */

interface FormState {
  designation: string;
  organization_name: string;
  org_type: string;
  region: string;
  years_experience: number | null;
  proof_url: string;
  preferred_age_groups: string[];
  preferred_roles: string[];
  preferred_regions: string[];
}

interface Props {
  initial: FormState;
  profileStatus: string;
  verificationLevel: string;
  userName: string;
  userEmail: string;
}

const ORG_TYPES = ["Independent", "Franchise", "State", "Country", "Academy"];
const AGE_GROUPS = ["U16", "U19", "U23", "Open"];
const PLAYER_ROLES = ["Batter", "Bowler", "All-Rounder", "WK"];
const INDIAN_STATES = [
  "Andhra Pradesh","Bihar","Chhattisgarh","Delhi","Gujarat","Haryana",
  "Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Odisha",
  "Punjab","Rajasthan","Tamil Nadu","Telangana","Uttar Pradesh","West Bengal",
];

const STEPS = [
  { n: "Scout Profile",      d: "Identity + designation" },
  { n: "Organization",       d: "Affiliation + proof" },
  { n: "Preferences",        d: "Age, roles, regions" },
  { n: "Review",             d: "Submit for review" },
];

export default function ScoutOnboardingWizard(p: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(p.initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitted, setSubmitted] = useState(p.profileStatus === "Pending Approval" || p.profileStatus === "Approved");

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  const toggleInArray = (k: keyof FormState, val: string) => {
    setForm((s) => {
      const arr = (s[k] as unknown as string[]) ?? [];
      const next = arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
      return { ...s, [k]: next };
    });
  };

  const saveStep = useCallback(async (): Promise<boolean> => {
    setError(null); setBusy(true);
    try {
      const res = await fetch("/api/scout/profile/save", {
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
      await fetch("/api/scout/profile/save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const res = await fetch("/api/scout/profile/submit", { method: "POST" });
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
    if (step === 0) return !form.designation.trim();
    if (step === 1) return !form.organization_name.trim() || !form.org_type || !form.region.trim() || form.years_experience == null || !form.proof_url.trim();
    if (step === 2) return form.preferred_age_groups.length === 0 && form.preferred_roles.length === 0;
    return false;
  })();

  return (
    <div className="sx-root sw-root">
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <div className="sw-shell">

        {/* Status banner if already submitted */}
        {submitted && step === 3 && (
          <SubmittedBanner level={p.verificationLevel} />
        )}

        {/* Stepper */}
        <div className="sw-stepper">
          {STEPS.map((s, i) => (
            <button key={s.n}
              type="button"
              className={`sw-step${i === step ? " on" : ""}${i < step ? " done" : ""}`}
              onClick={() => i <= step && setStep(i)}>
              <div className="sw-step-dot">{i < step ? "✓" : i + 1}</div>
              <div className="sw-step-text">
                <div className="sw-step-n">{s.n}</div>
                <div className="sw-step-d">{s.d}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Step content */}
        <div className="card sw-card">
          {step === 0 && <Step1 form={form} set={set} userName={p.userName} userEmail={p.userEmail} />}
          {step === 1 && <Step2 form={form} set={set} />}
          {step === 2 && <Step3 form={form} toggle={toggleInArray} />}
          {step === 3 && <Step4 form={form} submitted={submitted} userName={p.userName} userEmail={p.userEmail} verificationLevel={p.verificationLevel} />}

          {error && <p className="sw-error">{error}</p>}

          {!submitted && (
            <div className="sw-actions">
              <button className="btn" disabled={busy || step === 0} onClick={prev}>← Back</button>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {saved && <span style={{ fontSize: 12, color: "var(--green)" }}>✓ Saved</span>}
                {step < 3 ? (
                  <button className="btn green" disabled={busy || cantContinue} onClick={next}>
                    {busy ? "Saving…" : "Save & Continue →"}
                  </button>
                ) : (
                  <button className="btn green" disabled={busy} onClick={submit}>
                    {busy ? "Submitting…" : "Submit for SportX Review"}
                  </button>
                )}
              </div>
            </div>
          )}

          {submitted && (
            <div className="sw-actions" style={{ justifyContent: "center" }}>
              <Link href="/scout/dashboard" className="btn green" style={{ textDecoration: "none" }}>
                Go to Scout Dashboard
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
      <div className="sw-head">
        <span className="sect-title">Step 1 of 4</span>
        <h2 className="sw-h2">Scout Profile</h2>
        <p className="sw-sub">
          We already have your name and email from sign-up. Tell us your
          role inside your organization.
        </p>
      </div>

      <div className="sw-grid">
        <Field label="Full Name (from sign-up)">
          <input className="sinput" value={userName} disabled />
        </Field>
        <Field label="Email (from sign-up)">
          <input className="sinput" value={userEmail} disabled />
        </Field>
        <Field label="Designation *" hint="e.g. Talent Scout, Head Scout, Selector">
          <input className="sinput" value={form.designation}
            onChange={(e) => set("designation", e.target.value)}
            placeholder="Talent Scout" />
        </Field>
      </div>
    </>
  );
}

function Step2({ form, set }: {
  form: FormState; set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}) {
  return (
    <>
      <div className="sw-head">
        <span className="sect-title">Step 2 of 4</span>
        <h2 className="sw-h2">Organization &amp; Affiliation</h2>
        <p className="sw-sub">
          Scouts must be tied to an organization. SportX admin verifies your
          proof before granting search access (L1) — without proof your
          account stays at L0 (browse-only).
        </p>
      </div>

      <div className="sw-grid">
        <Field label="Organization Name *">
          <input className="sinput" value={form.organization_name}
            onChange={(e) => set("organization_name", e.target.value)}
            placeholder="e.g. Mumbai Cricket Association" />
        </Field>
        <Field label="Organization Type *">
          <select className="sinput" value={form.org_type}
            onChange={(e) => set("org_type", e.target.value)}>
            <option value="">Select…</option>
            {ORG_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Region (state / city / pan-India) *">
          <input className="sinput" value={form.region}
            onChange={(e) => set("region", e.target.value)}
            placeholder="Maharashtra" />
        </Field>
        <Field label="Years of Scouting Experience *">
          <input className="sinput" type="number" inputMode="numeric"
            value={form.years_experience ?? ""}
            onChange={(e) => set("years_experience", e.target.value ? Number(e.target.value) : null)}
            placeholder="0" />
        </Field>
        <div style={{ gridColumn: "1 / -1" }}>
          <Field label="Affiliation Proof URL *"
            hint="Paste a link to an ID card, official letter, or LinkedIn profile">
            <input className="sinput" value={form.proof_url}
              onChange={(e) => set("proof_url", e.target.value)}
              placeholder="https://…" />
          </Field>
        </div>
      </div>

      <p className="sw-note">
        ⓘ Hard rule: scouts can NEVER contact minors directly. Even after
        Minor-Cleared (L2), all contact is routed via the player&apos;s parent
        or guardian.
      </p>
    </>
  );
}

function Step3({ form, toggle }: {
  form: FormState; toggle: (k: keyof FormState, v: string) => void;
}) {
  return (
    <>
      <div className="sw-head">
        <span className="sect-title">Step 3 of 4</span>
        <h2 className="sw-h2">Scouting Preferences</h2>
        <p className="sw-sub">
          These don&apos;t restrict search — they help SportX surface the right
          players in your discovery feed. You can change them later.
        </p>
      </div>

      <div className="f-label">Age Groups (pick all that apply)</div>
      <div className="sw-chips">
        {AGE_GROUPS.map((g) => (
          <button key={g} type="button"
            className={`sw-chip${form.preferred_age_groups.includes(g) ? " on" : ""}`}
            onClick={() => toggle("preferred_age_groups", g)}>
            {g}
          </button>
        ))}
      </div>

      <div className="f-label">Player Roles</div>
      <div className="sw-chips">
        {PLAYER_ROLES.map((r) => (
          <button key={r} type="button"
            className={`sw-chip${form.preferred_roles.includes(r) ? " on" : ""}`}
            onClick={() => toggle("preferred_roles", r)}>
            {r}
          </button>
        ))}
      </div>

      <div className="f-label">Regions of Interest</div>
      <div className="sw-chips">
        {INDIAN_STATES.map((s) => (
          <button key={s} type="button"
            className={`sw-chip${form.preferred_regions.includes(s) ? " on" : ""}`}
            onClick={() => toggle("preferred_regions", s)}>
            {s}
          </button>
        ))}
      </div>
    </>
  );
}

function Step4({ form, submitted, userName, userEmail, verificationLevel }: {
  form: FormState; submitted: boolean; userName: string; userEmail: string; verificationLevel: string;
}) {
  return (
    <>
      <div className="sw-head">
        <span className="sect-title">Step 4 of 4</span>
        <h2 className="sw-h2">{submitted ? "Submitted ✓" : "Review &amp; Submit"}</h2>
        <p className="sw-sub">
          {submitted
            ? "Your profile is with SportX admin. You'll be notified once your verification level changes."
            : "Double-check the details. After submission you cannot edit until admin review completes."}
        </p>
      </div>

      <div className="sw-review">
        <ReviewRow k="Name" v={userName} />
        <ReviewRow k="Email" v={userEmail} />
        <ReviewRow k="Designation" v={form.designation} />
        <ReviewRow k="Organization" v={`${form.organization_name} · ${form.org_type}`} />
        <ReviewRow k="Region" v={form.region} />
        <ReviewRow k="Experience" v={form.years_experience != null ? `${form.years_experience} years` : "—"} />
        <ReviewRow k="Affiliation proof" v={form.proof_url} link />
        <ReviewRow k="Age groups"  v={form.preferred_age_groups.join(", ") || "—"} />
        <ReviewRow k="Roles"       v={form.preferred_roles.join(", ") || "—"} />
        <ReviewRow k="Regions"     v={form.preferred_regions.join(", ") || "—"} />
        <ReviewRow k="Verification" v={`${verificationLevel} · ${LVL_LABEL[verificationLevel] ?? "Pending"}`} />
      </div>

      {!submitted && (
        <p className="sw-note">
          ⓘ Submitting puts your profile in the SportX admin review queue.
          Adult-profile search unlocks immediately at <strong>L1 Verified</strong>; minor
          access (<strong>L2 Minor-Cleared</strong>) is requested separately later.
        </p>
      )}
    </>
  );
}

function SubmittedBanner({ level }: { level: string }) {
  return (
    <div className="sw-success-banner">
      <div className="sw-success-dot">⏳</div>
      <div>
        <div className="sw-success-h">Awaiting SportX review</div>
        <div className="sw-success-s">
          Current level: <strong>{level} · {LVL_LABEL[level] ?? "Pending"}</strong>.
          You&apos;ll be promoted to L1 (Adult Search) once an admin approves.
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="sw-field">
      <span className="f-label" style={{ marginTop: 0 }}>{label}</span>
      {children}
      {hint && <span className="sw-hint">{hint}</span>}
    </label>
  );
}

function ReviewRow({ k, v, link }: { k: string; v: string; link?: boolean }) {
  return (
    <div className="sw-rev-row">
      <span className="sw-rev-k">{k}</span>
      {link && v && v.startsWith("http")
        ? <a className="sw-rev-v" href={v} target="_blank" rel="noreferrer" style={{ color: "var(--blue)", textDecoration: "underline" }}>{v}</a>
        : <span className="sw-rev-v">{v || "—"}</span>}
    </div>
  );
}

const LVL_LABEL: Record<string, string> = {
  L0: "Pending",
  L1: "Verified · Adult Search",
  L2: "Minor-Cleared",
};

const STYLES = `
.sw-root { min-height: 100vh; padding: 24px 18px 48px; }
.sw-shell { max-width: 880px; margin: 0 auto; }
.sw-stepper { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 18px; }
.sw-step { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 11px; background: var(--card-alt); border: 1px solid var(--line); cursor: pointer; text-align: left; transition: all 0.15s; min-width: 0; }
.sw-step:hover:not(:disabled) { border-color: var(--line2); }
.sw-step.done { background: linear-gradient(168deg, rgba(46,224,123,0.08), transparent); border-color: var(--green-bd); }
.sw-step.on { background: linear-gradient(168deg, rgba(46,224,123,0.13), rgba(46,224,123,0.04)); border-color: var(--green-bd); box-shadow: 0 6px 18px -10px var(--green-glow); }
.sw-step-dot { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font-family: var(--num); font-size: 11.5px; font-weight: 700; background: var(--card-base); border: 1.5px solid var(--line2); color: var(--mut); flex-shrink: 0; }
.sw-step.on .sw-step-dot { border-color: var(--green); color: var(--green); }
.sw-step.done .sw-step-dot { background: radial-gradient(circle at 32% 28%, #46ff97, #0e6e33 75%); border-color: rgba(46,224,123,0.5); color: #04140a; }
.sw-step-text { min-width: 0; }
.sw-step-n { font-family: var(--num); font-size: 12.5px; font-weight: 700; color: var(--text); }
.sw-step-d { font-size: 10px; color: var(--mut); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.sw-card { padding: 28px 26px; }
.sw-head { margin-bottom: 22px; }
.sw-h2 { font-family: var(--num); font-size: 24px; font-weight: 700; margin: 6px 0 8px; }
.sw-sub { font-size: 13px; color: var(--mut); line-height: 1.55; max-width: 620px; }

.sw-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
@media (max-width: 700px) { .sw-grid, .sw-stepper { grid-template-columns: 1fr; } }
.sw-field { display: block; }
.sw-hint { display: block; font-size: 11px; color: var(--mut); margin-top: 5px; }

.sw-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
.sw-chip { height: 28px; padding: 0 12px; border-radius: 99px; background: var(--card-alt); border: 1px solid var(--line2); color: var(--lbl); font-family: var(--num); font-size: 11.5px; font-weight: 600; cursor: pointer; transition: all 0.13s; }
.sw-chip:hover { color: var(--text); border-color: rgba(255,255,255,0.2); }
.sw-chip.on { background: var(--green-bg); border-color: var(--green-bd); color: var(--green); box-shadow: 0 0 10px -3px var(--green-glow); }

.sw-error { margin-top: 14px; padding: 10px 12px; border-radius: 9px; background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.3); color: var(--red); font-size: 12.5px; }
.sw-note { margin-top: 16px; padding: 12px; border-radius: 10px; background: rgba(251,191,36,0.08); border: 1px solid rgba(251,191,36,0.25); color: var(--amber); font-size: 12.5px; line-height: 1.55; }

.sw-actions { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--line); }

.sw-review { display: flex; flex-direction: column; gap: 0; }
.sw-rev-row { display: flex; gap: 12px; padding: 10px 0; align-items: flex-start; }
.sw-rev-row + .sw-rev-row { border-top: 1px solid var(--line); }
.sw-rev-k { width: 180px; flex-shrink: 0; font-size: 12px; color: var(--mut); }
.sw-rev-v { flex: 1; font-size: 12.5px; font-weight: 600; color: var(--text); word-break: break-word; }

.sw-success-banner { display: flex; align-items: center; gap: 14px; padding: 16px 18px; border-radius: 12px; background: linear-gradient(168deg, rgba(46,224,123,0.12), rgba(46,224,123,0.04)); border: 1px solid var(--green-bd); margin-bottom: 18px; }
.sw-success-dot { width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; font-size: 20px; background: radial-gradient(circle at 32% 28%, #46ff97, #0e6e33 75%); box-shadow: 0 0 16px var(--green-glow); flex-shrink: 0; }
.sw-success-h { font-family: var(--num); font-size: 16px; font-weight: 700; }
.sw-success-s { font-size: 12.5px; color: var(--mut); line-height: 1.5; margin-top: 3px; }
`;
