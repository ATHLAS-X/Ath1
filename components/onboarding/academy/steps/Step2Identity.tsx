"use client";
import { useState } from "react";
import { OptCards, Field, svgIcon } from "../WizPrimitives";
import type { AcademyFormData } from "../AcademyOnboardingWizard";

const STATES = [
  "Andhra Pradesh","Assam","Bihar","Delhi","Goa","Gujarat","Haryana","Himachal Pradesh",
  "Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya",
  "Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana",
  "Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Jammu & Kashmir","Ladakh",
  "Chandigarh","Puducherry","Andaman and Nicobar Islands",
];
const YEARS = Array.from({ length: 67 }, (_, i) => String(2026 - i));

const ACADEMY_TYPES = [
  { value: "Private",     label: "Private",     sub: "Owner or company-run",   icon: svgIcon('<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>') },
  { value: "Government",  label: "Government",  sub: "Sports authority / SAI", icon: svgIcon('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 10v10h14V10"/>') },
  { value: "Trust / NGO", label: "Trust / NGO", sub: "Non-profit entity",      icon: svgIcon('<path d="M12 3l7 3v6c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z"/>') },
  { value: "Sports Club", label: "Sports Club", sub: "Club-affiliated",        icon: svgIcon('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>') },
];

export default function Step2Identity({
  data, patch, errors, clearError,
}: {
  data: AcademyFormData;
  patch: (p: Partial<AcademyFormData>) => void;
  errors: Record<string, string>;
  clearError: (k: string) => void;
}) {
  const [logoUploading, setLogoUploading] = useState(false);

  async function uploadLogo(file: File) {
    setLogoUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/academy/logo", { method: "POST", body: fd });
      const d = await res.json();
      if (d.url) patch({ logoUrl: d.url });
    } catch {}
    setLogoUploading(false);
  }

  return (
    <>
      <p className="step-kicker">Step 2 of 5</p>
      <h2 className="step-title">Academy identity</h2>
      <p className="step-desc">Tell us about your academy. This appears on your public profile — scouts and players will see this.</p>

      <div className="grid2">
        <Field label="Academy Name" required error={errors.academyName} full>
          <input
            placeholder="e.g. KCA Cricket Academy"
            value={data.academyName}
            onChange={(e) => { patch({ academyName: e.target.value }); clearError("academyName"); }}
          />
        </Field>
        <Field label="City" required error={errors.city}>
          <input
            placeholder="e.g. Kanpur"
            value={data.city}
            onChange={(e) => { patch({ city: e.target.value }); clearError("city"); }}
          />
        </Field>
        <Field label="District" error={errors.district}>
          <input
            placeholder="e.g. Kanpur Nagar"
            value={data.district}
            onChange={(e) => patch({ district: e.target.value })}
          />
        </Field>
        <Field label="State" required error={errors.state}>
          <select
            value={data.state}
            onChange={(e) => { patch({ state: e.target.value }); clearError("state"); }}
          >
            <option value="">Select state</option>
            {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Year Established" error={errors.yearEstablished}>
          <select
            value={data.yearEstablished}
            onChange={(e) => patch({ yearEstablished: e.target.value })}
          >
            <option value="">Select year</option>
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </Field>
      </div>

      <div className="field">
        <label>Academy Type</label>
        <OptCards
          options={ACADEMY_TYPES}
          value={data.academyType}
          onChange={(v) => patch({ academyType: v })}
        />
      </div>

      <div className="grid2">
        <Field label="Primary Contact Name" required error={errors.primaryContactName}>
          <input
            placeholder="Full name"
            value={data.primaryContactName}
            onChange={(e) => { patch({ primaryContactName: e.target.value }); clearError("primaryContactName"); }}
          />
        </Field>
        <Field label="Designation" error={errors.primaryContactDesignation}>
          <input
            placeholder="e.g. Director, Admin Manager"
            value={data.primaryContactDesignation}
            onChange={(e) => patch({ primaryContactDesignation: e.target.value })}
          />
        </Field>
      </div>

      <div className="field">
        <label>Academy Logo <span className="opt">(optional)</span></label>
        <label
          className="upload-zone"
          style={{ cursor: "pointer" }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) uploadLogo(f); }}
        >
          <input type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }} />
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 30, height: 30 }}>
            <path d="M20 16.6A5 5 0 0 0 18 7h-1.3A7 7 0 1 0 5 15.3" />
            <path d="M12 12v9m0-9-3.5 3.5M12 12l3.5 3.5" />
          </svg>
          {data.logoUrl
            ? <b>Logo uploaded ✓</b>
            : <b>{logoUploading ? "Uploading…" : "Upload logo or letterhead"}</b>
          }
          <small>PNG, JPG or PDF — max 5 MB</small>
        </label>
      </div>
    </>
  );
}
