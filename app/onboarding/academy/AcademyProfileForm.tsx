"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import "@/app/athlasx.css";

const AGE_GROUPS = ["U-10", "U-12", "U-14", "U-16", "U-19", "U-23", "Senior"];
const FACILITIES = ["Indoor nets", "Outdoor nets", "Turf wicket", "Floodlights", "Gym", "Pool", "Hostel", "Video analysis", "Bowling machine"];
const SPECIALTIES = ["Pace bowling", "Spin bowling", "Batting", "Wicket-keeping", "All-rounder development", "Junior cricket", "Women's cricket"];

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat",
  "Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra",
  "Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim",
  "Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
];

type Form = Record<string, any>;

export default function AcademyProfileForm({ userName }: { userName: string }) {
  const router = useRouter();
  const [form, setForm] = useState<Form>({
    age_groups: [], facilities: [], specialties: [], social_links: {},
  });
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");

  useEffect(() => {
    fetch("/api/academy/profile").then((r) => r.json()).then((data) => {
      if (data) {
        setForm({
          ...data,
          age_groups: data.age_groups ?? [],
          facilities: data.facilities ?? [],
          specialties: data.specialties ?? [],
          social_links: data.social_links ?? {},
        });
      }
    }).catch(() => {});
  }, []);

  function set(k: string, v: unknown) {
    setForm((f) => ({ ...f, [k]: v }));
    setSaveStatus("idle");
  }
  function toggleMulti(k: string, value: string) {
    setForm((f) => {
      const cur: string[] = f[k] ?? [];
      const next = cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value];
      return { ...f, [k]: next };
    });
    setSaveStatus("idle");
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/academy/profile/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Save failed");
      } else {
        setSaveStatus("saved");
      }
    } finally {
      setSaving(false);
    }
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const saveRes = await fetch("/api/academy/profile/save", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok || !saveData.success) {
        setError(saveData.error ?? "Save failed");
        return;
      }
      const subRes = await fetch("/api/academy/profile/submit", { method: "POST" });
      const subData = await subRes.json();
      if (!subRes.ok || !subData.success) {
        if (subData.missing) setError(`Missing: ${subData.missing.join(", ")}`);
        else setError(subData.error ?? "Submission failed");
        return;
      }
      router.push("/dashboard/academy");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="sx-root" style={{ minHeight: "100vh", padding: 24 }}>
      <style>{styles}</style>
      <div className="ap-shell">
        <header className="ap-head">
          <div>
            <div className="sect-title">Academy Profile — Setup</div>
            <h1 className="ap-title">{userName}</h1>
          </div>
          <div style={{ fontSize: 12, color: saveStatus === "saved" ? "var(--green)" : "var(--mut)" }}>
            {saveStatus === "saved" ? "✓ Saved" : ""}
          </div>
        </header>

        <Section title="Identity">
          <div className="ap-grid ap-grid--2">
            <Field label="Academy name *">
              <input className="ap-input" value={form.academy_name ?? ""} onChange={(e) => set("academy_name", e.target.value)} />
            </Field>
            <Field label="Logo URL">
              <input className="ap-input" placeholder="https://…" value={form.logo_url ?? ""} onChange={(e) => set("logo_url", e.target.value)} />
            </Field>
            <Field label="Founded year *">
              <input type="number" min={1900} max={new Date().getFullYear()} className="ap-input"
                value={form.founded_year ?? ""} onChange={(e) => set("founded_year", e.target.value ? Number(e.target.value) : null)} />
            </Field>
            <Field label="Description">
              <textarea className="ap-input ap-textarea" value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
            </Field>
          </div>
        </Section>

        <Section title="Location">
          <div className="ap-grid ap-grid--3">
            <Field label="City *">
              <input className="ap-input" value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />
            </Field>
            <Field label="State *">
              <select className="ap-input" value={form.state ?? ""} onChange={(e) => set("state", e.target.value)}>
                <option value="">Select</option>
                {INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Country">
              <input className="ap-input" value={form.country ?? "India"} onChange={(e) => set("country", e.target.value)} />
            </Field>
          </div>
        </Section>

        <Section title="Contact">
          <div className="ap-grid ap-grid--2">
            <Field label="Contact email *">
              <input type="email" className="ap-input" value={form.contact_email ?? ""} onChange={(e) => set("contact_email", e.target.value)} />
            </Field>
            <Field label="Contact phone">
              <input className="ap-input" value={form.contact_phone ?? ""} onChange={(e) => set("contact_phone", e.target.value)} />
            </Field>
            <Field label="Website">
              <input className="ap-input" placeholder="https://…" value={form.website ?? ""} onChange={(e) => set("website", e.target.value)} />
            </Field>
          </div>
        </Section>

        <Section title="Social Links">
          <div className="ap-grid ap-grid--2">
            {(["instagram", "twitter", "youtube", "linkedin"] as const).map((k) => (
              <Field key={k} label={k.charAt(0).toUpperCase() + k.slice(1)}>
                <input className="ap-input" placeholder={`https://${k}.com/…`}
                  value={(form.social_links?.[k]) ?? ""}
                  onChange={(e) => set("social_links", { ...(form.social_links ?? {}), [k]: e.target.value })} />
              </Field>
            ))}
          </div>
        </Section>

        <Section title="Programs" subtitle="Select all that apply">
          <Field label="Age groups">
            <ChipRow items={AGE_GROUPS} selected={form.age_groups ?? []} onToggle={(v) => toggleMulti("age_groups", v)} />
          </Field>
          <Field label="Facilities">
            <ChipRow items={FACILITIES} selected={form.facilities ?? []} onToggle={(v) => toggleMulti("facilities", v)} />
          </Field>
          <Field label="Specialties">
            <ChipRow items={SPECIALTIES} selected={form.specialties ?? []} onToggle={(v) => toggleMulti("specialties", v)} />
          </Field>
        </Section>

        {error && <div className="ap-error">{error}</div>}

        <div className="ap-nav">
          <button className="btn" onClick={save} disabled={saving || submitting}>
            {saving ? "Saving…" : "Save draft"}
          </button>
          <button className="btn green" onClick={submit} disabled={saving || submitting}>
            {submitting ? "Submitting…" : "Submit for Approval"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }: any) {
  return (
    <div className="card ap-section">
      <div className="ap-section-head">
        <span className="sect-title">{title}</span>
        {subtitle && <span style={{ color: "var(--mut)", fontSize: 11.5, marginLeft: 10 }}>{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: any) {
  return (
    <div className="ap-field">
      <label className="ap-label">{label}</label>
      {children}
    </div>
  );
}

function ChipRow({ items, selected, onToggle }: { items: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="ap-chips">
      {items.map((v) => {
        const on = selected.includes(v);
        return (
          <button key={v} type="button" onClick={() => onToggle(v)}
            className={`ap-chip${on ? " ap-chip--on" : ""}`}>
            {v}
          </button>
        );
      })}
    </div>
  );
}

const styles = `
.ap-shell { max-width: 940px; margin: 0 auto; }
.ap-head { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 16px; }
.ap-title { font-family: var(--num); font-size: 28px; font-weight: 700; margin-top: 4px; }
.ap-section { padding: 20px 22px; margin-bottom: 14px; }
.ap-section-head { display: flex; align-items: center; margin-bottom: 14px; }
.ap-grid { display: grid; gap: 14px; }
.ap-grid--2 { grid-template-columns: 1fr 1fr; }
.ap-grid--3 { grid-template-columns: 1fr 1fr 1fr; }
@media (max-width: 720px) { .ap-grid--2, .ap-grid--3 { grid-template-columns: 1fr; } }
.ap-field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
.ap-label { font-size: 10.5px; letter-spacing: 1.4px; text-transform: uppercase; color: var(--lbl); font-family: var(--num); font-weight: 600; }
.ap-input { height: 34px; padding: 0 11px; background: var(--card-alt); border: 1px solid var(--line2); border-radius: 8px; color: var(--text); font-family: inherit; font-size: 13px; outline: none; transition: border-color 0.15s, box-shadow 0.15s; }
.ap-input:focus { border-color: var(--green); box-shadow: 0 0 8px var(--green-glow); }
.ap-textarea { height: 80px; padding: 8px 11px; resize: vertical; }
.ap-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.ap-chip { height: 28px; padding: 0 14px; border-radius: 99px; display: inline-flex; align-items: center; background: var(--card-alt); border: 1px solid var(--line2); color: var(--lbl); font-family: var(--num); font-size: 11.5px; font-weight: 600; cursor: pointer; transition: all 0.13s; }
.ap-chip:hover { color: var(--text); border-color: #333; }
.ap-chip--on { background: var(--green-bg); border-color: var(--green-bd); color: var(--green); }
.ap-error { margin: 12px 0; padding: 10px 14px; background: var(--red-bg); border: 1px solid var(--red-bd); border-radius: 9px; color: var(--red); font-size: 12.5px; }
.ap-nav { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
`;
