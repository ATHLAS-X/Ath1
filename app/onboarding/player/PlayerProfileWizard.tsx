"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ShieldAlert, Lock } from "lucide-react";
import { anton, barlow, barlowSemiCondensed } from "@/components/landing/Hero/fonts";
import { heroStyles } from "@/components/landing/Hero/styles";
import StepTransition from "@/components/onboarding/StepTransition";
import OnboardingShell from "@/components/onboarding/OnboardingShell";

interface StepMeta { n: number; name: string; optional?: boolean }
const STEPS: readonly StepMeta[] = [
  { n: 1, name: "Basic Info" },
  { n: 2, name: "Aadhaar Verification" },
  { n: 3, name: "Physical" },
  { n: 4, name: "Cricket" },
  { n: 5, name: "Bio" },
  { n: 6, name: "Media" },
  { n: 7, name: "Performance" },
  { n: 8, name: "Fitness", optional: true },
  { n: 9, name: "Consent" },
];

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat",
  "Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra",
  "Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim",
  "Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
];

type Form = Record<string, any>;

function calcAge(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
}

function maskAadhaar(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 12);
  const groups: string[] = [];
  for (let i = 0; i < digits.length; i += 4) groups.push(digits.slice(i, i + 4));
  return groups.join("-");
}

interface AadhaarResult {
  masked: string;
  dob: string;
  age: number;
  isMinor: boolean;
  discrepancy: boolean;
  pts: number;
}

