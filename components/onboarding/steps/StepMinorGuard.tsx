"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileUp, UserCheck, Loader2 } from "lucide-react";
import StepShell from "@/components/onboarding/StepShell";

interface Props {
  currentStep: number;
  completedSteps: number[];
  readOnly: boolean;
}

const DISCLAIMER = `I am the legal guardian of the player named in this AthlasX profile. \
I confirm that the player is under 18 years of age and that I provide informed consent on their behalf \
for the collection, processing, and storage of the data captured during the AthlasX onboarding flow — \
including identity verification metadata, performance and fitness data, video submissions, and behavioural \
assessment responses. I acknowledge that AthlasX does not share raw identity numbers with scouts or third \
parties, and that I may withdraw this consent in writing at any time. I have read and accept the AthlasX \
Privacy Policy and Terms of Use, and I attach a valid government-issued ID (Aadhaar, PAN, or Voter ID) \
to evidence my identity as the legal guardian.`;

export default function StepMinorGuard({ currentStep, completedSteps, readOnly }: Props) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [isMinor, setIsMinor] = useState<boolean | null>(null);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ pts: number; url: string } | null>(null);

  // 1) Determine minor status from aadhaar verification (Step 2).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/onboarding/minor-check");
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        const minor = !!data?.data?.isMinor;
        setIsMinor(minor);
        if (!minor) {
          // Auto-advance to step 4 without rendering UI.
          await fetch("/api/onboarding/advance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ step: 3 }),
          });
          router.replace("/onboarding/role");
        }
      } catch {
        setIsMinor(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  const validPhone = phone.replace(/\D/g, "").length >= 10;
  const validOtp = /^\d{6}$/.test(otp);
  const canSubmit = validPhone && validOtp && !!file && accepted;

  function sendOtp() {
    setError(null);
    if (!validPhone) return setError("Enter a valid phone number");
    // MVP: no backend OTP call; just reveal the OTP field.
    console.log(`[guardian] simulated OTP "654321" sent to ${phone}`);
    setOtpSent(true);
  }

  async function submit() {
    setError(null);
    if (!canSubmit) return setError("Complete all required fields");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("parent_phone", phone.replace(/\D/g, ""));
      fd.append("otp", otp);
      fd.append("disclaimer_signed", "true");
      fd.append("guardian_id_doc", file as File);
      const res = await fetch("/api/onboarding/guardian/confirm", { method: "POST", body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setError(data?.error ?? "Could not confirm guardianship");
        return;
      }
      setSuccess({ pts: data.data.verification_pts ?? 1, url: data.data.guardian_id_doc_url });
    } catch (e: any) {
      setError(e?.message ?? "Network error");
    } finally {
      setBusy(false);
    }
  }

  function goNext() {
    router.push("/onboarding/role");
    return true;
  }

  if (checking || isMinor === null) {
    return (
      <div className="py-20 text-center" style={{ color: "#94A3B8" }}>
        <Loader2 className="inline-block animate-spin" size={20} /> Checking guardian requirements…
      </div>
    );
  }
  if (!isMinor) {
    return (
      <div className="py-20 text-center" style={{ color: "#94A3B8" }}>
        You&rsquo;re 18+. Skipping guardian consent…
      </div>
    );
  }

  const frontend = (
    <div className="space-y-5">
      <div
        className="p-4 rounded-lg flex gap-3"
        style={{ background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.3)" }}
      >
        <UserCheck size={18} style={{ color: "#60A5FA", marginTop: 2 }} />
        <div className="space-y-1">
          <p className="font-semibold" style={{ color: "#E2E8F0" }}>Guardian consent required</p>
          <p className="text-sm" style={{ color: "#94A3B8" }}>
            You&rsquo;re under 18, so a parent or legal guardian must verify their identity and sign the consent
            disclaimer before you can continue.
          </p>
        </div>
      </div>

      {/* Phone */}
      <div className="space-y-2">
        <label className="text-sm font-medium" style={{ color: "#E2E8F0" }}>Parent / guardian phone</label>
        <div className="flex gap-2">
          <input
            type="tel"
            inputMode="numeric"
            placeholder="10-digit mobile number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={readOnly || !!success}
            className="flex-1 px-3 py-2 rounded-md"
            style={{ background: "#050D18", border: "1px solid #1E3A5F", color: "#E2E8F0", outline: "none" }}
          />
          <button
            type="button"
            onClick={sendOtp}
            disabled={!validPhone || otpSent || readOnly || !!success}
            className="px-3 py-2 rounded-md text-sm font-semibold"
            style={{
              background: validPhone && !otpSent ? "#60A5FA" : "#1E3A5F",
              color: validPhone && !otpSent ? "#0B1A2E" : "#94A3B8",
              cursor: validPhone && !otpSent ? "pointer" : "not-allowed",
              border: "none",
            }}
          >
            {otpSent ? "OTP sent" : "Send OTP"}
          </button>
        </div>
      </div>

      {otpSent && (
        <div className="space-y-2">
          <label className="text-sm font-medium" style={{ color: "#E2E8F0" }}>OTP</label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="6-digit OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            disabled={readOnly || !!success}
            className="w-full px-3 py-2 rounded-md font-mono tracking-widest text-center text-lg"
            style={{ background: "#050D18", border: "1px solid #1E3A5F", color: "#E2E8F0", outline: "none" }}
          />
        </div>
      )}

      {/* File */}
      <div className="space-y-2">
        <label className="text-sm font-medium" style={{ color: "#E2E8F0" }}>Guardian government ID (Aadhaar / PAN / Voter ID)</label>
        <label
          className="flex items-center gap-3 px-3 py-3 rounded-md cursor-pointer"
          style={{ background: "#050D18", border: "1px dashed #1E3A5F", color: "#94A3B8" }}
        >
          <FileUp size={18} style={{ color: "#60A5FA" }} />
          <span className="text-sm">{file ? file.name : "Choose a file (PDF or image)"}</span>
          <input
            type="file"
            accept="image/*,application/pdf"
            disabled={readOnly || !!success}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
        </label>
      </div>

      {/* Disclaimer */}
      <div className="space-y-2">
        <label className="text-sm font-medium" style={{ color: "#E2E8F0" }}>Consent disclaimer</label>
        <div
          className="p-3 rounded-md text-xs leading-relaxed max-h-40 overflow-auto"
          style={{ background: "#050D18", border: "1px solid #1E3A5F", color: "#94A3B8" }}
        >
          {DISCLAIMER}
        </div>
        <label className="flex items-center gap-2 text-sm" style={{ color: "#E2E8F0" }}>
          <input
            type="checkbox"
            checked={accepted}
            disabled={readOnly || !!success}
            onChange={(e) => setAccepted(e.target.checked)}
          />
          I confirm I am the legal guardian.
        </label>
      </div>

      {!success ? (
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit || busy || readOnly}
          className="px-4 py-2 rounded-md text-sm font-semibold"
          style={{
            background: canSubmit && !busy ? "#22C55E" : "#1E3A5F",
            color: canSubmit && !busy ? "#062012" : "#94A3B8",
            cursor: canSubmit && !busy ? "pointer" : "not-allowed",
            border: "none",
            boxShadow: canSubmit && !busy ? "0 6px 20px rgba(34,197,94,0.3)" : "none",
          }}
        >
          {busy ? "Saving…" : "Confirm Guardianship"}
        </button>
      ) : (
        <div
          className="p-4 rounded-lg flex items-start gap-3"
          style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.4)" }}
        >
          <CheckCircle2 size={22} style={{ color: "#22C55E", marginTop: 1 }} />
          <div className="flex-1 space-y-1">
            <p className="font-semibold" style={{ color: "#E2E8F0" }}>Guardianship confirmed</p>
            <p className="text-sm" style={{ color: "#94A3B8" }}>
              ID document stored at <code style={{ color: "#86EFAC" }}>{success.url}</code>
            </p>
          </div>
          <span
            className="px-2 py-1 rounded text-xs font-bold"
            style={{ background: "#22C55E", color: "#062012" }}
          >
            +{success.pts} pts
          </span>
        </div>
      )}

      {error && <p className="text-sm" style={{ color: "#EF4444" }}>{error}</p>}
    </div>
  );

  const backend = (
    <div className="space-y-3 text-sm" style={{ color: "#94A3B8" }}>
      <h3 className="text-base font-semibold" style={{ color: "#E2E8F0" }}>Guardian consent ledger</h3>
      <ul className="list-disc pl-5 space-y-1">
        <li>Phone OTP-verified (MVP: simulated).</li>
        <li>Government ID stored under <code>/public/uploads/&lt;userId&gt;/guardian/</code>.</li>
        <li>Disclaimer captured with <code>signed_at</code> timestamp and <code>signed_ip</code>.</li>
        <li>+1 verification point awarded; <code>minor_flag</code> remains true.</li>
      </ul>
      <p className="text-xs" style={{ color: "#64748B" }}>
        Source of truth: <code>guardian_consent</code> table.
      </p>
    </div>
  );

  return (
    <StepShell
      step={3}
      currentStep={currentStep}
      completedSteps={completedSteps}
      readOnly={readOnly}
      frontend={frontend}
      backend={backend}
      nextDisabled={!success && !readOnly}
      onNext={goNext}
    />
  );
}
