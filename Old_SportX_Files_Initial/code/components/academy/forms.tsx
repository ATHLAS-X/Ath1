"use client";

/* Reusable academy admin forms — shared between the onboarding wizard
   (/academy/onboarding) and the dashboard quick-action modals
   (/academy/dashboard). Each form is fully self-contained, calls its own
   API, and fires onSuccess() so the caller can refresh counts. */

import { useRef, useState } from "react";

export const ACADEMY_SPECIALIZATIONS = ["Batting", "Bowling", "Fitness", "Wicketkeeping", "Mental Conditioning"];
export const ACADEMY_ROLES = ["Batsman", "Bowler", "All-Rounder", "WK"];
export const ACADEMY_GENDERS = ["Male", "Female", "Other"];
export const ACADEMY_BAT_STYLES = ["Right-hand bat", "Left-hand bat"];
export const ACADEMY_BOWL_STYLES = ["Right-arm fast", "Left-arm fast", "Right-arm medium", "Left-arm medium", "Off Spin", "Leg Spin", "Left-arm Spin"];
export const ACADEMY_CSV_HEADERS = [
  "first_name", "last_name", "date_of_birth", "gender",
  "primary_role", "batting_style", "bowling_style",
  "city", "state", "height_cm", "weight_kg",
];

/* ════════ ADD COACH FORM ════════ */
interface AddCoachFormProps {
  onSuccess?: (coachName: string) => void;
  variant?: "light" | "dark";
}

export function AddCoachForm({ onSuccess, variant = "dark" }: AddCoachFormProps) {
  const [form, setForm] = useState({
    coach_name: "", specialization: "", years_experience: "" as string | number,
    certifications: "", can_submit_fitness: false, can_submit_evaluations: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const c = useFormColors(variant);

  const submit = async () => {
    setError(null); setSuccess(null);
    if (!form.coach_name.trim()) { setError("Coach name is required"); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/academy/coaches", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          years_experience: form.years_experience === "" ? null : Number(form.years_experience),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data?.success) { setError(data?.error ?? "Could not add coach"); return; }
      setSuccess(`${data.coach.coach_name} added`);
      onSuccess?.(data.coach.coach_name);
      setForm({ coach_name: "", specialization: "", years_experience: "", certifications: "", can_submit_fitness: false, can_submit_evaluations: false });
    } finally { setBusy(false); }
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <FormGrid>
        <FieldText label="Coach name *" value={form.coach_name} onChange={(v) => setForm({ ...form, coach_name: v })} placeholder="e.g. Rohit Mehta" c={c} />
        <FieldSelect label="Specialization" value={form.specialization} onChange={(v) => setForm({ ...form, specialization: v })} options={ACADEMY_SPECIALIZATIONS} c={c} />
        <FieldText label="Years of experience" type="number" value={String(form.years_experience)} onChange={(v) => setForm({ ...form, years_experience: v })} placeholder="0" c={c} />
        <FieldText label="Certifications" value={form.certifications} onChange={(v) => setForm({ ...form, certifications: v })} placeholder="e.g. BCCI L2, NCA Level 1" c={c} />
      </FormGrid>

      <div style={{
        background: c.subtle, border: `1px solid ${c.border}`, borderRadius: 10,
        padding: 12, display: "flex", flexDirection: "column", gap: 10,
      }}>
        <ToggleRow c={c}
          label="Can submit fitness assessments"
          desc="YoYo, sprint, 2 km — counts toward player fitness score"
          on={form.can_submit_fitness}
          onChange={(v) => setForm({ ...form, can_submit_fitness: v })} />
        <ToggleRow c={c}
          label="Can submit player evaluations"
          desc="Skill + behavioural ratings — counts toward Performance Verified"
          on={form.can_submit_evaluations}
          onChange={(v) => setForm({ ...form, can_submit_evaluations: v })} />
      </div>

      {error && <Banner kind="error" c={c}>{error}</Banner>}
      {success && <Banner kind="ok" c={c}>✓ {success}</Banner>}

      <div>
        <button onClick={submit} disabled={busy} style={btnGreen()}>
          {busy ? "Adding…" : "Add coach"}
        </button>
      </div>
    </div>
  );
}

/* ════════ ADD SINGLE PLAYER FORM ════════ */
interface AddPlayerFormProps {
  onSuccess?: () => void;
  variant?: "light" | "dark";
}

export function AddPlayerForm({ onSuccess, variant = "dark" }: AddPlayerFormProps) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(0);

  const c = useFormColors(variant);

  const submit = async () => {
    setError(null);
    if (!form.first_name?.trim() || !form.last_name?.trim()) {
      setError("First and last name are required."); return;
    }
    const headers = ACADEMY_CSV_HEADERS;
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
        setError(data?.results?.[0]?.error ?? data?.error ?? "Could not add player");
        return;
      }
      setAdded((n) => n + 1);
      onSuccess?.();
      setForm({});
    } finally { setBusy(false); }
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <FormGrid>
        <FieldText label="First name *" value={form.first_name ?? ""} onChange={(v) => setForm({ ...form, first_name: v })} c={c} />
        <FieldText label="Last name *"  value={form.last_name ?? ""}  onChange={(v) => setForm({ ...form, last_name: v })} c={c} />
        <FieldText label="Date of birth" type="date" value={form.date_of_birth ?? ""} onChange={(v) => setForm({ ...form, date_of_birth: v })} c={c} />
        <FieldSelect label="Gender" value={form.gender ?? ""} onChange={(v) => setForm({ ...form, gender: v })} options={ACADEMY_GENDERS} c={c} />
        <FieldSelect label="Primary role" value={form.primary_role ?? ""} onChange={(v) => setForm({ ...form, primary_role: v })} options={ACADEMY_ROLES} c={c} />
        <FieldSelect label="Batting style" value={form.batting_style ?? ""} onChange={(v) => setForm({ ...form, batting_style: v })} options={ACADEMY_BAT_STYLES} c={c} />
        <FieldSelect label="Bowling style" value={form.bowling_style ?? ""} onChange={(v) => setForm({ ...form, bowling_style: v })} options={ACADEMY_BOWL_STYLES} c={c} />
        <FieldText label="City" value={form.city ?? ""} onChange={(v) => setForm({ ...form, city: v })} c={c} />
        <FieldText label="State" value={form.state ?? ""} onChange={(v) => setForm({ ...form, state: v })} c={c} />
        <FieldText label="Height (cm)" type="number" value={form.height_cm ?? ""} onChange={(v) => setForm({ ...form, height_cm: v })} c={c} />
        <FieldText label="Weight (kg)" type="number" value={form.weight_kg ?? ""} onChange={(v) => setForm({ ...form, weight_kg: v })} c={c} />
      </FormGrid>

      {error && <Banner kind="error" c={c}>{error}</Banner>}

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={submit} disabled={busy} style={btnGreen()}>
          {busy ? "Adding…" : "Add player"}
        </button>
        {added > 0 && <span style={{ fontSize: 12, color: c.muted }}>{added} added this session</span>}
      </div>
    </div>
  );
}