export default function PlayerProfileWizard({ userName }: { userName: string }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Form>({});
  const [media, setMedia] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [academyQuery, setAcademyQuery] = useState("");
  const [academyResults, setAcademyResults] = useState<any[]>([]);

  /* Aadhaar verification (step 2) — own local state, separate from the
     profile `form` since it's verified server-side via its own endpoints
     rather than saved through /api/player/profile/save. */
  const [aadhaar, setAadhaar] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [aadhaarBusy, setAadhaarBusy] = useState(false);
  const [aadhaarError, setAadhaarError] = useState<string | null>(null);
  const [aadhaarResult, setAadhaarResult] = useState<AadhaarResult | null>(null);
  /* /api/onboarding/aadhaar/initiate returns this in non-production only —
     there's no real Surepass integration yet, so this IS the OTP; surfacing
     it is what makes the dummy flow actually testable instead of a dead end. */
  const [devOtp, setDevOtp] = useState<string | null>(null);

  /* Load existing draft on mount */
  useEffect(() => {
    fetch("/api/player/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data?.profile) {
          setForm({
            ...data.profile,
            yoyo_score: data.fitness?.yoyo_score ?? "",
            sprint_30m: data.fitness?.sprint_30m ?? "",
            run_2km:    data.fitness?.run_2km ?? "",
            ...(data.consent ?? {}),
          });
        }
        if (data?.media_count > 0) {
          fetch("/api/player/media").then((r) => r.json()).then(setMedia).catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  /* Debounced academy search */
  useEffect(() => {
    if (!academyQuery.trim()) {
      setAcademyResults([]);
      return;
    }
    const id = setTimeout(() => {
      fetch(`/api/academies/search?q=${encodeURIComponent(academyQuery)}`)
        .then((r) => r.json())
        .then((rows) => setAcademyResults(Array.isArray(rows) ? rows : []))
        .catch(() => setAcademyResults([]));
    }, 250);
    return () => clearTimeout(id);
  }, [academyQuery]);

  const age = useMemo(() => calcAge(form.date_of_birth ?? null), [form.date_of_birth]);
  const isMinor = age !== null && age < 18;

  function set<K extends string>(k: K, v: unknown) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function saveStep(payload: Form): Promise<boolean> {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/player/profile/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setError(data.error ?? "Save failed");
        return false;
      }
      return true;
    } finally {
      setSaving(false);
    }
  }

  async function next() {
    setError(null);
    const ok = await saveStep(stepPayload(step, form));
    if (!ok) return;
    if (step === 6 && media.length === 0) {
      setError("Add at least one video URL — required to submit");
      return;
    }
    if (step === 9) {
      await submit();
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length));
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(s - 1, 1));
  }

  async function submit() {
    setSubmitting(true);
    setError(null);

    /* Save consent first */
    const cRes = await fetch("/api/player/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parent_name:  form.parent_name ?? null,
        parent_phone: form.parent_phone ?? null,
        parent_email: form.parent_email ?? null,
        profile_visibility_ok: !!form.profile_visibility_ok,
        media_upload_ok:       !!form.media_upload_ok,
        scout_contact_ok:      !!form.scout_contact_ok,
        data_usage_ok:         !!form.data_usage_ok,
      }),
    });
    const cData = await cRes.json().catch(() => ({}));
    if (!cRes.ok || !cData.success) {
      setError(cData.error ?? "Consent failed");
      setSubmitting(false);
      return;
    }

    /* Save any pending fitness/perf fields */
    await saveStep({
      yoyo_score: undefined, /* fitness lives in fitness_data; out of scope here */
    });

    /* Submit */
    const res = await fetch("/api/player/profile/submit", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok || !data.success) {
      /* The server returns a structured `missing` array — surface it so
         the player knows exactly which step needs fixing. */
      const missing = Array.isArray(data?.missing) && data.missing.length > 0
        ? ` — missing: ${data.missing.join(", ")}`
        : "";
      setError((data?.error ?? "Submission failed") + missing);
      return;
    }
    router.push("/dashboard/player");
  }

  /* Aadhaar verification — ported from components/onboarding/steps/StepAadhaar.tsx.
     Two real endpoints: initiate sends an OTP, confirm verifies it and returns
     the masked Aadhaar + verified DOB + age + discrepancy flag. Unlike the
     original component, declared_dob is passed on confirm — form.date_of_birth
     is already collected in step 1, immediately before this step, so the
     discrepancy check (>6 months between declared and verified DOB) can
     actually fire; the original never sent it, so that warning was dead code
     in the 12-step flow. */
  async function initiateAadhaar() {
    setAadhaarError(null);
    const digits = aadhaar.replace(/\D/g, "");
    if (digits.length !== 12) return setAadhaarError("Enter a 12-digit Aadhaar number");
    setAadhaarBusy(true);
    try {
      const res = await fetch("/api/onboarding/aadhaar/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aadhaar: digits }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setAadhaarError(data?.error ?? "Could not send OTP");
        return;
      }
      setOtpSent(true);
      setDevOtp(data?.data?.dev_otp ?? null);
    } catch (e: any) {
      setAadhaarError(e?.message ?? "Network error");
    } finally {
      setAadhaarBusy(false);
    }
  }

  async function confirmAadhaar() {
    setAadhaarError(null);
    const digits = aadhaar.replace(/\D/g, "");
    if (!/^\d{6}$/.test(otp)) return setAadhaarError("Enter the 6-digit OTP");
    setAadhaarBusy(true);
    try {
      const res = await fetch("/api/onboarding/aadhaar/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aadhaar: digits, otp, declared_dob: form.date_of_birth ?? null }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setAadhaarError(data?.error ?? "Verification failed");
        return;
      }
      setAadhaarResult({
        masked: data.data.masked_aadhaar,
        dob: data.data.verified_dob,
        age: data.data.age,
        isMinor: !!data.data.is_minor,
        discrepancy: !!data.data.discrepancy_flag,
        pts: data.data.verification_pts ?? 3,
      });
    } catch (e: any) {
      setAadhaarError(e?.message ?? "Network error");
    } finally {
      setAadhaarBusy(false);
    }
  }

  async function addMedia(url: string, title: string) {
    const res = await fetch("/api/player/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, media_type: "video", title }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.success) {
      setMedia((m) => [data.media, ...m]);
    } else {
      setError(data.error ?? "Failed to add media");
    }
  }

  async function removeMedia(id: string) {
    await fetch("/api/player/media", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setMedia((m) => m.filter((x) => x.id !== id));
  }

  const stepBody = (
    <StepTransition step={step}>
      {step === 1 && <Step1 form={form} set={set} age={age} />}
      {step === 2 && (
        <Step2Aadhaar
          aadhaar={aadhaar} setAadhaar={setAadhaar}
          otp={otp} setOtp={setOtp} otpSent={otpSent}
          busy={aadhaarBusy} error={aadhaarError} result={aadhaarResult}
          initiate={initiateAadhaar} confirm={confirmAadhaar}
          devOtp={devOtp}
        />
      )}
      {step === 3 && <Step3 form={form} set={set} />}
      {step === 4 && <Step4 form={form} set={set}
        academyQuery={academyQuery} setAcademyQuery={setAcademyQuery}
        academyResults={academyResults} />}
      {step === 5 && <Step5 form={form} set={set} />}
      {step === 6 && <Step6 media={media} addMedia={addMedia} removeMedia={removeMedia} />}
      {step === 7 && <Step7 form={form} set={set} />}
      {step === 8 && <Step8 form={form} set={set} />}
      {step === 9 && <Step9 form={form} set={set} isMinor={isMinor} age={age} />}
    </StepTransition>
  );

  return (
    <div className={`${anton.variable} ${barlow.variable} ${barlowSemiCondensed.variable}`}>
      <style dangerouslySetInnerHTML={{ __html: heroStyles }} />
      <style dangerouslySetInnerHTML={{ __html: wizardStyles }} />
      <div className="pw-shell">
        <OnboardingShell
          role="player"
          eyebrow="Player Onboarding"
          title={<>Welcome, <b>{userName.split(" ")[0]}</b>.</>}
          desc="Nine steps, each auto-saved the moment you continue. Leave and resume anytime."
          steps={STEPS.map((s) => ({ label: s.name, optional: s.optional }))}
          stepIdx={step - 1}
          onStepClick={(i) => setStep(i + 1)}
          footMeta={`Step ${step} of ${STEPS.length}${STEPS[step - 1].optional ? " · optional" : ""}`}
          progressPct={(step / STEPS.length) * 100}
          nextLabel={saving ? "Saving…" : submitting ? "Submitting…" : step === 9 ? "Submit Profile" : "Save & Continue →"}
          onNext={next}
          nextDisabled={saving || submitting || (step === 2 && !aadhaarResult)}
          onBack={back}
          backHidden={step === 1}
          showSkip={!!STEPS[step - 1].optional}
          onSkip={() => setStep(step + 1)}
          userName={userName}
          belowBody={error ? <div className="pw-error">{error}</div> : null}
        >
          {stepBody}
        </OnboardingShell>
      </div>
    </div>
  );
}

