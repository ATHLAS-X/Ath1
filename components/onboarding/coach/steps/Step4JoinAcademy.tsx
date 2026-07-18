"use client";
import { useState } from "react";
import { Field } from "../../academy/WizPrimitives";
import type { CoachFormData } from "../CoachOnboardingWizard";

const STATES = [
  "Andhra Pradesh","Assam","Bihar","Delhi","Goa","Gujarat","Haryana","Himachal Pradesh",
  "Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya",
  "Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana",
  "Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Jammu & Kashmir","Ladakh",
  "Chandigarh","Puducherry","Andaman and Nicobar Islands",
];

type AcademyResult = { id: string; academy_name: string; city: string; batch_count: number; player_count: number };

export default function Step4JoinAcademy({
  data, patch,
}: {
  data: CoachFormData;
  patch: (p: Partial<CoachFormData>) => void;
  errors: Record<string, string>;
  clearError: (k: string) => void;
}) {
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<AcademyResult[]>([]);
  const [applied, setApplied] = useState<Set<string>>(new Set());

  async function verifyCode() {
    const code = data.inviteCode.trim().toUpperCase();
    if (!code) return;
    setVerifying(true);
    setVerifyError("");
    try {
      const res = await fetch("/api/onboarding/coach/verify-invite", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const d = await res.json();
      if (!res.ok) { setVerifyError(d.error ?? "Invalid code"); return; }
      patch({
        inviteVerified: true, inviteCode: code,
        inviteAcademyId: d.academyId, inviteAcademyName: d.academyName, inviteAcademyCity: d.city,
      });
    } catch { setVerifyError("Verification failed. Please try again."); }
    setVerifying(false);
  }

  async function searchAcademies() {
    setSearching(true);
    try {
      const params = new URLSearchParams();
      if (data.academySearchCity) params.set("city", data.academySearchCity);
      if (data.academySearchState) params.set("state", data.academySearchState);
      const res = await fetch("/api/academies?" + params.toString());
      const d = await res.json();
      setResults(d.academies ?? []);
    } catch {}
    setSearching(false);
  }

  async function applyToAcademy(academyId: string) {
    try {
      await fetch("/api/onboarding/coach/apply-academy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ academyId }),
      });
      setApplied((prev) => new Set([...prev, academyId]));
    } catch {}
  }

  return (
    <>
      <p className="step-kicker">Step 4 of 4</p>
      <h2 className="step-title">Join an academy</h2>
      <p className="step-desc">Use an invite code from an academy, or browse and apply. You can also skip this and join later.</p>

      {/* Method selector */}
      <div className="cardset" style={{ marginBottom: "1.4rem" }}>
        <button
          type="button"
          className="optcard"
          aria-pressed={data.joinMethod === "invite"}
          onClick={() => patch({ joinMethod: "invite" })}
        >
          <span className="ico">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </span>
          <span className="t">
            <b>Enter Invite Code</b>
            <small>Academy sent you a code</small>
          </span>
        </button>
        <button
          type="button"
          className="optcard"
          aria-pressed={data.joinMethod === "browse"}
          onClick={() => patch({ joinMethod: "browse" })}
        >
          <span className="ico">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </span>
          <span className="t">
            <b>Browse Academies</b>
            <small>Find nearby and apply</small>
          </span>
        </button>
      </div>

      {/* ── Invite code flow ── */}
      {data.joinMethod === "invite" && (
        <>
          {data.inviteVerified ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.9rem 1rem", borderRadius: "9px", background: "var(--ov08)", border: "1px solid var(--ok)" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18, color: "var(--ok)", flexShrink: 0 }}>
                <polyline points="20 6 9 17 4 11" />
              </svg>
              <div>
                <span style={{ color: "var(--ok)", fontWeight: 700, fontSize: "0.9rem" }}>Verified — </span>
                <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{data.inviteAcademyName}</span>
                {data.inviteAcademyCity && <span style={{ color: "var(--text-dim)", fontSize: "0.84rem" }}>, {data.inviteAcademyCity}</span>}
              </div>
            </div>
          ) : (
            <Field label="Invite Code" error={verifyError || undefined}>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  placeholder="e.g. AXKCA-7F2D"
                  value={data.inviteCode}
                  onChange={(e) => patch({ inviteCode: e.target.value.toUpperCase() })}
                  style={{ letterSpacing: "0.1em", textTransform: "uppercase" }}
                />
                <button
                  type="button"
                  className="inline-amber"
                  style={{ padding: "0.78rem 1.1rem" }}
                  onClick={verifyCode}
                  disabled={!data.inviteCode.trim() || verifying}
                >
                  {verifying ? "…" : "Verify"}
                </button>
              </div>
              {verifyError && <p className="err" style={{ display: "block" }}>{verifyError}</p>}
            </Field>
          )}
        </>
      )}

      {/* ── Browse flow ── */}
      {data.joinMethod === "browse" && (
        <>
          <div className="grid2">
            <Field label="City">
              <input
                placeholder="e.g. Mumbai"
                value={data.academySearchCity}
                onChange={(e) => patch({ academySearchCity: e.target.value })}
              />
            </Field>
            <Field label="State">
              <select
                value={data.academySearchState}
                onChange={(e) => patch({ academySearchState: e.target.value })}
              >
                <option value="">All states</option>
                {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ marginBottom: "1rem" }}
            onClick={searchAcademies}
            disabled={searching}
          >
            {searching ? "Searching…" : "Search Academies"}
          </button>

          {results.length > 0 && (
            <div className="academy-list">
              {results.map((a) => (
                <div key={a.id} className="academy-row">
                  <div>
                    <div className="aname">{a.academy_name}</div>
                    <div className="ameta">{a.city} · {a.batch_count} batch{a.batch_count !== 1 ? "es" : ""} · {a.player_count} player{a.player_count !== 1 ? "s" : ""}</div>
                  </div>
                  {applied.has(a.id) ? (
                    <span className="applied">Applied ✓</span>
                  ) : (
                    <button type="button" className="btn btn-ghost" style={{ padding: "0.5rem 1rem", fontSize: "0.82rem" }} onClick={() => applyToAcademy(a.id)}>
                      Apply
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {results.length === 0 && !searching && (
            <p style={{ fontSize: "0.84rem", color: "var(--text-faint)", marginTop: "0.5rem" }}>
              Search by city or state to find academies near you.
            </p>
          )}
        </>
      )}

      <div className="callout" style={{ marginTop: "1.6rem" }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18, flexShrink: 0, marginTop: "0.1rem" }}>
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p>
          You can <b>skip this step</b> and join academies later from your coach dashboard.
        </p>
      </div>
    </>
  );
}
