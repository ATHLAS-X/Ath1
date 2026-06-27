"use client";

import { useState } from "react";

interface FormState {
  designation: string;
  organization_name: string;
  org_type: string;
  region: string;
  years_experience: number | null;
  proof_url: string;
}

const ORG_TYPES = ["Independent", "Franchise", "State", "Country", "Academy"];

export default function ScoutSettingsForm({ initial }: { initial: FormState }) {
  const [form, setForm] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/scout/profile/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error ?? "Save failed");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="cw-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Designation">
          <input className="sinput" value={form.designation} onChange={(e) => set("designation", e.target.value)} placeholder="Talent Scout" />
        </Field>
        <Field label="Organization">
          <input className="sinput" value={form.organization_name} onChange={(e) => set("organization_name", e.target.value)} placeholder="e.g. Mumbai Cricket Association" />
        </Field>
        <Field label="Organization Type">
          <select className="sinput" value={form.org_type} onChange={(e) => set("org_type", e.target.value)}>
            <option value="">Select…</option>
            {ORG_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Region">
          <input className="sinput" value={form.region} onChange={(e) => set("region", e.target.value)} placeholder="State / city / pan-India" />
        </Field>
        <Field label="Years of Experience">
          <input className="sinput" type="number" value={form.years_experience ?? ""} onChange={(e) => set("years_experience", e.target.value ? Number(e.target.value) : null)} />
        </Field>
        <div style={{ gridColumn: "1 / -1" }}>
          <Field label="Affiliation Proof URL">
            <input className="sinput" value={form.proof_url} onChange={(e) => set("proof_url", e.target.value)} placeholder="https://…" />
          </Field>
        </div>
      </div>

      {error && <p style={{ color: "#ff6b6b", fontSize: 12.5, marginTop: 12 }}>{error}</p>}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16 }}>
        <button className="btn green" disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save changes"}
        </button>
        {saved && <span style={{ fontSize: 12, color: "var(--green)" }}>✓ Saved</span>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span className="f-label">{label}</span>
      {children}
    </label>
  );
}