/* ── helpers ── */

function stepPayload(step: number, f: Form): Form {
  const pick = (...keys: string[]) =>
    Object.fromEntries(keys.map((k) => [k, f[k] ?? null]));
  switch (step) {
    case 1: return pick("first_name", "last_name", "date_of_birth", "gender", "city", "state", "country");
    /* Aadhaar (step 2) is verified+persisted server-side via its own
       initiate/confirm endpoints, not the generic profile-save endpoint. */
    case 2: return {};
    case 3: return pick("height_cm", "weight_kg", "dominant_hand");
    case 4: return pick(
      "playing_role", "secondary_role", "batting_style", "bowling_style", "wicket_keeper",
      "school_team", "club_team", "district_team", "state_team", "academy_id",
    );
    case 5: return pick("bio", "aspirations", "strengths", "improvement_areas");
    case 6: return {};
    case 7: return pick("matches_played", "runs_scored", "wickets_taken", "highest_score", "best_bowling");
    case 8: return {};
    case 9: return {};
    default: return {};
  }
}

/* ── step components ── */

function Field({ label, children, hint }: any) {
  return (
    <div className="pw-field">
      <label className="pw-label">{label}</label>
      {children}
      {hint && <div className="pw-hint">{hint}</div>}
    </div>
  );
}

