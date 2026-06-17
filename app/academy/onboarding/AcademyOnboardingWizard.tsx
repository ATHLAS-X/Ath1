"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import "@/app/sportx.css";

/* Post-registration academy wizard.
   4 steps: Logo → First Coach → First Players (CSV or single) → Complete.
   Each "Continue" call persists the step to `academies.onboarding_step`
   via /api/academy/onboarding/state so the admin can resume later. */

interface Props {
  academyName: string;
  logoUrl: string | null;
  startStep: number;
  initialCoachCount: number;
  initialPlayerCount: number;
}

const STEPS = [
  { n: "Academy Logo",   d: "Optional — JPG / PNG / WebP" },
  { n: "First Coach",    d: "Optional — add more later" },
  { n: "Add Players",    d: "CSV or single" },
  { n: "Review & Go",    d: "Submit for review" },
];

const SPECIALIZATIONS = ["Batting", "Bowling", "Fitness", "Wicketkeeping", "Mental Conditioning"];
const ROLES = ["Batsman", "Bowler", "All-Rounder", "WK"];
const GENDERS = ["Male", "Female", "Other"];
const BAT_STYLES = ["Right-hand bat", "Left-hand bat"];
const BOWL_STYLES = ["Right-arm fast", "Left-arm fast", "Right-arm medium", "Left-arm medium", "Off Spin", "Leg Spin", "Left-arm Spin"];

const CSV_HEADERS = [
  "first_name", "last_name", "date_of_birth", "gender",
  "primary_role", "batting_style", "bowling_style",
  "city", "state", "height_cm", "weight_kg",
];