/* ════════ BULK CSV FORM ════════ */
interface BulkCsvFormProps {
  onSuccess?: (created: number) => void;
  variant?: "light" | "dark";
}

interface ParsedRow { data: Record<string, string>; errors: string[]; }

function parseCsvText(text: string): { headers: string[]; rows: string[][] } {
  const out: string[][] = [];
  let row: string[] = [], cur = "", inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuote = false;
      else cur += ch;
    } else {
      if (ch === '"') inQuote = true;
      else if (ch === ",") { row.push(cur); cur = ""; }
      else if (ch === "\n") { row.push(cur); out.push(row); row = []; cur = ""; }
      else if (ch === "\r") {}
      else cur += ch;
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
  if (r.gender && !ACADEMY_GENDERS.includes(r.gender.trim())) errors.push("gender");
  if (r.primary_role && !ACADEMY_ROLES.includes(r.primary_role.trim())) errors.push("primary_role");
  if (r.height_cm && isNaN(Number(r.height_cm))) errors.push("height_cm");
  if (r.weight_kg && isNaN(Number(r.weight_kg))) errors.push("weight_kg");
  return errors;
}

export function BulkCsvForm({ onSuccess, variant = "dark" }: BulkCsvFormProps) {
  const [csvText, setCsvText] = useState("");
  const [filename, setFilename] = useState("");
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ created: number; skipped: number; errors: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const c = useFormColors(variant);

  const downloadTemplate = () => {
    const blob = new Blob([ACADEMY_CSV_HEADERS.join(",") + "\n"], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "athlasx-players-template.csv";
    a.click(); URL.revokeObjectURL(url);
  };

  const onFile = async (file: File) => {
    setError(null); setSummary(null);
    if (!/\.csv$/i.test(file.name)) { setError("Please upload a .csv file"); return; }
    const text = await file.text();
    setCsvText(text); setFilename(file.name);
    const { headers, rows } = parseCsvText(text);
    if (headers.length === 0) { setError("CSV is empty"); return; }
    const rowsTyped: ParsedRow[] = rows.map((r) => {
      const data: Record<string, string> = {};
      headers.forEach((h, i) => { data[h] = (r[i] ?? "").trim(); });
      if (!data.playing_role && data.primary_role) data.playing_role = data.primary_role;
      return { data, errors: validateRow(data) };
    });
    setParsed(rowsTyped);
  };

  const importAll = async () => {
    if (parsed.some((r) => r.errors.length > 0)) {
      setError("Fix row errors before importing."); return;
    }
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/academy/players/bulk", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data?.success) { setError(data?.error ?? "Bulk import failed"); return; }
      setSummary(data.summary);
      onSuccess?.(data.summary?.created ?? 0);
      setParsed([]); setCsvText(""); setFilename("");
    } finally { setBusy(false); }
  };

  const preview = parsed.slice(0, 5);
  const valid = parsed.filter((r) => r.errors.length === 0).length;
  const errs = parsed.length - valid;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={downloadTemplate} style={btn(c)}>↓ Download template</button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
        <button onClick={() => fileRef.current?.click()} style={btnGreen()}>
          {filename ? `Selected: ${filename}` : "Choose CSV file"}
        </button>
      </div>

      {parsed.length > 0 && (
        <>
          <div style={{ display: "flex", gap: 8 }}>
            <Badge color="#16a34a">{valid} valid</Badge>
            {errs > 0 && <Badge color="#dc2626">{errs} errors</Badge>}
            <Badge color={c.muted}>Total {parsed.length}</Badge>
          </div>

          <div style={{ overflowX: "auto", border: `1px solid ${c.border}`, borderRadius: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, color: c.text }}>
              <thead>
                <tr style={{ background: c.subtle }}>
                  <th style={th(c)}>#</th>
                  {ACADEMY_CSV_HEADERS.map((h) => <th key={h} style={th(c)}>{h}</th>)}
                  <th style={th(c)}>Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${c.border}` }}>
                    <td style={td(c)}>{i + 2}</td>
                    {ACADEMY_CSV_HEADERS.map((h) => <td key={h} style={td(c)}>{row.data[h] ?? ""}</td>)}
                    <td style={td(c)}>
                      {row.errors.length === 0
                        ? <Badge color="#16a34a">OK</Badge>
                        : <Badge color="#dc2626" title={row.errors.join(", ")}>Errors</Badge>}
                    </td>
                  </tr>
                ))}
                {parsed.length > 5 && (
                  <tr><td colSpan={ACADEMY_CSV_HEADERS.length + 2}
                    style={{ ...td(c), textAlign: "center", color: c.muted }}>
                    + {parsed.length - 5} more row{parsed.length - 5 === 1 ? "" : "s"} not shown
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          {errs > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {parsed.filter((r) => r.errors.length > 0).slice(0, 5).map((r, i) => (
                <div key={i} style={{ fontSize: 11.5, color: "#dc2626" }}>
                  Row {parsed.indexOf(r) + 2}: missing/invalid <strong>{r.errors.join(", ")}</strong>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {error && <Banner kind="error" c={c}>{error}</Banner>}
      {summary && (
        <Banner kind="ok" c={c}>
          ✓ {summary.created} player{summary.created === 1 ? "" : "s"} imported successfully
          {summary.skipped ? ` · ${summary.skipped} skipped (already on AthlasX)` : ""}
          {summary.errors ? ` · ${summary.errors} failed` : ""}
        </Banner>
      )}

      {parsed.length > 0 && (
        <div>
          <button onClick={importAll} disabled={busy || errs > 0} style={btnGreen()}>
            {busy ? "Importing…" : `Import ${valid} player${valid === 1 ? "" : "s"}`}
          </button>
        </div>
      )}
    </div>
  );
}

/* ════════ SHARED HELPERS (style-agnostic) ════════ */

function useFormColors(variant: "light" | "dark") {
  if (variant === "light") {
    return {
      text:   "#0F172A",
      muted:  "#64748B",
      label:  "#475569",
      bg:     "#FFFFFF",
      subtle: "#F8FAFC",
      border: "#E2E8F0",
      input:  "#FFFFFF",
      inputBorder: "#CBD5E1",
      focus:  "#22C55E",
      green:  "#22C55E",
      red:    "#DC2626",
      amber:  "#D97706",
    };
  }
  return {
    text:   "#F1F5F9",
    muted:  "#94A3B8",
    label:  "#94A3B8",
    bg:     "#0D120F",
    subtle: "#0A0E0B",
    border: "#1B2620",
    input:  "#0A0E0B",
    inputBorder: "#243027",
    focus:  "#2EE07B",
    green:  "#2EE07B",
    red:    "#F87171",
    amber:  "#FBBF24",
  };
}

type Colors = ReturnType<typeof useFormColors>;

function FormGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      {children}
    </div>
  );
}

function FieldText({ label, value, onChange, placeholder, type = "text", c }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; c: Colors;
}) {
  return (
    <label style={{ display: "block" }}>
      <span style={labelStyle(c)}>{label}</span>
      <input style={inputStyle(c)} type={type} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function FieldSelect({ label, value, onChange, options, c }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; c: Colors;
}) {
  return (
    <label style={{ display: "block" }}>
      <span style={labelStyle(c)}>{label}</span>
      <select style={inputStyle(c)} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select…</option>
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </label>
  );
}

function ToggleRow({ label, desc, on, onChange, c }: {
  label: string; desc: string; on: boolean; onChange: (v: boolean) => void; c: Colors;
}) {
  return (
    <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, cursor: "pointer" }}>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: c.text }}>{label}</div>
        <div style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>{desc}</div>
      </div>
      <span onClick={() => onChange(!on)} style={{
        width: 38, height: 21, borderRadius: 99,
        background: on ? `${c.green}33` : c.subtle,
        border: `1px solid ${on ? c.green : c.inputBorder}`,
        position: "relative", cursor: "pointer", flexShrink: 0, transition: "all 0.15s",
      }}>
        <span style={{
          position: "absolute", top: 2, left: on ? 19 : 2, width: 15, height: 15, borderRadius: "50%",
          background: on ? c.green : c.muted,
          boxShadow: on ? `0 0 6px ${c.green}88` : "none", transition: "all 0.15s",
        }} />
      </span>
    </label>
  );
}

function Banner({ kind, c, children }: { kind: "ok" | "error"; c: Colors; children: React.ReactNode }) {
  const isErr = kind === "error";
  return (
    <div style={{
      padding: "10px 12px", borderRadius: 9, fontSize: 12.5,
      background: isErr ? `${c.red}1A` : `${c.green}1A`,
      border: `1px solid ${isErr ? c.red : c.green}66`,
      color: isErr ? c.red : c.green,
    }}>
      {children}
    </div>
  );
}

function Badge({ children, color, title }: { children: React.ReactNode; color: string; title?: string }) {
  return (
    <span title={title} style={{
      display: "inline-flex", alignItems: "center", height: 20, padding: "0 8px",
      borderRadius: 99, fontFamily: "var(--num, 'Space Grotesk', monospace)",
      fontSize: 10, fontWeight: 600, color,
      background: `${color}1A`, border: `1px solid ${color}55`,
    }}>{children}</span>
  );
}

function labelStyle(c: Colors): React.CSSProperties {
  return { display: "block", fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase", color: c.label, marginBottom: 6, fontWeight: 600 };
}

function inputStyle(c: Colors): React.CSSProperties {
  return {
    width: "100%", height: 34, padding: "0 11px",
    background: c.input, border: `1px solid ${c.inputBorder}`, borderRadius: 8,
    color: c.text, fontSize: 12.5, outline: "none",
  };
}

function th(c: Colors): React.CSSProperties {
  return { textAlign: "left", padding: "8px 10px", fontSize: 9.5, fontWeight: 600, letterSpacing: 1,
    textTransform: "uppercase", color: c.muted, whiteSpace: "nowrap" };
}

function td(c: Colors): React.CSSProperties {
  return { padding: "7px 10px", whiteSpace: "nowrap" };
}

function btn(c: Colors): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    height: 34, padding: "0 14px", borderRadius: 8,
    background: c.subtle, border: `1px solid ${c.inputBorder}`, color: c.text,
    fontSize: 12, fontWeight: 600, cursor: "pointer",
  };
}

function btnGreen(): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    height: 34, padding: "0 16px", borderRadius: 8,
    background: "#22C55E", border: "1px solid #16a34a", color: "#FFFFFF",
    fontSize: 12, fontWeight: 600, cursor: "pointer",
  };
}
