"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ShieldAlert, ShieldCheck, Lock, Info } from "lucide-react";
import StepShell from "@/components/onboarding/StepShell";

interface Props {
  currentStep: number;
  completedSteps: number[];
  readOnly: boolean;
}

function maskAadhaar(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 12);
  const groups: string[] = [];
  for (let i = 0; i < digits.length; i += 4) groups.push(digits.slice(i, i + 4));
  return groups.join("-");
}

export default function StepAadhaar({ currentStep, completedSteps, readOnly }: Props) {
  const router = useRouter();
  const [aadhaar, setAadhaar] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    masked: string;
    dob: string;
    age: number;
    isMinor: boolean;
    discrepancy: boolean;
    pts: number;
  } | null>(null);

  const digits = useMemo(() => aadhaar.replace(/\D/g, ""), [aadhaar]);
  const displayMasked = maskAadhaar(aadhaar);
  const validAadhaar = digits.length === 12;
  const validOtp = /^\d{6}$/.test(otp);

  async function initiate() {
    setError(null);
    if (!validAadhaar) return setError("Enter a 12-digit Aadhaar number");
    setBusy(true);
    try {
      const res = await fetch("/api/onboarding/aadhaar/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aadhaar: digits }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setError(data?.error ?? "Could not send OTP");
        return;
      }
      setOtpSent(true);
    } catch (e: any) {
      setError(e?.message ?? "Network error");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setError(null);
    if (!validOtp) return setError("Enter the 6-digit OTP");
    setBusy(true);
    try {
      const res = await fetch("/api/onboarding/aadhaar/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aadhaar: digits, otp }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setError(data?.error ?? "Verification failed");
        return;
      }
      setResult({
        masked: data.data.masked_aadhaar,
        dob: data.data.verified_dob,
        age: data.data.age,
        isMinor: !!data.data.is_minor,
        discrepancy: !!data.data.discrepancy_flag,
        pts: data.data.verification_pts ?? 3,
      });
    } catch (e: any) {
      setError(e?.message ?? "Network error");
    } finally {
      setBusy(false);
    }
  }

  function goNext() {
    router.push("/onboarding/minor-guard");
    return true;
  }

  const frontend = (
    <div className="space-y-5">
      <div
        className="p-4 rounded-lg flex gap-3"
        style={{ background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.3)" }}
      >
        <Lock size={18} style={{ color: "#60A5FA", marginTop: 2 }} />
        <div className="space-y-1">
          <p className="font-semibold" style={{ color: "#E2E8F0" }}>
            We will NOT store your Aadhaar number — only your date of birth is extracted.
          </p>
          <p className="text-sm" style={{ color: "#94A3B8" }}>
            Age verification for fair play — not shared with scouts.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" style={{ color: "#E2E8F0" }}>Aadhaar number</label>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="XXXX-XXXX-XXXX"
          value={displayMasked}
          disabled={readOnly || !!result}
          onChange={(e) => setAadhaar(e.target.value)}
          maxLength={14}
          className="w-full px-3 py-2 rounded-md font-mono tracking-wider"
          style={{
            background: "#050D18",
            border: "1px solid #1E3A5F",
            color: "#E2E8F0",
            outline: "none",
          }}
        />
        <p className="text-xs flex items-center gap-1" style={{ color: "#64748B" }}>
          <Info size={12} /> Auto-masked while you type. Digits entered: {digits.length}/12
        </p>
      </div>

      {!otpSent && !result && (
        <button
          type="button"
          onClick={initiate}
          disabled={!validAadhaar || busy || readOnly}
          className="px-4 py-2 rounded-md text-sm font-semibold"
          style={{
            background: validAadhaar && !busy ? "#60A5FA" : "#1E3A5F",
            color: validAadhaar && !busy ? "#0B1A2E" : "#94A3B8",
            border: "none",
            cursor: validAadhaar && !busy ? "pointer" : "not-allowed",
          }}
        >
          {busy ? "Sending OTP…" : "Send OTP"}
        </button>
      )}

      {otpSent && !result && (
        <div className="space-y-2">
          <label className="text-sm font-medium" style={{ color: "#E2E8F0" }}>OTP</label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="6-digit OTP"
            value={otp}
            disabled={readOnly}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="w-full px-3 py-2 rounded-md font-mono tracking-widest text-center text-lg"
            style={{
              background: "#050D18",
              border: "1px solid #1E3A5F",
              color: "#E2E8F0",
              outline: "none",
            }}
          />
          <p className="text-xs" style={{ color: "#64748B" }}>OTP sent to Aadhaar-linked mobile (MVP: any 6 digits work).</p>
          <button
            type="button"
            onClick={confirm}
            disabled={!validOtp || busy || readOnly}
            className="px-4 py-2 rounded-md text-sm font-semibold mt-2"
            style={{
              background: validOtp && !busy ? "#22C55E" : "#1E3A5F",
              color: validOtp && !busy ? "#062012" : "#94A3B8",
              border: "none",
              cursor: validOtp && !busy ? "pointer" : "not-allowed",
            }}
          >
            {busy ? "Verifying…" : "Verify"}
          </button>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div
            className="p-4 rounded-lg flex items-start gap-3"
            style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.4)" }}
          >
            <CheckCircle2 size={22} style={{ color: "#22C55E", marginTop: 1 }} />
            <div className="flex-1 space-y-1">
              <p className="font-semibold" style={{ color: "#E2E8F0" }}>Aadhaar verified</p>
              <p className="text-sm" style={{ color: "#94A3B8" }}>
                Stored as <code style={{ color: "#86EFAC" }}>{result.masked}</code>
              </p>
              <p className="text-sm" style={{ color: "#94A3B8" }}>
                Verified DOB: <strong style={{ color: "#E2E8F0" }}>{result.dob}</strong> · Age {result.age}{result.isMinor && " (minor)"}
              </p>
            </div>
            <span
              className="px-2 py-1 rounded text-xs font-bold"
              style={{ background: "#22C55E", color: "#062012" }}
            >
              +{result.pts} pts
            </span>
          </div>

          {result.discrepancy && (
            <div
              className="p-4 rounded-lg flex items-start gap-3"
              style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.4)" }}
            >
              <ShieldAlert size={20} style={{ color: "#F59E0B", marginTop: 1 }} />
              <div className="flex-1 space-y-1">
                <p className="font-semibold" style={{ color: "#E2E8F0" }}>DOB discrepancy detected</p>
                <p className="text-sm" style={{ color: "#94A3B8" }}>
                  Your declared date of birth differs from the verified Aadhaar DOB by more than 6 months.
                </p>
                <button
                  type="button"
                  className="text-sm underline mt-1"
                  style={{ color: "#F59E0B" }}
                  onClick={() => alert("Appeal flow to be implemented.")}
                >
                  File an appeal
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm" style={{ color: "#EF4444" }}>{error}</p>
      )}
    </div>
  );

  const backend = (
    <div className="space-y-3 text-sm" style={{ color: "#94A3B8" }}>
      <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: "#E2E8F0" }}>
        <ShieldCheck size={16} style={{ color: "#22C55E" }} /> Identity verification pipeline
      </h3>
      <ul className="list-disc pl-5 space-y-1">
        <li>OTP issued to Aadhaar-linked mobile (Surepass in prod, simulated here).</li>
        <li>On confirm: <code>masked_aadhaar</code>, <code>verified_dob</code>, <code>age_verified</code> persisted.</li>
        <li>+3 verification points awarded.</li>
        <li>If verified DOB differs from declared DOB by &gt; 6 months → <code>discrepancy_flag</code> raised for review.</li>
      </ul>
      <p className="text-xs" style={{ color: "#64748B" }}>
        Source of truth: <code>aadhaar_verification</code> table. Raw Aadhaar is never persisted.
      </p>
    </div>
  );

  return (
    <StepShell
      step={2}
      currentStep={currentStep}
      completedSteps={completedSteps}
      readOnly={readOnly}
      frontend={frontend}
      backend={backend}
      nextDisabled={!result && !readOnly}
      onNext={goNext}
    />
  );
}
