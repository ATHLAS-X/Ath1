"use client";
import { useState } from "react";
import { OtpBoxes, Field } from "../WizPrimitives";
import type { AcademyFormData } from "../AcademyOnboardingWizard";

export default function Step1Account({
  data, patch, errors, clearError,
}: {
  data: AcademyFormData;
  patch: (p: Partial<AcademyFormData>) => void;
  errors: Record<string, string>;
  clearError: (k: string) => void;
}) {
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  async function sendOtp() {
    if (data.phone.length !== 10) { return; }
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: data.phone }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        patch({ otpSent: false });
        setDevOtp(null);
        setSendError(d.error ?? "Couldn't send OTP — try again");
        return;
      }
      patch({ otpSent: true });
      clearError("phone");
      if (d.dev_otp) setDevOtp(d.dev_otp);
    } catch {
      patch({ otpSent: false });
      setSendError("Network error — try again");
    }
    setSending(false);
  }

  async function verifyOtp() {
    const code = data.otp.join("");
    if (code.length !== 6) return;
    setVerifying(true);
    setVerifyError(null);
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: data.phone, code }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setVerifyError(d.error ?? "Incorrect code — try again");
        return;
      }
      patch({ otpVerified: true });
      clearError("otp");
    } catch {
      setVerifyError("Network error — try again");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <>
      <p className="step-kicker">Step 1 of 5</p>
      <h2 className="step-title">Account</h2>
      <p className="step-desc">We&apos;ll link your academy to this mobile number. One OTP, and you&apos;re in.</p>

      <Field label="Mobile Number" required error={errors.phone || sendError || undefined}>
        <div className="phone-row">
          <span className="phone-chip">+91</span>
          <input
            type="tel"
            placeholder="10-digit number"
            maxLength={10}
            value={data.phone}
            disabled={data.otpSent}
            onChange={(e) => { patch({ phone: e.target.value.replace(/\D/g, "").slice(0, 10) }); clearError("phone"); setSendError(null); }}
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
        {data.otpSent && !data.otpVerified && (
          <button
            type="button"
            onClick={() => { patch({ otpSent: false, otp: ["","","","","",""] }); setDevOtp(null); setSendError(null); setVerifyError(null); clearError("phone"); clearError("otp"); }}
            style={{ background: "none", border: "none", color: "var(--acc)", fontSize: "0.78rem", cursor: "pointer", padding: "4px 0", textDecoration: "underline" }}
          >
            Change number
          </button>
        )}
      </Field>

      {data.otpVerified ? (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--ok)", fontWeight: 600, fontSize: "0.9rem" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
            <polyline points="20 6 9 17 4 11" />
          </svg>
          Phone verified
        </div>
      ) : data.otpSent && (
        <Field label="Enter OTP" required error={errors.otp || verifyError || undefined}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <OtpBoxes
              value={data.otp}
              onChange={(v) => { patch({ otp: v as string[] }); clearError("otp"); setVerifyError(null); }}
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
          {devOtp && (
            <p style={{ marginTop: "0.5rem", fontSize: "0.78rem", color: "var(--acc)", opacity: 0.85 }}>
              Dev OTP: <strong style={{ letterSpacing: "0.15em", fontFamily: "monospace" }}>{devOtp}</strong>
            </p>
          )}
        </Field>
      )}
    </>
  );
}
