"use client";
import { useState } from "react";
import { OtpBoxes, Field } from "../../academy/WizPrimitives";
import type { CoachFormData } from "../CoachOnboardingWizard";

export default function Step1Account({
  data, patch, errors, clearError,
}: {
  data: CoachFormData;
  patch: (p: Partial<CoachFormData>) => void;
  errors: Record<string, string>;
  clearError: (k: string) => void;
}) {
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  async function sendOtp() {
    if (data.phone.length !== 10) return;
    setSending(true);
    try {
      await fetch("/api/auth/otp/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: data.phone }),
      });
      patch({ otpSent: true });
      clearError("phone");
    } catch {}
    setSending(false);
  }

  async function verifyOtp() {
    const code = data.otp.join("");
    if (code.length !== 6) return;
    setVerifying(true);
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: data.phone, otp: code }),
      });
      if (!res.ok) { return; }
      patch({ otpVerified: true });
      clearError("otp");
    } catch {}
    setVerifying(false);
  }

  return (
    <>
      <p className="step-kicker">Step 1 of 4</p>
      <h2 className="step-title">Account</h2>
      <p className="step-desc">Verify your mobile number, then tell us your name.</p>

      <Field label="Mobile Number" required error={errors.phone}>
        <div className="phone-row">
          <span className="phone-chip">+91</span>
          <input
            type="tel"
            placeholder="10-digit number"
            maxLength={10}
            value={data.phone}
            disabled={data.otpSent}
            onChange={(e) => { patch({ phone: e.target.value.replace(/\D/g, "").slice(0, 10) }); clearError("phone"); }}
          />
          {!data.otpVerified && (
            <button
              type="button"
              className="inline-amber"
              disabled={data.phone.length !== 10 || sending || data.otpSent}
              onClick={sendOtp}
            >
              {sending ? "…" : data.otpSent ? "Sent ✓" : "Send OTP"}
            </button>
          )}
        </div>
      </Field>

      {data.otpVerified ? (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--ok)", fontWeight: 600, fontSize: "0.9rem", marginBottom: "1.2rem" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
            <polyline points="20 6 9 17 4 11" />
          </svg>
          Phone verified
        </div>
      ) : data.otpSent && (
        <Field label="Enter OTP" required error={errors.otp}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <OtpBoxes
              value={data.otp}
              onChange={(v) => { patch({ otp: v as string[] }); clearError("otp"); }}
            />
            <button
              type="button"
              className="inline-amber"
              style={{ padding: "0.75rem 1.1rem" }}
              onClick={verifyOtp}
              disabled={data.otp.join("").length !== 6 || verifying}
            >
              {verifying ? "…" : "Verify"}
            </button>
          </div>
        </Field>
      )}

      <div className="grid2">
        <Field label="First Name" required error={errors.firstName}>
          <input
            placeholder="e.g. Rahul"
            value={data.firstName}
            onChange={(e) => { patch({ firstName: e.target.value }); clearError("firstName"); }}
          />
        </Field>
        <Field label="Last Name" required error={errors.lastName}>
          <input
            placeholder="e.g. Dravid"
            value={data.lastName}
            onChange={(e) => { patch({ lastName: e.target.value }); clearError("lastName"); }}
          />
        </Field>
        <Field label="Email" optional className="ffull">
          <input
            type="email"
            placeholder="you@example.com"
            value={data.email}
            onChange={(e) => patch({ email: e.target.value })}
          />
        </Field>
      </div>
    </>
  );
}
