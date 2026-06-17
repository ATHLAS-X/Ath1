"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import "@/app/sportx.css";

interface StepMeta { n: number; name: string; optional?: boolean }
const STEPS: readonly StepMeta[] = [
  { n: 1, name: "Basic Info" },
  { n: 2, name: "Physical" },
  { n: 3, name: "Cricket" },
  { n: 4, name: "Bio" },
  { n: 5, name: "Media" },
  { n: 6, name: "Performance" },
  { n: 7, name: "Fitness", optional: true },
  { n: 8, name: "Consent" },
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
    if (step === 5 && media.length === 0) {
      setError("Add at least one video URL — required to submit");
      return;
    }
    if (step === 8) {
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

  return (
    <div className="sx-root" style={{ minHeight: "100vh", padding: 24 }}>
      <style>{wizardStyles}</style>

      <div className="pw-shell">
        <header className="pw-head">
          <div>
            <div className="sect-title">Player Profile — Setup</div>
            <h1 className="pw-title">Welcome, {userName.split(" ")[0]}</h1>
          </div>
          <div className="pw-meta">
            Step <strong>{step}</strong> of {STEPS.length}
            {STEPS[step - 1].optional && <span className="bdg ghost" style={{ marginLeft: 8 }}>Optional</span>}
          </div>
        </header>

        {/* Step indicator */}
        <ol className="pw-stepper">
          {STEPS.map((s) => {
            const state = s.n < step ? "done" : s.n === step ? "active" : "todo";
            return (
              <li key={s.n} className={`pw-step pw-step--${state}`}>
                <span className="pw-step-dot">{s.n < step ? "✓" : s.n}</span>
                <span className="pw-step-name">{s.name}</span>
              </li>
            );
          })}
        </ol>

        {/* Step body */}
        <div className="card pw-body">
          {step === 1 && <Step1 form={form} set={set} age={age} />}
          {step === 2 && <Step2 form={form} set={set} />}
          {step === 3 && <Step3 form={form} set={set}
            academyQuery={academyQuery} setAcademyQuery={setAcademyQuery}
            academyResults={academyResults} />}
          {step === 4 && <Step4 form={form} set={set} />}
          {step === 5 && <Step5 media={media} addMedia={addMedia} removeMedia={removeMedia} />}
          {step === 6 && <Step6 form={form} set={set} />}
          {step === 7 && <Step7 form={form} set={set} />}
          {step === 8 && <Step8 form={form} set={set} isMinor={isMinor} age={age} />}
        </div>

        {error && (
          <div className="pw-error">{error}</div>
        )}

        <div className="pw-nav">
          <button type="button" className="btn" onClick={back} disabled={step === 1 || saving || submitting}>
            ← Back
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            {STEPS[step - 1].optional && (
              <button type="button" className="btn" onClick={() => setStep(step + 1)} disabled={saving}>
                Skip
              </button>
            )}
            <button type="button" className="btn green" onClick={next} disabled={saving || submitting}>
              {saving ? "Saving…" : submitting ? "Submitting…" : step === 8 ? "Submit Profile" : "Save & Continue →"}
            </button>
          </div>
        </div>
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
    case 2: return pick("height_cm", "weight_kg", "dominant_hand");
    case 3: return pick(
      "playing_role", "secondary_role", "batting_style", "bowling_style", "wicket_keeper",
      "school_team", "club_team", "district_team", "state_team", "academy_id",
    );
    case 4: return pick("bio", "aspirations", "strengths", "improvement_areas");
    case 5: return {};
    case 6: return pick("matches_played", "runs_scored", "wickets_taken", "highest_score", "best_bowling");
    case 7: return {};
    case 8: return {};
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

function Step2({ form, set }: any) {
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

function Step3({ form, set, academyQuery, setAcademyQuery, academyResults }: any) {
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

function Step4({ form, set }: any) {
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

function Step5({ media, addMedia, removeMedia }: any) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  return (
    <div>
      <p style={{ color: "var(--mut)", fontSize: 12, marginBottom: 12 }}>
        Paste a YouTube URL (or any video URL hosted on R2/S3/Cloudinary). At
        least one video is required to submit.
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

function Step6({ form, set }: any) {
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

function Step7({ form, set }: any) {
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

function Step8({ form, set, isMinor, age }: any) {
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
        { k: "profile_visibility_ok", label: "I consent to my profile being visible to verified scouts when SportX makes it Live." },
        { k: "media_upload_ok",       label: "I consent to media (videos, photos) being hosted and shown on my profile." },
        { k: "scout_contact_ok",      label: "I consent to verified scouts contacting me about trials and opportunities." },
        { k: "data_usage_ok",         label: "I consent to my performance data being used by SportX's intelligence layer." },
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
.pw-shell { max-width: 920px; margin: 0 auto; }
.pw-head { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 18px; gap: 12px; flex-wrap: wrap; }
.pw-title { font-family: var(--num); font-size: 28px; font-weight: 700; margin-top: 4px; }
.pw-meta { font-size: 12px; color: var(--mut); }
.pw-stepper { list-style: none; padding: 0; margin: 0 0 16px; display: grid; grid-template-columns: repeat(8, 1fr); gap: 4px; counter-reset: step; }
.pw-step { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 4px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); position: relative; }
.pw-step-dot { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; font-family: var(--num); font-weight: 700; font-size: 11px; background: var(--card-alt); color: var(--lbl); border: 1px solid var(--line2); }
.pw-step-name { font-size: 10px; letter-spacing: 0.5px; color: var(--mut); text-transform: uppercase; text-align: center; }
.pw-step--done  .pw-step-dot { background: var(--green); color: #000; border-color: var(--green); }
.pw-step--done  .pw-step-name { color: var(--text); }
.pw-step--active { border-color: var(--green-bd); box-shadow: 0 0 0 1px var(--green-bd) inset; }
.pw-step--active .pw-step-dot { background: var(--green-bg); color: var(--green); border-color: var(--green-bd); }
.pw-step--active .pw-step-name { color: var(--green); font-weight: 600; }
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
.pw-label { font-size: 10.5px; letter-spacing: 1.4px; text-transform: uppercase; color: var(--lbl); font-family: var(--num); font-weight: 600; }
.pw-input { height: 34px; padding: 0 11px; background: var(--card-alt); border: 1px solid var(--line2); border-radius: 8px; color: var(--text); font-family: inherit; font-size: 13px; outline: none; transition: border-color 0.15s, box-shadow 0.15s; }
.pw-input:focus { border-color: var(--green); box-shadow: 0 0 8px var(--green-glow); }
.pw-textarea { height: 80px; padding: 8px 11px; resize: vertical; }
.pw-hint { font-size: 10.5px; color: var(--mut); }
.pw-dropdown { position: absolute; top: 100%; left: 0; right: 0; z-index: 10; margin-top: 4px; background: var(--card); border: 1px solid var(--line2); border-radius: 8px; overflow: hidden; }
.pw-dropdown-item { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; width: 100%; padding: 8px 11px; background: transparent; border: 0; color: var(--text); cursor: pointer; font-family: inherit; font-size: 12.5px; text-align: left; }
.pw-dropdown-item:hover { background: var(--card-alt); }
.pw-media-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 9px; background: var(--card-alt); margin-bottom: 8px; }
.pw-empty { padding: 24px; text-align: center; color: var(--mut); font-size: 13px; background: var(--card-alt); border: 1px dashed var(--line2); border-radius: 9px; }
.pw-consent { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; background: var(--card-alt); border: 1px solid var(--line); border-radius: 9px; margin-bottom: 8px; font-size: 12.5px; line-height: 1.5; cursor: pointer; }
.pw-consent input { margin-top: 3px; flex-shrink: 0; }
.pw-error { margin: 12px 0; padding: 10px 14px; background: var(--red-bg); border: 1px solid var(--red-bd); border-radius: 9px; color: var(--red); font-size: 12.5px; }
.pw-nav { display: flex; justify-content: space-between; align-items: center; margin-top: 18px; }
`;