export default function AcademyOnboardingWizard(p: Props) {
  const router = useRouter();
  const [step, setStep] = useState(p.startStep);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coachCount, setCoachCount] = useState(p.initialCoachCount);
  const [playerCount, setPlayerCount] = useState(p.initialPlayerCount);
  const [logoUrl, setLogoUrl] = useState<string | null>(p.logoUrl);

  const persistStep = useCallback(async (n: number) => {
    await fetch("/api/academy/onboarding/state", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: n }),
    }).catch(() => {});
  }, []);

  const goNext = useCallback(async () => {
    setError(null);
    const next = Math.min(4, step + 1);
    await persistStep(next);
    setStep(next);
  }, [step, persistStep]);

  const goBack = () => step > 1 && setStep(step - 1);

  async function complete() {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/academy/onboarding/complete", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!data?.success) { setError(data?.error ?? "Could not complete onboarding"); return; }
      router.push("/academy/dashboard");
    } finally { setBusy(false); }
  }

  return (
    <div className="sx-root ao-root">
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <div className="ao-shell">

        {/* Top bar */}
        <div className="ao-top">
          <div className="ao-brand">
            <div className="logo-ball" />
            <div>
              <div className="logo-word">SPORT<em>X</em></div>
              <div className="ao-acad">{p.academyName} · Setup</div>
            </div>
          </div>
          <div className="ao-stepind">Step {step} of {STEPS.length}</div>
        </div>

        <div className="ao-grid">
          {/* Sidebar (desktop) / horizontal stepper (mobile) */}
          <aside className="ao-side">
            {STEPS.map((s, i) => {
              const n = i + 1;
              const state = n < step ? "done" : n === step ? "active" : "todo";
              return (
                <button
                  key={s.n}
                  type="button"
                  className={`ao-step ao-step--${state}`}
                  onClick={() => n <= step && setStep(n)}
                  disabled={n > step}
                >
                  <div className="ao-step-num">{state === "done" ? "✓" : n}</div>
                  <div>
                    <div className="ao-step-n">{s.n}</div>
                    <div className="ao-step-d">{s.d}</div>
                  </div>
                </button>
              );
            })}
          </aside>

          {/* Main card */}
          <div className="card ao-card">
            {step === 1 && <StepLogo logoUrl={logoUrl} setLogoUrl={setLogoUrl} onError={setError} />}
            {step === 2 && <StepCoach onAdded={() => setCoachCount((c) => c + 1)} onError={setError} />}
            {step === 3 && <StepPlayers onCountChange={setPlayerCount} onError={setError} />}
            {step === 4 && (
              <StepReview
                academyName={p.academyName}
                logoUrl={logoUrl}
                coachCount={coachCount}
                playerCount={playerCount}
              />
            )}

            {error && <p className="ao-error">{error}</p>}

            <div className="ao-actions">
              <button className="btn" disabled={busy || step === 1} onClick={goBack}>← Back</button>
              <div className="ao-count">
                {step === 2 && <span className="bdg ghost">{coachCount} coach{coachCount === 1 ? "" : "es"} added</span>}
                {step === 3 && <span className="bdg ghost">{playerCount} player{playerCount === 1 ? "" : "s"} added</span>}
              </div>
              {step < 4 ? (
                <button className="btn green" onClick={goNext} disabled={busy}>
                  Continue →
                </button>
              ) : (
                <button className="btn green" onClick={complete} disabled={busy}>
                  {busy ? "Submitting…" : "Go to Dashboard"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Step 1 ───────────────────────── */
function StepLogo({ logoUrl, setLogoUrl, onError }: { logoUrl: string | null; setLogoUrl: (u: string) => void; onError: (m: string | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handle = async (file: File) => {
    onError(null);
    if (file.size > 2 * 1024 * 1024) { onError("Logo must be 2 MB or smaller."); return; }
    if (!/^(image\/jpe?g|image\/png|image\/webp)$/.test(file.type)) {
      onError("Use a JPG, PNG, or WebP image."); return;
    }
    const fd = new FormData(); fd.set("logo", file);
    setBusy(true);
    try {
      const res = await fetch("/api/academy/logo", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!data?.success) { onError(data?.error ?? "Upload failed"); return; }
      setLogoUrl(data.logo_url);
    } finally { setBusy(false); }
  };

  return (
    <div>
      <span className="sect-title">Step 1 of 4</span>
      <h2 className="ao-h2">Upload Your Academy Logo</h2>
      <p className="ao-sub">
        Appears on your public profile and on rosters you submit to scouts.
        Optional — you can add this later from your dashboard.
      </p>

      <div className="ao-logo-row">
        <div className="ao-logo-preview">
          {logoUrl
            ? <img src={logoUrl} alt="Academy logo preview" />
            : <span className="ao-logo-placeholder">No logo yet</span>}
        </div>
        <div className="ao-logo-actions">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handle(f);
              e.target.value = "";
            }}
          />
          <button className="btn green" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? "Uploading…" : logoUrl ? "Replace logo" : "Choose file"}
          </button>
          <div className="ao-logo-hint">JPG / PNG / WebP · max 2 MB</div>
        </div>
      </div>

      <p className="ao-skip">Don&apos;t have a logo yet? Hit <strong>Continue</strong> to skip — you can add it later from <code>/dashboard/academy/settings</code>.</p>
    </div>
  );
}

/* ───────────────────────── Step 2 ───────────────────────── */
function StepCoach({ onAdded, onError }: { onAdded: () => void; onError: (m: string | null) => void }) {
  const [form, setForm] = useState({
    coach_name: "", specialization: "", years_experience: "" as string | number,
    certifications: "", can_submit_fitness: false, can_submit_evaluations: false,
  });
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<string | null>(null);

  const submit = async () => {
    onError(null); setAdded(null);
    if (!form.coach_name.trim()) { onError("Coach name is required"); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/academy/coaches", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, years_experience: form.years_experience === "" ? null : Number(form.years_experience) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data?.success) { onError(data?.error ?? "Could not add coach"); return; }
      setAdded(data.coach.coach_name);
      onAdded();
      setForm({ coach_name: "", specialization: "", years_experience: "", certifications: "", can_submit_fitness: false, can_submit_evaluations: false });
    } finally { setBusy(false); }
  };

  return (
    <div>
      <span className="sect-title">Step 2 of 4</span>
      <h2 className="ao-h2">Add Your First Coach</h2>
      <p className="ao-sub">
        Coaches you add here go straight into your academy roster.
        You can add more from your dashboard at any time.
      </p>

      {added && (
        <div className="ao-banner ao-banner--ok">
          ✓ {added} added. Add another or hit <strong>Continue</strong> when done.
        </div>
      )}

      <div className="ao-grid2">
        <Field label="Coach name *">
          <input className="sinput" value={form.coach_name}
            onChange={(e) => setForm({ ...form, coach_name: e.target.value })}
            placeholder="e.g. Rohit Mehta" />
        </Field>
        <Field label="Specialization">
          <select className="sinput" value={form.specialization}
            onChange={(e) => setForm({ ...form, specialization: e.target.value })}>
            <option value="">Select…</option>
            {SPECIALIZATIONS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Years of experience">
          <input className="sinput" type="number" min={0} max={80}
            value={form.years_experience}
            onChange={(e) => setForm({ ...form, years_experience: e.target.value })}
            placeholder="0" />
        </Field>
        <Field label="Certifications (optional)">
          <input className="sinput" value={form.certifications}
            onChange={(e) => setForm({ ...form, certifications: e.target.value })}
            placeholder="e.g. BCCI L2, NCA Level 1" />
        </Field>
      </div>

      <div className="ao-perms">
        <ToggleRow
          label="Can submit fitness assessments"
          desc="YoYo, sprint, 2km — counts toward player fitness score"
          on={form.can_submit_fitness}
          onChange={(v) => setForm({ ...form, can_submit_fitness: v })}
        />
        <ToggleRow
          label="Can submit player evaluations"
          desc="Skill + behavioural ratings — counts toward Performance Verified"
          on={form.can_submit_evaluations}
          onChange={(v) => setForm({ ...form, can_submit_evaluations: v })}
        />
      </div>

      <div className="ao-row">
        <button className="btn green" disabled={busy} onClick={submit}>
          {busy ? "Adding…" : "Add coach"}
        </button>
        <span className="ao-skip-inline">Skip for now</span>
      </div>
    </div>
  );
}

function ToggleRow({ label, desc, on, onChange }: { label: string; desc: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="ao-toggle-row">
      <div>
        <div className="ao-toggle-n">{label}</div>
        <div className="ao-toggle-d">{desc}</div>
      </div>
      <span className={`ao-toggle${on ? " on" : ""}`} onClick={() => onChange(!on)}>
        <span className="ao-toggle-knob" />
      </span>
    </label>
  );
}

/* ───────────────────────── Step 3 ───────────────────────── */
function StepPlayers({ onCountChange, onError }: { onCountChange: (n: number) => void; onError: (m: string | null) => void }) {
  const [tab, setTab] = useState<"csv" | "manual">("csv");

  return (
    <div>
      <span className="sect-title">Step 3 of 4</span>
      <h2 className="ao-h2">Upload Your First Players</h2>
      <p className="ao-sub">
        Bulk-import from a CSV or add one player at a time.
        Players land as Draft profiles tagged with your academy.
      </p>

      <div className="ao-tabs">
        <button className={`ao-tab${tab === "csv" ? " on" : ""}`} onClick={() => setTab("csv")}>CSV Upload</button>
        <button className={`ao-tab${tab === "manual" ? " on" : ""}`} onClick={() => setTab("manual")}>Add One Player</button>
      </div>

      {tab === "csv"
        ? <CsvTab onCountChange={onCountChange} onError={onError} />
        : <ManualTab onCountChange={onCountChange} onError={onError} />}
    </div>
  );
}

interface ParsedRow {
  data: Record<string, string>;
  errors: string[];
}

function parseCsvText(text: string): { headers: string[]; rows: string[][] } {
  const out: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuote) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQuote = false;
      else cur += c;
    } else {
      if (c === '"') inQuote = true;
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n") { row.push(cur); out.push(row); row = []; cur = ""; }
      else if (c === "\r") {}
      else cur += c;
    }
  }
  if (cur.length > 0 || row.length > 0) { row.push(cur); out.push(row); }
  const filtered = out.filter((r) => r.some((c) => c.trim() !== ""));
  if (filtered.length === 0) return { headers: [], rows: [] };
  return { headers: filtered[0].map((h) => h.trim().toLowerCase()), rows: filtered.slice(1) };
}

function validateRow(r: Record<string, string>): string[] {
  const errors: string[] = [];
  if (!r.first_name?.trim()) errors.push("first_name");
  if (!r.last_name?.trim()) errors.push("last_name");
  if (r.date_of_birth && !/^\d{4}-\d{2}-\d{2}$/.test(r.date_of_birth.trim())) errors.push("date_of_birth (YYYY-MM-DD)");
  if (r.gender && !GENDERS.includes(r.gender.trim())) errors.push("gender (Male/Female/Other)");
  if (r.primary_role && !ROLES.includes(r.primary_role.trim())) errors.push("primary_role");
  if (r.height_cm && isNaN(Number(r.height_cm))) errors.push("height_cm");
  if (r.weight_kg && isNaN(Number(r.weight_kg))) errors.push("weight_kg");
  return errors;
}

function CsvTab({ onCountChange, onError }: { onCountChange: (n: number) => void; onError: (m: string | null) => void }) {
  const [csvText, setCsvText] = useState<string>("");
  const [filename, setFilename] = useState<string>("");
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<{ created: number; skipped: number; errors: number } | null>(null);

  const downloadTemplate = () => {
    const blob = new Blob([CSV_HEADERS.join(",") + "\n"], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "sportx-players-template.csv";
    a.click(); URL.revokeObjectURL(url);
  };

  const onFile = async (file: File) => {
    onError(null); setSummary(null);
    if (!/\.csv$/i.test(file.name)) { onError("Please upload a .csv file"); return; }
    const text = await file.text();
    setCsvText(text); setFilename(file.name);
    const { headers, rows } = parseCsvText(text);
    if (headers.length === 0) { onError("CSV is empty"); return; }
    const rowsTyped: ParsedRow[] = rows.map((r) => {
      const data: Record<string, string> = {};
      headers.forEach((h, i) => { data[h] = (r[i] ?? "").trim(); });
      /* The API expects playing_role; allow CSV to use primary_role too. */
      if (!data.playing_role && data.primary_role) data.playing_role = data.primary_role;
      return { data, errors: validateRow(data) };
    });
    setParsed(rowsTyped);
  };

  const importAll = async () => {
    if (parsed.some((r) => r.errors.length > 0)) {
      onError("Fix row errors before importing."); return;
    }
    setBusy(true); onError(null);
    try {
      const res = await fetch("/api/academy/players/bulk", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data?.success) { onError(data?.error ?? "Bulk import failed"); return; }
      setSummary(data.summary);
      onCountChange((data.summary?.created ?? 0));
      setParsed([]); setCsvText(""); setFilename("");
    } finally { setBusy(false); }
  };

  const previewRows = parsed.slice(0, 5);
  const validCount = parsed.filter((r) => r.errors.length === 0).length;
  const errorCount = parsed.length - validCount;

  return (
    <div className="ao-csv">
      <div className="ao-csv-actions">
        <button className="btn" onClick={downloadTemplate}>↓ Download CSV template</button>
        <label className="btn green">
          <input type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
          {filename ? `Selected: ${filename}` : "Choose CSV file"}
        </label>
      </div>

      {parsed.length > 0 && (
        <>
          <div className="ao-validation">
            <span className="bdg green">{validCount} valid</span>
            {errorCount > 0 && <span className="bdg red">{errorCount} with errors</span>}
            <span className="bdg ghost">Total {parsed.length} rows</span>
          </div>

          <div className="ao-table-wrap">
            <table className="ao-table">
              <thead>
                <tr><th>#</th>{CSV_HEADERS.map((h) => <th key={h}>{h}</th>)}<th>Status</th></tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i}>
                    <td>{i + 2}</td>
                    {CSV_HEADERS.map((h) => <td key={h}>{row.data[h] ?? ""}</td>)}
                    <td>
                      {row.errors.length === 0
                        ? <span className="bdg green">OK</span>
                        : <span className="bdg red" title={row.errors.join(", ")}>Errors</span>}
                    </td>
                  </tr>
                ))}
                {parsed.length > 5 && (
                  <tr><td colSpan={CSV_HEADERS.length + 2} style={{ textAlign: "center", color: "var(--mut)" }}>
                    + {parsed.length - 5} more row{parsed.length - 5 === 1 ? "" : "s"} not shown
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          {errorCount > 0 && (
            <div className="ao-row-errors">
              {parsed.filter((r) => r.errors.length > 0).slice(0, 5).map((r, i) => (
                <div key={i} className="ao-row-error">
                  Row {parsed.indexOf(r) + 2}: missing/invalid <strong>{r.errors.join(", ")}</strong>
                </div>
              ))}
            </div>
          )}

          <div className="ao-row" style={{ marginTop: 14 }}>
            <button className="btn green" disabled={busy || errorCount > 0 || parsed.length === 0} onClick={importAll}>
              {busy ? "Importing…" : `Import ${validCount} player${validCount === 1 ? "" : "s"}`}
            </button>
          </div>
        </>
      )}

      {summary && (
        <div className="ao-banner ao-banner--ok" style={{ marginTop: 14 }}>
          ✓ {summary.created} player{summary.created === 1 ? "" : "s"} imported successfully.
          {summary.skipped > 0 && <> {summary.skipped} skipped (already on SportX).</>}
          {summary.errors > 0 && <> {summary.errors} failed.</>}
        </div>
      )}
    </div>
  );
}

function ManualTab({ onCountChange, onError }: { onCountChange: (n: number) => void; onError: (m: string | null) => void }) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(0);

  const submit = async () => {
    onError(null);
    if (!form.first_name?.trim() || !form.last_name?.trim()) {
      onError("First and last name are required."); return;
    }
    /* Build a 1-row CSV and reuse the bulk endpoint. */
    const headers = CSV_HEADERS;
    const escape = (v: string) => v.includes(",") ? `"${v.replace(/"/g, '""')}"` : v;
    const csv = headers.join(",") + "\n" +
      headers.map((h) => escape(form[h] ?? "")).join(",") + "\n";

    setBusy(true);
    try {
      const res = await fetch("/api/academy/players/bulk", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data?.success || (data.summary?.created ?? 0) === 0) {
        onError(data?.results?.[0]?.error ?? data?.error ?? "Could not add player");
        return;
      }
      const next = added + (data.summary.created as number);
      setAdded(next);
      onCountChange(next);
      setForm({});
    } finally { setBusy(false); }
  };

  return (
    <div className="ao-manual">
      <div className="ao-grid2">
        <Field label="First name *">
          <input className="sinput" value={form.first_name ?? ""} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
        </Field>
        <Field label="Last name *">
          <input className="sinput" value={form.last_name ?? ""} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
        </Field>
        <Field label="Date of birth">
          <input className="sinput" type="date" value={form.date_of_birth ?? ""} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
        </Field>
        <Field label="Gender">
          <select className="sinput" value={form.gender ?? ""} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
            <option value="">Select…</option>
            {GENDERS.map((g) => <option key={g}>{g}</option>)}
          </select>
        </Field>
        <Field label="Primary role">
          <select className="sinput" value={form.primary_role ?? ""} onChange={(e) => setForm({ ...form, primary_role: e.target.value })}>
            <option value="">Select…</option>
            {ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Batting style">
          <select className="sinput" value={form.batting_style ?? ""} onChange={(e) => setForm({ ...form, batting_style: e.target.value })}>
            <option value="">Select…</option>
            {BAT_STYLES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Bowling style">
          <select className="sinput" value={form.bowling_style ?? ""} onChange={(e) => setForm({ ...form, bowling_style: e.target.value })}>
            <option value="">Select…</option>
            {BOWL_STYLES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="City">
          <input className="sinput" value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </Field>
        <Field label="State">
          <input className="sinput" value={form.state ?? ""} onChange={(e) => setForm({ ...form, state: e.target.value })} />
        </Field>
        <Field label="Height (cm)">
          <input className="sinput" type="number" value={form.height_cm ?? ""} onChange={(e) => setForm({ ...form, height_cm: e.target.value })} />
        </Field>
        <Field label="Weight (kg)">
          <input className="sinput" type="number" value={form.weight_kg ?? ""} onChange={(e) => setForm({ ...form, weight_kg: e.target.value })} />
        </Field>
      </div>

      <div className="ao-row" style={{ marginTop: 12 }}>
        <button className="btn green" disabled={busy} onClick={submit}>
          {busy ? "Adding…" : "Add player"}
        </button>
        {added > 0 && <span className="bdg green" style={{ marginLeft: 10 }}>{added} added so far</span>}
      </div>
    </div>
  );
}

/* ───────────────────────── Step 4 ───────────────────────── */
function StepReview({ academyName, logoUrl, coachCount, playerCount }: {
  academyName: string; logoUrl: string | null; coachCount: number; playerCount: number;
}) {
  return (
    <div>
      <span className="sect-title">Step 4 of 4</span>
      <h2 className="ao-h2">You&apos;re all set</h2>
      <p className="ao-sub">
        We&apos;ll review your academy before going live. Coaches and player
        rosters are already saved — you can continue editing from your
        dashboard at any time.
      </p>

      <div className="ao-summary">
        <div className="ao-summary-row">
          <div className="ao-summary-k">Academy</div>
          <div className="ao-summary-v">
            <span className="bdg green">✓</span>{" "}
            <strong>{academyName}</strong>
            {logoUrl && <span style={{ marginLeft: 8, color: "var(--mut)" }}>· Logo uploaded</span>}
          </div>
        </div>
        <div className="ao-summary-row">
          <div className="ao-summary-k">Coaches</div>
          <div className="ao-summary-v">
            <span className={`bdg ${coachCount > 0 ? "green" : "ghost"}`}>{coachCount}</span>
            {coachCount === 0 && <span style={{ marginLeft: 8, color: "var(--mut)" }}>· You can add coaches later</span>}
          </div>
        </div>
        <div className="ao-summary-row">
          <div className="ao-summary-k">Players</div>
          <div className="ao-summary-v">
            <span className={`bdg ${playerCount > 0 ? "green" : "ghost"}`}>{playerCount}</span>
            {playerCount === 0 && <span style={{ marginLeft: 8, color: "var(--mut)" }}>· Import a roster from your dashboard</span>}
          </div>
        </div>
      </div>

      <p className="ao-note">
        ⏳ Your academy profile will be reviewed by SportX within
        <strong> 48 hours </strong> before going live.
      </p>
    </div>
  );
}

/* ───────────────────────── Shared ───────────────────────── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="ao-field">
      <span className="f-label">{label}</span>
      {children}
    </label>
  );
}

const STYLES = `
.ao-root { min-height: 100vh; padding: 22px 18px 48px; }
.ao-shell { max-width: 1180px; margin: 0 auto; }

.ao-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid var(--line); }
.ao-brand { display: flex; align-items: center; gap: 12px; }
.logo-ball { width: 28px; height: 28px; border-radius: 50%; background: radial-gradient(circle at 32% 28%, #46ff97, #0e6e33 72%); box-shadow: 0 0 16px var(--green-glow), inset 0 -5px 8px rgba(0,0,0,0.35), inset 0 2px 3px rgba(255,255,255,0.4); position: relative; }
.logo-word { font-family: var(--num); font-size: 16px; font-weight: 700; letter-spacing: 0.05em; }
.logo-word em { font-style: normal; color: var(--green); }
.ao-acad { font-size: 11px; color: var(--mut); margin-top: 1px; }
.ao-stepind { font-family: var(--num); font-size: 11px; font-weight: 600; color: var(--lbl); letter-spacing: 1.5px; text-transform: uppercase; }

.ao-grid { display: grid; grid-template-columns: 240px 1fr; gap: 22px; align-items: start; }
@media (max-width: 800px) { .ao-grid { grid-template-columns: 1fr; } }

.ao-side { display: flex; flex-direction: column; gap: 8px; position: sticky; top: 22px; }
@media (max-width: 800px) { .ao-side { flex-direction: row; overflow-x: auto; position: static; gap: 6px; } }
.ao-step { display: flex; align-items: center; gap: 11px; padding: 11px 13px; border-radius: 10px; background: var(--card-alt); border: 1px solid var(--line); cursor: pointer; text-align: left; transition: all 0.16s; min-width: 0; }
.ao-step:disabled { cursor: not-allowed; opacity: 0.55; }
.ao-step:hover:not(:disabled) { border-color: var(--line2); }
.ao-step--done { background: linear-gradient(168deg, rgba(46,224,123,0.08), transparent); border-color: var(--green-bd); }
.ao-step--active { background: linear-gradient(168deg, rgba(46,224,123,0.14), rgba(46,224,123,0.04)); border-color: var(--green-bd); box-shadow: 0 6px 18px -10px var(--green-glow); }
.ao-step-num { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font-family: var(--num); font-size: 11.5px; font-weight: 700; background: var(--card-base); border: 1.5px solid var(--line2); color: var(--mut); flex-shrink: 0; }
.ao-step--done .ao-step-num { background: radial-gradient(circle at 32% 28%, #46ff97, #0e6e33 75%); border-color: rgba(46,224,123,0.5); color: #04140a; }
.ao-step--active .ao-step-num { border-color: var(--green); color: var(--green); }
.ao-step-n { font-family: var(--num); font-size: 12.5px; font-weight: 700; color: var(--text); }
.ao-step-d { font-size: 10px; color: var(--mut); }

.ao-card { max-width: 100%; padding: 26px 28px; }
.ao-h2 { font-family: var(--num); font-size: 24px; font-weight: 700; margin: 6px 0 10px; }
.ao-sub { font-size: 13px; color: var(--mut); line-height: 1.6; max-width: 640px; margin-bottom: 22px; }
.ao-sub code { background: var(--card-alt); padding: 1px 6px; border-radius: 5px; font-size: 11.5px; color: var(--green); }

.ao-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 600px) { .ao-grid2 { grid-template-columns: 1fr; } }
.ao-field { display: block; }
.ao-field .f-label { margin-top: 0; }

.ao-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.ao-actions { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--line); }
.ao-count { flex: 1; text-align: center; }

.ao-error { margin-top: 14px; padding: 10px 12px; border-radius: 9px; background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.3); color: var(--red); font-size: 12.5px; }
.ao-note { margin-top: 18px; padding: 12px 14px; border-radius: 10px; background: rgba(251,191,36,0.08); border: 1px solid rgba(251,191,36,0.25); color: var(--amber); font-size: 12.5px; line-height: 1.55; }
.ao-skip { margin-top: 16px; font-size: 12px; color: var(--mut); }
.ao-skip code { background: var(--card-alt); padding: 1px 6px; border-radius: 4px; font-size: 11px; color: var(--lbl); }
.ao-skip-inline { font-size: 11.5px; color: var(--mut); }

.ao-banner { padding: 12px 14px; border-radius: 10px; font-size: 12.5px; margin-bottom: 14px; }
.ao-banner--ok { background: rgba(46,224,123,0.08); border: 1px solid var(--green-bd); color: var(--green); }

/* Logo step */
.ao-logo-row { display: flex; gap: 18px; align-items: center; margin: 6px 0 8px; flex-wrap: wrap; }
.ao-logo-preview { width: 120px; height: 120px; border-radius: 12px; background: var(--card-alt); border: 1.5px dashed var(--line2); display: grid; place-items: center; overflow: hidden; flex-shrink: 0; }
.ao-logo-preview img { width: 100%; height: 100%; object-fit: cover; }
.ao-logo-placeholder { font-size: 11px; color: var(--mut); text-align: center; padding: 0 12px; }
.ao-logo-actions { display: flex; flex-direction: column; gap: 6px; }
.ao-logo-hint { font-size: 11px; color: var(--mut); }

/* Coach permissions */
.ao-perms { margin-top: 14px; padding: 14px; background: var(--card-alt); border: 1px solid var(--line); border-radius: 11px; display: flex; flex-direction: column; gap: 10px; }
.ao-toggle-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.ao-toggle-n { font-size: 12.5px; font-weight: 600; }
.ao-toggle-d { font-size: 11px; color: var(--mut); margin-top: 2px; }
.ao-toggle { width: 38px; height: 21px; border-radius: 99px; background: var(--card-base); border: 1px solid var(--line2); position: relative; cursor: pointer; transition: all 0.15s; flex-shrink: 0; }
.ao-toggle.on { background: var(--green-bg); border-color: var(--green-bd); }
.ao-toggle-knob { position: absolute; top: 2px; left: 2px; width: 15px; height: 15px; border-radius: 50%; background: var(--mut); transition: all 0.15s; }
.ao-toggle.on .ao-toggle-knob { left: 19px; background: var(--green); box-shadow: 0 0 6px var(--green-glow); }

/* Tabs */
.ao-tabs { display: inline-flex; gap: 4px; padding: 4px; background: var(--card-alt); border: 1px solid var(--line); border-radius: 10px; margin-bottom: 16px; }
.ao-tab { padding: 7px 14px; border-radius: 7px; border: none; background: transparent; color: var(--mut); font-family: var(--num); font-size: 11.5px; font-weight: 600; cursor: pointer; transition: all 0.14s; }
.ao-tab:hover { color: var(--text); }
.ao-tab.on { background: var(--head); color: var(--text); }

/* CSV */
.ao-csv { }
.ao-csv-actions { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.ao-csv-actions label.btn { display: inline-flex; align-items: center; cursor: pointer; }
.ao-validation { display: flex; gap: 8px; margin: 14px 0 10px; flex-wrap: wrap; }
.ao-table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 10px; }
.ao-table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
.ao-table th { background: var(--head); color: var(--lbl); font-family: var(--num); font-size: 9.5px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; padding: 8px 10px; text-align: left; white-space: nowrap; }
.ao-table td { padding: 7px 10px; border-top: 1px solid var(--line); white-space: nowrap; }
.ao-row-errors { margin-top: 10px; display: flex; flex-direction: column; gap: 4px; }
.ao-row-error { font-size: 11.5px; color: var(--red); }

/* Manual tab uses .ao-grid2 directly */

/* Review */
.ao-summary { background: var(--card-alt); border: 1px solid var(--line); border-radius: 11px; padding: 4px 16px; margin-top: 6px; }
.ao-summary-row { display: flex; align-items: center; gap: 12px; padding: 12px 0; }
.ao-summary-row + .ao-summary-row { border-top: 1px solid var(--line); }
.ao-summary-k { width: 100px; font-size: 11px; color: var(--mut); text-transform: uppercase; letter-spacing: 1.2px; font-family: var(--num); font-weight: 600; }
.ao-summary-v { flex: 1; font-size: 13px; }
`;