function Step1({ form, set, age }: any) {
  return (
    <div className="pw-grid pw-grid--2">
      <Field label="First name">
        <input className="pw-input" value={form.first_name ?? ""} onChange={(e) => set("first_name", e.target.value)} />
      </Field>
      <Field label="Last name">
        <input className="pw-input" value={form.last_name ?? ""} onChange={(e) => set("last_name", e.target.value)} />
      </Field>
      <Field label="Date of birth" hint={age !== null ? `Age ${age}${age < 18 ? " — minor, parental consent required" : ""}` : undefined}>
        <input type="date" className="pw-input" value={form.date_of_birth ?? ""} onChange={(e) => set("date_of_birth", e.target.value)} />
      </Field>
      <Field label="Gender">
        <select className="pw-input" value={form.gender ?? ""} onChange={(e) => set("gender", e.target.value)}>
          <option value="">Select</option>
          <option>Male</option><option>Female</option><option>Other</option>
        </select>
      </Field>
      <Field label="City">
        <input className="pw-input" value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />
      </Field>
      <Field label="State">
        <select className="pw-input" value={form.state ?? ""} onChange={(e) => set("state", e.target.value)}>
          <option value="">Select state</option>
          {INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="Country">
        <input className="pw-input" value={form.country ?? "India"} onChange={(e) => set("country", e.target.value)} />
      </Field>
    </div>
  );
}

function Step2Aadhaar({ aadhaar, setAadhaar, otp, setOtp, otpSent, busy, error, result, initiate, confirm, devOtp }: any) {
  const digits = aadhaar.replace(/\D/g, "");
  const displayMasked = maskAadhaar(aadhaar);
  const validAadhaar = digits.length === 12;
  const validOtp = /^\d{6}$/.test(otp);

  return (
    <div>
      <div className="pw-aadhaar-notice">
        <Lock size={18} />
        <div>
          <p className="pw-aadhaar-notice-title">
            We will NOT store your Aadhaar number — only your date of birth is extracted.
          </p>
          <p className="pw-aadhaar-notice-sub">Age verification for fair play — not shared with scouts.</p>
        </div>
      </div>

      <Field label="Aadhaar number" hint={`Auto-masked while you type. Digits entered: ${digits.length}/12`}>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="XXXX-XXXX-XXXX"
          value={displayMasked}
          disabled={!!result}
          onChange={(e) => setAadhaar(e.target.value)}
          maxLength={14}
          className="pw-input"
          style={{ fontFamily: "monospace", letterSpacing: "0.06em" }}
        />
      </Field>

      {!otpSent && !result && (
        <button
          type="button"
          className="btn green"
          onClick={initiate}
          disabled={!validAadhaar || busy}
          style={{ marginTop: 10 }}
        >
          {busy ? "Sending OTP…" : "Send OTP"}
        </button>
      )}

      {otpSent && !result && (
        <div style={{ marginTop: 14 }}>
          <Field
            label="OTP"
            hint={
              devOtp
                ? `Dummy OTP for testing — use ${devOtp} (any 6 digits also work).`
                : "OTP sent to Aadhaar-linked mobile (MVP: any 6 digits work)."
            }
          >
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="6-digit OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="pw-input"
              style={{ textAlign: "center", fontSize: 18, letterSpacing: "0.3em", fontFamily: "monospace" }}
            />
          </Field>
          <button
            type="button"
            className="btn green"
            onClick={confirm}
            disabled={!validOtp || busy}
            style={{ marginTop: 8 }}
          >
            {busy ? "Verifying…" : "Verify"}
          </button>
        </div>
      )}

      {result && (
        <div style={{ marginTop: 14 }}>
          <div className="pw-aadhaar-ok">
            <CheckCircle2 size={20} />
            <div style={{ flex: 1 }}>
              <div className="pw-aadhaar-ok-title">Aadhaar verified</div>
              <div className="pw-aadhaar-ok-sub">
                Stored as <code>{result.masked}</code>
              </div>
              <div className="pw-aadhaar-ok-sub">
                Verified DOB: <strong style={{ color: "var(--text)" }}>{result.dob}</strong> · Age {result.age}
                {result.isMinor && " (minor)"}
              </div>
            </div>
            <span className="bdg green">+{result.pts} pts</span>
          </div>

          {result.discrepancy && (
            <div className="pw-aadhaar-warn" style={{ marginTop: 10 }}>
              <ShieldAlert size={18} />
              <div>
                <div className="pw-aadhaar-warn-title">DOB discrepancy detected</div>
                <div className="pw-aadhaar-warn-sub">
                  Your declared date of birth differs from the verified Aadhaar DOB by more than 6 months.
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="pw-hint pw-aadhaar-error">{error}</p>}
    </div>
  );
}

function Step3({ form, set }: any) {
  return (
    <div className="pw-grid pw-grid--3">
      <Field label="Height (cm)">
        <input type="number" min={100} max={250} className="pw-input"
          value={form.height_cm ?? ""} onChange={(e) => set("height_cm", e.target.value)} />
      </Field>
      <Field label="Weight (kg)">
        <input type="number" min={20} max={200} className="pw-input"
          value={form.weight_kg ?? ""} onChange={(e) => set("weight_kg", e.target.value)} />
      </Field>
      <Field label="Dominant hand">
        <select className="pw-input" value={form.dominant_hand ?? ""} onChange={(e) => set("dominant_hand", e.target.value)}>
          <option value="">Select</option>
          <option>Right</option><option>Left</option><option>Ambidextrous</option>
        </select>
      </Field>
    </div>
  );
}

function Step4({ form, set, academyQuery, setAcademyQuery, academyResults }: any) {
  /* Keepers don't bowl. Lock bowling fields whenever the player is acting
     as a keeper — either as primary role or via the explicit checkbox. */
  const isKeeper = form.playing_role === "WK" || !!form.wicket_keeper;

  const setRole = (v: string) => {
    set("playing_role", v);
    if (v === "WK") {
      set("wicket_keeper", true);
      set("bowling_style", "");
      if (form.secondary_role === "Bowler") set("secondary_role", "");
    }
  };
  const setKeeper = (checked: boolean) => {
    set("wicket_keeper", checked);
    if (checked) {
      set("bowling_style", "");
      if (form.secondary_role === "Bowler") set("secondary_role", "");
    }
  };

  return (
    <div className="pw-grid pw-grid--2">
      <Field label="Primary role">
        <select className="pw-input" value={form.playing_role ?? ""} onChange={(e) => setRole(e.target.value)}>
          <option value="">Select</option>
          <option>Batsman</option><option>Bowler</option><option>All-Rounder</option><option>WK</option>
        </select>
      </Field>
      <Field label="Secondary role">
        <select className="pw-input" value={form.secondary_role ?? ""} onChange={(e) => set("secondary_role", e.target.value)}>
          <option value="">None</option>
          <option>Batsman</option>
          <option disabled={isKeeper}>Bowler</option>
          <option disabled={isKeeper}>All-Rounder</option>
          <option>WK</option>
        </select>
      </Field>
      <Field label="Batting style">
        <select className="pw-input" value={form.batting_style ?? ""} onChange={(e) => set("batting_style", e.target.value)}>
          <option value="">Select</option>
          <option>Right-hand bat</option><option>Left-hand bat</option>
        </select>
      </Field>
      <Field label="Bowling style">
        <select className="pw-input" value={isKeeper ? "" : (form.bowling_style ?? "")}
          disabled={isKeeper}
          onChange={(e) => set("bowling_style", e.target.value)}
          title={isKeeper ? "Keepers don't bowl" : undefined}
          style={isKeeper ? { opacity: 0.55, cursor: "not-allowed" } : undefined}>
          <option value="">{isKeeper ? "N/A — keeper" : "Select"}</option>
          <option>Fast</option><option>Medium Fast</option><option>Medium</option>
          <option>Off Spin</option><option>Leg Spin</option>
          <option>Left-arm Spin</option><option>Left-arm Fast</option>
        </select>
      </Field>
      <Field label="Wicket-keeper">
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
          <input type="checkbox" checked={!!form.wicket_keeper}
            disabled={form.playing_role === "WK"}
            onChange={(e) => setKeeper(e.target.checked)} />
          <span style={{ fontSize: 13 }}>
            Yes
            {form.playing_role === "WK" && (
              <span style={{ color: "var(--mut)", marginLeft: 6, fontSize: 11 }}>
                (auto — primary role is WK)
              </span>
            )}
          </span>
        </label>
      </Field>
      <Field label="Linked academy (optional)">
        <input className="pw-input" placeholder="Search academies…"
          value={academyQuery} onChange={(e) => setAcademyQuery(e.target.value)} />
        {academyResults.length > 0 && (
          <div className="pw-dropdown">
            {academyResults.map((a: any) => (
              <button key={a.id} type="button" className="pw-dropdown-item"
                onClick={() => { set("academy_id", a.id); setAcademyQuery(a.academy_name); }}>
                <strong>{a.academy_name}</strong>
                <span style={{ color: "var(--mut)", fontSize: 11 }}>
                  {[a.city, a.state].filter(Boolean).join(", ")}
                </span>
              </button>
            ))}
          </div>
        )}
        {form.academy_id && <div className="pw-hint">Linked ✓</div>}
      </Field>

      <div className="pw-grid pw-grid--2" style={{ gridColumn: "1 / -1" }}>
        <Field label="School team"><input className="pw-input" value={form.school_team ?? ""} onChange={(e) => set("school_team", e.target.value)} /></Field>
        <Field label="Club team"><input className="pw-input" value={form.club_team ?? ""} onChange={(e) => set("club_team", e.target.value)} /></Field>
        <Field label="District team"><input className="pw-input" value={form.district_team ?? ""} onChange={(e) => set("district_team", e.target.value)} /></Field>
        <Field label="State team"><input className="pw-input" value={form.state_team ?? ""} onChange={(e) => set("state_team", e.target.value)} /></Field>
      </div>
    </div>
  );
}

function Step5({ form, set }: any) {
  return (
    <div className="pw-grid pw-grid--1">
      <Field label="Bio" hint="Short intro — who you are as a cricketer">
        <textarea className="pw-input pw-textarea" value={form.bio ?? ""} onChange={(e) => set("bio", e.target.value)} />
      </Field>
      <Field label="Aspirations">
        <textarea className="pw-input pw-textarea" value={form.aspirations ?? ""} onChange={(e) => set("aspirations", e.target.value)} />
      </Field>
      <Field label="Strengths">
        <textarea className="pw-input pw-textarea" value={form.strengths ?? ""} onChange={(e) => set("strengths", e.target.value)} />
      </Field>
      <Field label="Improvement areas">
        <textarea className="pw-input pw-textarea" value={form.improvement_areas ?? ""} onChange={(e) => set("improvement_areas", e.target.value)} />
      </Field>
    </div>
  );
}

function Step6({ media, addMedia, removeMedia }: any) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  return (
    <div>
      <p style={{ color: "var(--mut)", fontSize: 12, marginBottom: 12 }}>
        <span style={{
          display: "inline-block", fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
          textTransform: "uppercase", color: "#FBBF24", border: "1px solid rgba(251,191,36,0.4)",
          borderRadius: 4, padding: "1px 6px", marginRight: 6,
        }}>Beta</span>
        Link-only for now — paste a YouTube URL (or any video URL hosted on
        R2/S3/Cloudinary). Direct upload isn't available yet. At least one
        video is required to submit.
      </p>
      <div className="pw-grid pw-grid--2" style={{ alignItems: "end" }}>
        <Field label="Video URL">
          <input className="pw-input" value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=…" />
        </Field>
        <Field label="Title (optional)">
          <input className="pw-input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
      </div>
      <button className="btn" style={{ marginTop: 8 }}
        onClick={() => { if (url.trim()) { addMedia(url.trim(), title.trim()); setUrl(""); setTitle(""); } }}>
        + Add video
      </button>

      <div style={{ marginTop: 18 }}>
        {media.length === 0 ? (
          <div className="pw-empty">No videos yet</div>
        ) : (
          media.map((m: any) => (
            <div key={m.id} className="pw-media-row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {m.title || m.youtube_video_id || m.url.slice(0, 40)}
                </div>
                <div style={{ fontSize: 11, color: "var(--mut)" }}>{m.url}</div>
              </div>
              <button className="btn sm danger" onClick={() => removeMedia(m.id)}>Remove</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Step7({ form, set }: any) {
  return (
    <div className="pw-grid pw-grid--3">
      <Field label="Matches played">
        <input type="number" min={0} className="pw-input"
          value={form.matches_played ?? ""} onChange={(e) => set("matches_played", e.target.value)} />
      </Field>
      <Field label="Runs scored">
        <input type="number" min={0} className="pw-input"
          value={form.runs_scored ?? ""} onChange={(e) => set("runs_scored", e.target.value)} />
      </Field>
      <Field label="Wickets taken">
        <input type="number" min={0} className="pw-input"
          value={form.wickets_taken ?? ""} onChange={(e) => set("wickets_taken", e.target.value)} />
      </Field>
      <Field label="Highest score">
        <input type="number" min={0} className="pw-input"
          value={form.highest_score ?? ""} onChange={(e) => set("highest_score", e.target.value)} />
      </Field>
      <Field label="Best bowling">
        <input className="pw-input" placeholder="e.g. 5/22"
          value={form.best_bowling ?? ""} onChange={(e) => set("best_bowling", e.target.value)} />
      </Field>
    </div>
  );
}

function Step8({ form, set }: any) {
  return (
    <div>
      <p style={{ color: "var(--mut)", fontSize: 12, marginBottom: 12 }}>
        These boost your profile score but are not required to submit.
      </p>
      <div className="pw-grid pw-grid--3">
        <Field label="YoYo score" hint="Test level (e.g. 17.4)">
          <input type="number" step="0.1" className="pw-input"
            value={form.yoyo_score ?? ""} onChange={(e) => set("yoyo_score", e.target.value)} />
        </Field>
        <Field label="30m sprint (sec)">
          <input type="number" step="0.01" className="pw-input"
            value={form.sprint_30m ?? ""} onChange={(e) => set("sprint_30m", e.target.value)} />
        </Field>
        <Field label="2km run (mm:ss)">
          <input className="pw-input" placeholder="7:52"
            value={form.run_2km ?? ""} onChange={(e) => set("run_2km", e.target.value)} />
        </Field>
      </div>
    </div>
  );
}

function Step9({ form, set, isMinor, age }: any) {
  return (
    <div>
      <div style={{
        padding: 12,
        background: isMinor ? "var(--amber-bg)" : "var(--green-bg)",
        border: `1px solid ${isMinor ? "var(--amber-bd)" : "var(--green-bd)"}`,
        borderRadius: 10,
        marginBottom: 18,
        fontSize: 12,
        color: isMinor ? "var(--amber)" : "var(--green)",
      }}>
        {age === null
          ? "Set your date of birth in Step 1 first."
          : isMinor
            ? `Player is ${age} — under 18. Parent/guardian details and all four consent checkboxes are required.`
            : `Player is ${age} — adult. Consents are recommended but not blocking.`}
      </div>

      {isMinor && (
        <div className="pw-grid pw-grid--2" style={{ marginBottom: 16 }}>
          <Field label="Parent / guardian name">
            <input className="pw-input" value={form.parent_name ?? ""} onChange={(e) => set("parent_name", e.target.value)} />
          </Field>
          <Field label="Parent phone">
            <input className="pw-input" value={form.parent_phone ?? ""} onChange={(e) => set("parent_phone", e.target.value)}
              placeholder="+91…" />
          </Field>
          <Field label="Parent email (optional)">
            <input type="email" className="pw-input" value={form.parent_email ?? ""} onChange={(e) => set("parent_email", e.target.value)} />
          </Field>
        </div>
      )}

      {[
        { k: "profile_visibility_ok", label: "I consent to my profile being visible to verified scouts when AthlasX makes it Live." },
        { k: "media_upload_ok",       label: "I consent to media (videos, photos) being hosted and shown on my profile." },
        { k: "scout_contact_ok",      label: "I consent to verified scouts contacting me about trials and opportunities." },
        { k: "data_usage_ok",         label: "I consent to my performance data being used by AthlasX's intelligence layer." },
      ].map((c) => (
        <label key={c.k} className="pw-consent">
          <input type="checkbox" checked={!!form[c.k]} onChange={(e) => set(c.k, e.target.checked)} />
          <span>{c.label}</span>
        </label>
      ))}
    </div>
  );
}

const wizardStyles = `
/* No max-width here — OnboardingShell now owns the full-bleed two-column
   layout (rail + form, edge-to-edge like the Hero section); this wrapper
   only scopes the pw-* field/step classes used inside it. */
.pw-shell { width: 100%; }

/* athlasx.css's .sx-root .btn/.bdg/.card no longer apply once this page
   drops .sx-root — equivalents scoped under .pw-shell so the existing
   className strings in the JSX below don't need to change. */
.pw-shell .card { background: var(--hx-bg-soft); border: 1px solid var(--hx-card-border); border-radius: 12px; }
.pw-shell .btn {
  display: inline-flex; align-items: center; justify-content: center;
  height: 30px; padding: 0 14px; border-radius: 8px;
  font-family: var(--font-barlow-semi), sans-serif; font-size: 11.5px; font-weight: 600;
  border: 1px solid var(--hx-card-border); background: var(--hx-bg-soft);
  color: var(--hx-text); cursor: pointer; transition: border-color 0.15s, background 0.15s;
  text-decoration: none;
}
.pw-shell .btn:hover { border-color: var(--hx-text-dim); background: var(--hx-field-bg); }
.pw-shell .btn:disabled { opacity: 0.5; cursor: not-allowed; }
.pw-shell .btn.green { background: var(--hx-accent); border-color: var(--hx-accent); color: #1a0e02; }
.pw-shell .btn.green:hover { background: var(--hx-accent-bright); border-color: var(--hx-accent-bright); }
.pw-shell .btn.sm { height: 24px; padding: 0 10px; font-size: 10.5px; border-radius: 6px; }
.pw-shell .btn.danger { border-color: rgba(248,113,113,0.4); color: #F87171; background: transparent; }
.pw-shell .btn.danger:hover { background: rgba(248,113,113,0.1); }
.pw-shell .bdg {
  display: inline-flex; align-items: center; height: 20px; padding: 0 8px; border-radius: 99px;
  font-family: var(--font-barlow-semi), sans-serif; font-size: 10px; font-weight: 600; white-space: nowrap;
}
.pw-shell .bdg.green { background: var(--hx-overlay-accent-14); border: 1px solid var(--hx-accent); color: var(--hx-accent-bright); }
.pw-shell .bdg.ghost { background: transparent; border: 1px solid var(--hx-card-border); color: var(--hx-text-dim); }

.pw-head { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 18px; gap: 12px; flex-wrap: wrap; }
.pw-title { font-family: var(--font-anton), sans-serif; text-transform: uppercase; font-weight: 400; font-size: 28px; margin-top: 4px; }
.pw-meta { font-size: 12px; color: var(--hx-text-dim); }
.pw-stepper { list-style: none; padding: 0; margin: 0 0 16px; display: grid; grid-template-columns: repeat(9, 1fr); gap: 4px; counter-reset: step; }
.pw-step { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 4px; border-radius: 8px; border: 1px solid var(--hx-card-border); background: var(--hx-field-bg); position: relative; }
.pw-step-dot { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; font-family: var(--font-barlow-semi), sans-serif; font-weight: 700; font-size: 11px; background: var(--hx-bg-soft); color: var(--hx-text-dim); border: 1px solid var(--hx-card-border); }
.pw-step-name { font-size: 10px; letter-spacing: 0.5px; color: var(--hx-text-dim); text-transform: uppercase; text-align: center; }
.pw-step--done  .pw-step-dot { background: var(--hx-accent); color: #1a0e02; border-color: var(--hx-accent); }
.pw-step--done  .pw-step-name { color: var(--hx-text); }
.pw-step--active { border-color: var(--hx-accent); box-shadow: 0 0 0 1px var(--hx-accent) inset; }
.pw-step--active .pw-step-dot { background: var(--hx-overlay-accent-14); color: var(--hx-accent-bright); border-color: var(--hx-accent); }
.pw-step--active .pw-step-name { color: var(--hx-accent-bright); font-weight: 600; }
.pw-body { padding: 24px; }
.pw-grid { display: grid; gap: 14px; }
.pw-grid--1 { grid-template-columns: 1fr; }
.pw-grid--2 { grid-template-columns: 1fr 1fr; }
.pw-grid--3 { grid-template-columns: 1fr 1fr 1fr; }
@media (max-width: 720px) {
  .pw-grid--2, .pw-grid--3 { grid-template-columns: 1fr; }
  .pw-stepper { grid-template-columns: repeat(4, 1fr); }
  .pw-stepper .pw-step:nth-child(n+5) { display: none; }
}
.pw-field { display: flex; flex-direction: column; gap: 4px; position: relative; }
.pw-label { font-size: 10.5px; letter-spacing: 1.4px; text-transform: uppercase; color: var(--hx-text-dim); font-family: var(--font-barlow-semi), sans-serif; font-weight: 600; }
.pw-input { height: 34px; padding: 0 11px; background: var(--hx-field-bg); border: 1px solid var(--hx-card-border); border-radius: 8px; color: var(--hx-text); font-family: inherit; font-size: 13px; outline: none; transition: border-color 0.15s, box-shadow 0.15s; }
.pw-input:focus { border-color: var(--hx-accent); box-shadow: 0 0 8px var(--hx-overlay-accent-22); }
/* The dropdown popup list itself is OS-rendered, but Chromium/Firefox do
   honor background/color set directly on <option> — without this the list
   falls back to default white-on-black system colors that clash hard with
   the dark theme (visible as a plain white popup with default blue highlight). */
select.pw-input option { background: var(--hx-bg-soft); color: var(--hx-text); }
.pw-textarea { height: 80px; padding: 8px 11px; resize: vertical; }
.pw-hint { font-size: 10.5px; color: var(--hx-text-dim); }
.pw-dropdown { position: absolute; top: 100%; left: 0; right: 0; z-index: 10; margin-top: 4px; background: var(--hx-bg-soft); border: 1px solid var(--hx-card-border); border-radius: 8px; overflow: hidden; }
.pw-dropdown-item { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; width: 100%; padding: 8px 11px; background: transparent; border: 0; color: var(--hx-text); cursor: pointer; font-family: inherit; font-size: 12.5px; text-align: left; }
.pw-dropdown-item:hover { background: var(--hx-field-bg); }
.pw-media-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid var(--hx-card-border); border-radius: 9px; background: var(--hx-field-bg); margin-bottom: 8px; }
.pw-empty { padding: 24px; text-align: center; color: var(--hx-text-dim); font-size: 13px; background: var(--hx-field-bg); border: 1px dashed var(--hx-card-border); border-radius: 9px; }
.pw-consent { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; background: var(--hx-field-bg); border: 1px solid var(--hx-card-border); border-radius: 9px; margin-bottom: 8px; font-size: 12.5px; line-height: 1.5; cursor: pointer; }
.pw-consent input { margin-top: 3px; flex-shrink: 0; accent-color: var(--hx-accent); }
.pw-error { margin: 12px 0; padding: 10px 14px; background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.3); border-radius: 9px; color: #F87171; font-size: 12.5px; }
.pw-nav { display: flex; justify-content: space-between; align-items: center; margin-top: 18px; }

/* Aadhaar step (step 2) */
.pw-aadhaar-notice { display: flex; gap: 10px; padding: 12px 14px; background: rgba(96,165,250,0.08); border: 1px solid rgba(96,165,250,0.3); border-radius: 10px; margin-bottom: 16px; }
.pw-aadhaar-notice svg { color: #60A5FA; flex-shrink: 0; margin-top: 2px; }
.pw-aadhaar-notice-title { font-size: 13px; font-weight: 600; color: var(--hx-text); margin: 0; }
.pw-aadhaar-notice-sub { font-size: 12px; color: var(--hx-text-dim); margin: 4px 0 0; }
.pw-aadhaar-ok { display: flex; align-items: flex-start; gap: 10px; padding: 14px; background: var(--hx-overlay-accent-14); border: 1px solid var(--hx-accent); border-radius: 10px; }
.pw-aadhaar-ok svg { color: var(--hx-accent-bright); flex-shrink: 0; margin-top: 2px; }
.pw-aadhaar-ok-title { font-size: 13px; font-weight: 600; color: var(--hx-text); }
.pw-aadhaar-ok-sub { font-size: 12px; color: var(--hx-text-dim); margin-top: 2px; }
.pw-aadhaar-warn { display: flex; align-items: flex-start; gap: 10px; padding: 14px; background: rgba(251,191,36,0.08); border: 1px solid rgba(251,191,36,0.3); border-radius: 10px; }
.pw-aadhaar-warn svg { color: #FBBF24; flex-shrink: 0; margin-top: 2px; }
.pw-aadhaar-warn-title { font-size: 13px; font-weight: 600; color: var(--hx-text); }
.pw-aadhaar-warn-sub { font-size: 12px; color: var(--hx-text-dim); margin-top: 2px; }
.pw-aadhaar-error { color: #F87171; margin-top: 10px; }
`;
