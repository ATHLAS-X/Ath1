"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { VerifyChrome, VerifyLadder, VCCard, VCField, Stepper } from "@/components/verify/VerifyChrome";

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
                <Link href="/verify/scorecards" className="btn sm green" style={{ textDecoration: "none", flexShrink: 0 }}>
                  Submit Scorecards
                </Link>
              ),
            } : undefined}
          />
        </div>

        <div className="vc-col">
          <VCCard
            title="Identity Verification — Aadhaar"
            action={<span className={`bdg ${step === 2 ? "green" : "amber"}`}>{step === 2 ? "Verified ✓" : "Level 2 requirement"}</span>}
          >
            <Stepper steps={STEPS} current={step} />

            {step === 0 && (
              <div>
                <p style={{ fontSize: 12.5, color: "var(--mut)", lineHeight: 1.55, marginBottom: 10 }}>
                  Enter the 12-digit Aadhaar number of the player. A one-time
                  password will be sent to the mobile linked with Aadhaar.
                </p>
                <VCField label="Aadhaar Number" hint={`${digits.length} / 12`}>
                  <input
                    className="sinput"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="0000 0000 0000"
                    value={formatted}
                    onChange={(e) => setAadhaar(e.target.value)}
                  />
                </VCField>
                <label style={{ display: "flex", gap: 9, alignItems: "flex-start", margin: "10px 0 16px", fontSize: 12, color: "var(--mut)", lineHeight: 1.5, cursor: "pointer" }}>
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ accentColor: "var(--green)", marginTop: 2 }} />
                  <span>
                    I consent to SportX verifying my identity with UIDAI. For
                    players under 18, this action must be completed by a parent
                    or guardian.
                  </span>
                </label>
                {error && <p style={{ color: "var(--red)", fontSize: 12, marginBottom: 8 }}>{error}</p>}
                <button
                  className="btn green"
                  disabled={busy || digits.length !== 12 || !consent}
                  style={{ opacity: digits.length === 12 && consent ? 1 : 0.6 }}
                  onClick={sendOtp}
                >
                  {busy ? "Sending…" : "Send OTP"}
                </button>
              </div>
            )}

            {step === 1 && (
              <div>
                <p style={{ fontSize: 12.5, color: "var(--mut)", lineHeight: 1.55, marginBottom: 14 }}>
                  OTP sent to the mobile number linked with Aadhaar{" "}
                  <span style={{ fontFamily: "var(--num)", color: "var(--text)", fontWeight: 600 }}>{masked}</span>. Valid for 10 minutes.
                </p>
                <div className="f-label" style={{ marginTop: 0 }}>Enter 6-digit OTP</div>
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
                {error && <p style={{ color: "var(--red)", fontSize: 12, marginTop: 10 }}>{error}</p>}
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 16, flexWrap: "wrap" }}>
                  <button className="btn green" disabled={busy || !otpFull} style={{ opacity: otpFull ? 1 : 0.6 }} onClick={verify}>
                    {busy ? "Verifying…" : "Verify Identity"}
                  </button>
                  <button className="btn" onClick={() => setOtp(["", "", "", "", "", ""])}>Resend OTP</button>
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
                  <div className="f-label" style={{ marginTop: 0 }}>Matched against profile</div>
                  {profile?.name && (
                    <div className="vc-kv">
                      <span className="k">Full Name</span><span className="v">{profile.name}</span>
                      <span className="bdg green">✓ Match</span>
                    </div>
                  )}
                  {profile?.dob && (
                    <div className="vc-kv">
                      <span className="k">Date of Birth</span><span className="v">{profile.dob}</span>
                      <span className="bdg green">✓ Match</span>
                    </div>
                  )}
                  {profile?.gender && (
                    <div className="vc-kv">
                      <span className="k">Gender</span><span className="v">{profile.gender}</span>
                      <span className="bdg green">✓ Match</span>
                    </div>
                  )}
                  <div className="vc-kv">
                    <span className="k">Reference</span>
                    <span className="v" style={{ fontFamily: "var(--num)" }}>{masked}</span>
                    <span className="bdg ghost">UIDAI token</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                  <Link href="/verify/scorecards" className="btn green" style={{ textDecoration: "none" }}>
                    Continue → Performance Verification
                  </Link>
                  <Link href="/dashboard/player" className="btn" style={{ textDecoration: "none" }}>
                    Back to Dashboard
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

          <VCCard title="Privacy" action={<span className="bdg ghost">UIDAI</span>}>
            <div className="vc-li"><span className="m">✓</span><span>The Aadhaar number is never stored — only a masked reference and a yes/no match result</span></div>
            <div className="vc-li"><span className="m">✓</span><span>Scouts see the badge, never the document</span></div>
            <div className="vc-li"><span className="m">✓</span><span>Minors require parent or guardian consent</span></div>
          </VCCard>

          <VCCard title="Why It Matters">
            <p style={{ fontSize: 12.5, color: "var(--mut)", lineHeight: 1.55 }}>
              Identity Verified profiles appear in scout search with the L2 badge
              and unlock scorecard submission — the path to{" "}
              <span style={{ color: "var(--text)", fontWeight: 600 }}>Performance Verified</span>.
            </p>
          </VCCard>
        </div>

      </div>
    </VerifyChrome>
  );
}
