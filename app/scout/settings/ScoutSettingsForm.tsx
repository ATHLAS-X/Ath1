"use client";

import { useState } from "react";
import { DsButton, DsInput, DsSelect } from "@/app/_ds";

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
    <div style={{ padding: "1.3rem 1.4rem", borderRadius: "var(--ax-radius-xl)", background: "var(--ax-card)", border: "1px solid var(--ax-border)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.9rem" }}>
        <Field label="Designation">
          <DsInput value={form.designation} onChange={(e) => set("designation", e.target.value)} placeholder="Talent Scout" />
        </Field>
        <Field label="Organization">
          <DsInput value={form.organization_name} onChange={(e) => set("organization_name", e.target.value)} placeholder="e.g. Mumbai Cricket Association" />
        </Field>
        <Field label="Organization Type">
          <DsSelect value={form.org_type} onChange={(e) => set("org_type", e.target.value)}>
            <option value="">Select…</option>
            {ORG_TYPES.map((t) => <option key={t}>{t}</option>)}
          </DsSelect>
        </Field>
        <Field label="Region">
          <DsInput value={form.region} onChange={(e) => set("region", e.target.value)} placeholder="State / city / pan-India" />
        </Field>
        <Field label="Years of Experience">
          <DsInput type="number" value={form.years_experience ?? ""} onChange={(e) => set("years_experience", e.target.value ? Number(e.target.value) : null)} />
        </Field>
        <div style={{ gridColumn: "1 / -1" }}>
          <Field label="Affiliation Proof URL">
            <DsInput value={form.proof_url} onChange={(e) => set("proof_url", e.target.value)} placeholder="https://…" />
          </Field>
        </div>
      </div>

      {error && <p style={{ color: "var(--ax-bad-text)", fontSize: "0.78rem", marginTop: "0.8rem" }}>{error}</p>}

      <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", marginTop: "1.1rem" }}>
        <DsButton variant="fill" disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save changes"}
        </DsButton>
        {saved && <span style={{ fontSize: "0.78rem", color: "var(--ax-ok)" }}>✓ Saved</span>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.64rem", fontWeight: 700, color: "var(--ax-text-dim)", marginBottom: "0.4rem" }}>{label}</span>
      {children}
    </label>
  );
}
