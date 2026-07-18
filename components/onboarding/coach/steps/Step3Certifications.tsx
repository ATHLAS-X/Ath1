"use client";
import { useState } from "react";
import { Field } from "../../academy/WizPrimitives";
import type { CoachFormData } from "../CoachOnboardingWizard";

const CERTS = [
  { value: "BCCI_L1", badge: "L1", label: "BCCI Level 1", sub: "Foundation" },
  { value: "BCCI_L2", badge: "L2", label: "BCCI Level 2", sub: "Intermediate" },
  { value: "BCCI_L3", badge: "L3", label: "BCCI Level 3", sub: "Advanced" },
  { value: "NCA",     badge: "NCA", label: "NCA",          sub: "National" },
  { value: "NIS",     badge: "NIS", label: "NIS",          sub: "Sports Institute" },
  { value: "NONE",    badge: "—",   label: "No Cert",      sub: "Informal experience" },
];

export default function Step3Certifications({
  data, patch, errors, clearError,
}: {
  data: CoachFormData;
  patch: (p: Partial<CoachFormData>) => void;
  errors: Record<string, string>;
  clearError: (k: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const hasCert = data.highestCertification && data.highestCertification !== "NONE";

  async function uploadCert(file: File) {
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await res.json();
      if (d.url) patch({ certificateUrl: d.url });
    } catch {}
    setUploading(false);
  }

  return (
    <>
      <p className="step-kicker">Step 3 of 4</p>
      <h2 className="step-title">Certifications</h2>
      <p className="step-desc">Select your highest BCCI / NCA certification. Upload your certificate to fast-track verification.</p>

      <div className={`field${errors.highestCertification ? " invalid" : ""}`}>
        <label>
          Highest Certification<span className="req">*</span>
        </label>
        <div className="cert-cards">
          {CERTS.map((c) => (
            <button
              key={c.value}
              type="button"
              className="cert-card"
              aria-pressed={data.highestCertification === c.value}
              onClick={() => { patch({ highestCertification: c.value }); clearError("highestCertification"); }}
            >
              <span className="badge">{c.badge}</span>
              <div className="ct">{c.label}</div>
              <div className="cs">{c.sub}</div>
            </button>
          ))}
        </div>
        {errors.highestCertification && (
          <p className="err" style={{ display: "block" }}>{errors.highestCertification}</p>
        )}
      </div>

      {hasCert && (
        <>
          <div className="section-h">
            <h3>Certificate Upload</h3>
            <span>optional but builds credibility</span>
          </div>

          <Field label="Upload Certificate" optional>
            <label
              className="upload-zone"
              style={{ cursor: "pointer" }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) uploadCert(f); }}
            >
              <input
                type="file"
                accept="image/*,application/pdf"
                style={{ display: "none" }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCert(f); }}
              />
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 30, height: 30 }}>
                <path d="M20 16.6A5 5 0 0 0 18 7h-1.3A7 7 0 1 0 5 15.3" />
                <path d="M12 12v9m0-9-3.5 3.5M12 12l3.5 3.5" />
              </svg>
              {data.certificateUrl ? (
                <b style={{ color: "var(--ok)" }}>Certificate uploaded ✓</b>
              ) : (
                <b>{uploading ? "Uploading…" : "Drop certificate here or click to browse"}</b>
              )}
              <small>PNG, JPG or PDF — max 5 MB</small>
            </label>
          </Field>
        </>
      )}

      <div className="callout" style={{ marginTop: hasCert ? "0.8rem" : "1.4rem" }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18, flexShrink: 0, marginTop: "0.1rem" }}>
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p>
          Uploaded certs are reviewed within <b>24–48 hours</b>. You can still join and coach while verification is pending.
        </p>
      </div>
    </>
  );
}
