"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { VerifyChrome, VerifyLadder, VCCard, VCField, Stepper } from "@/components/verify/VerifyChrome";
import { DsButton, DsInput, DsPill } from "@/app/_ds";

interface Props {
  profile: { name: string; dob: string | null; gender: string | null } | null;
  verified: boolean;
  maskedAadhaar: string | null;
}

const STEPS = ["Aadhaar Number", "OTP", "Verified"];

export default function AadhaarVerifyClient({ profile, verified, maskedAadhaar }: Props) {
  const [step, setStep] = useState<0 | 1 | 2>(verified ? 2 : 0);
  const [aadhaar, setAadhaar] = useState("");
  const [consent, setConsent] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  const digits = aadhaar.replace(/\D/g, "").slice(0, 12);
  const formatted = digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  const masked = maskedAadhaar ?? `XXXX XXXX ${digits.slice(8) || "____"}`;
  const otpFull = otp.every((d) => d !== "");

  function setOtpAt(i: number, val: string) {
    const d = val.replace(/\D/g, "").slice(-1);
    const next = otp.slice(); next[i] = d; setOtp(next);
    if (d && i < 5) boxes.current[i + 1]?.focus();
  }
  function onOtpKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !otp[i] && i > 0) boxes.current[i - 1]?.focus();
  }

  async function sendOtp() {
    setError(null); setBusy(true);
    try {
      const res = await fetch("/api/onboarding/aadhaar/initiate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aadhaar: digits }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data?.success) { setError(data?.error ?? "Couldn't send OTP"); return; }
      setStep(1);
    } finally { setBusy(false); }
  }

  async function verify() {
    setError(null); setBusy(true);
    try {
      const res = await fetch("/api/onboarding/aadhaar/confirm", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aadhaar: digits, otp: otp.join("") }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data?.success) { setError(data?.error ?? "Verification failed"); return; }
      setStep(2);
    } finally { setBusy(false); }
  }

  const level = step === 2 ? 2 : 1;

  return (
    <VerifyChrome title="Verification Centre · Identity" level={level}>
      <div className="vc-grid">

        <div className="vc-col">
          <VerifyLadder
            level={level}
            actions={step === 2 ? {
              3: (
                <Link href="/verify/scorecards" style={{ textDecoration: "none", flexShrink: 0 }}>
                  <DsButton variant="fill" size="sm">Submit Scorecards</DsButton>
                </Link>
              ),
            } : undefined}
          />
        </div>

        <div className="vc-col">
          <VCCard
            title="Identity Verification — Aadhaar"
            action={<DsPill tone={step === 2 ? "ok" : "accent"}>{step === 2 ? "Verified ✓" : "Level 2 requirement"}</DsPill>}
          >
            <Stepper steps={STEPS} current={step} />

            {step === 0 && (
              <div>
                <p style={{ fontSize: "0.8rem", color: "var(--ax-text-dim)", lineHeight: 1.55, marginBottom: 10 }}>
                  Enter the 12-digit Aadhaar number of the player. A one-time
                  password will be sent to the mobile linked with Aadhaar.
                </p>
                <VCField label="Aadhaar Number" hint={`${digits.length} / 12`}>
                  <DsInput
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="0000 0000 0000"
                    value={formatted}
                    onChange={(e) => setAadhaar(e.target.value)}
                  />
                </VCField>
                <label style={{ display: "flex", gap: 9, alignItems: "flex-start", margin: "10px 0 16px", fontSize: "0.76rem", color: "var(--ax-text-dim)", lineHeight: 1.5, cursor: "pointer" }}>
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ accentColor: "var(--ax-accent)", marginTop: 2 }} />
                  <span>
                    I consent to AthlasX verifying my identity with UIDAI. For
                    players under 18, this action must be completed by a parent
                    or guardian.
                  </span>
                </label>
                {error && <p style={{ color: "var(--ax-bad-text)", fontSize: "0.76rem", marginBottom: 8 }}>{error}</p>}
                <DsButton
                  variant="fill"
                  disabled={busy || digits.length !== 12 || !consent}
                  onClick={sendOtp}
                >
                  {busy ? "Sending…" : "Send OTP"}
                </DsButton>
              </div>
            )}

            {step === 1 && (
              <div>
                <p style={{ fontSize: "0.8rem", color: "var(--ax-text-dim)", lineHeight: 1.55, marginBottom: 14 }}>
                  OTP sent to the mobile number linked with Aadhaar{" "}
                  <span style={{ fontFamily: "var(--ax-font-display)", color: "var(--ax-text)", fontWeight: 400 }}>{masked}</span>. Valid for 10 minutes.
                </p>
                <div style={{
                  fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.1em",
                  fontSize: "0.62rem", fontWeight: 700, color: "var(--ax-text-dim)", marginBottom: "0.4rem",
                }}>Enter 6-digit OTP</div>
                <div className="otp-row">
                  {otp.map((d, i) => (
                    <input
                      key={i}
                      className="otp-box"
                      value={d}
                      inputMode="numeric"
                      ref={(el) => { boxes.current[i] = el; }}
                      onChange={(e) => setOtpAt(i, e.target.value)}
                      onKeyDown={(e) => onOtpKey(i, e)}
                    />
                  ))}
                </div>
                {error && <p style={{ color: "var(--ax-bad-text)", fontSize: "0.76rem", marginTop: 10 }}>{error}</p>}
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 16, flexWrap: "wrap" }}>
                  <DsButton variant="fill" disabled={busy || !otpFull} onClick={verify}>
                    {busy ? "Verifying…" : "Verify Identity"}
                  </DsButton>
                  <DsButton variant="outline" onClick={() => setOtp(["", "", "", "", "", ""])}>Resend OTP</DsButton>
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <div className="vc-success">
                  <div className="vc-disc">✓</div>
                  <h2>Identity Verified</h2>
                  <p>
                    Aadhaar matched the profile. You now hold Verification
                    Level 2 and show the Identity Verified badge to scouts.
                  </p>
                </div>
                <div style={{ marginTop: 14 }}>
                  <div style={{
                    fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.1em",
                    fontSize: "0.62rem", fontWeight: 700, color: "var(--ax-text-dim)", marginBottom: "0.4rem",
                  }}>Matched against profile</div>
                  {profile?.name && (
                    <div className="vc-kv">
                      <span className="k">Full Name</span><span className="v">{profile.name}</span>
                      <DsPill tone="ok">✓ Match</DsPill>
                    </div>
                  )}
                  {profile?.dob && (
                    <div className="vc-kv">
                      <span className="k">Date of Birth</span><span className="v">{profile.dob}</span>
                      <DsPill tone="ok">✓ Match</DsPill>
                    </div>
                  )}
                  {profile?.gender && (
                    <div className="vc-kv">
                      <span className="k">Gender</span><span className="v">{profile.gender}</span>
                      <DsPill tone="ok">✓ Match</DsPill>
                    </div>
                  )}
                  <div className="vc-kv">
                    <span className="k">Reference</span>
                    <span className="v" style={{ fontFamily: "var(--ax-font-display)" }}>{masked}</span>
                    <DsPill tone="ghost">UIDAI token</DsPill>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                  <Link href="/verify/scorecards" style={{ textDecoration: "none" }}>
                    <DsButton variant="fill">Continue → Performance Verification</DsButton>
                  </Link>
                  <Link href="/dashboard/player" style={{ textDecoration: "none" }}>
                    <DsButton variant="outline">Back to Dashboard</DsButton>
                  </Link>
                </div>
              </div>
            )}
          </VCCard>
        </div>

        <div className="vc-col">
          <VCCard title="What This Checks">
            <div className="vc-li"><span className="m">✓</span><span>Name, date of birth and gender match the profile exactly</span></div>
            <div className="vc-li"><span className="m">✓</span><span>Aadhaar photo face-matched with the profile photo</span></div>
            <div className="vc-li"><span className="m">✓</span><span>One profile per Aadhaar — duplicates are blocked</span></div>
          </VCCard>

          <VCCard title="Privacy" action={<DsPill tone="ghost">UIDAI</DsPill>}>
            <div className="vc-li"><span className="m">✓</span><span>The Aadhaar number is never stored — only a masked reference and a yes/no match result</span></div>
            <div className="vc-li"><span className="m">✓</span><span>Scouts see the badge, never the document</span></div>
            <div className="vc-li"><span className="m">✓</span><span>Minors require parent or guardian consent</span></div>
          </VCCard>

          <VCCard title="Why It Matters">
            <p style={{ fontSize: "0.8rem", color: "var(--ax-text-dim)", lineHeight: 1.55 }}>
              Identity Verified profiles appear in scout search with the L2 badge
              and unlock scorecard submission — the path to{" "}
              <span style={{ color: "var(--ax-text)", fontWeight: 600 }}>Performance Verified</span>.
            </p>
          </VCCard>
        </div>

      </div>
    </VerifyChrome>
  );
}
