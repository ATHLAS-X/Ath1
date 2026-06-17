"use client";

import { useEffect, useRef } from "react";
import StepShell from "@/components/onboarding/StepShell";

interface Props { currentStep: number; completedSteps: number[]; readOnly: boolean; }

export default function StepRegister({ currentStep, completedSteps, readOnly }: Props) {
  // Auto-complete step 1 the moment the player lands here from signup, so the
  // guard on /onboarding/[step] doesn't bounce them back when they continue.
  const didRun = useRef(false);
  useEffect(() => {
    if (didRun.current) return;
    if (completedSteps.includes(1)) return;
    didRun.current = true;
    fetch("/api/onboarding/advance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: 1 }),
    }).catch(() => { /* best-effort — Next click will retry through advance again */ });
  }, [completedSteps]);

  async function onNext() {
    // Defensive: also advance on explicit Next click in case the mount-time
    // call hasn't landed yet.
    if (!completedSteps.includes(1)) {
      await fetch("/api/onboarding/advance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: 1 }),
      }).catch(() => {});
    }
    return true;
  }

  return (
    <StepShell
      step={1}
      currentStep={currentStep}
      completedSteps={completedSteps}
      readOnly={readOnly}
      onNext={onNext}
      frontend={
        <div className="space-y-3">
          <h2 className="text-xl font-bold" style={{ color: "#E2E8F0" }}>Create your account</h2>
          <p style={{ color: "#94A3B8" }}>
            You&rsquo;re registered. Your SportX account is the entry point for your verified player profile.
          </p>
          <p className="text-sm" style={{ color: "#64748B" }}>
            Account-creation UI lives at <code>/auth/signup</code>. This step is auto-completed when you arrive here from signup.
          </p>
        </div>
      }
      backend={
        <div className="space-y-3 text-sm" style={{ color: "#94A3B8" }}>
          <h3 className="text-base font-semibold" style={{ color: "#E2E8F0" }}>What the system does</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>Creates a <code>users</code> row with bcrypt-hashed password.</li>
            <li>Starts a NextAuth session.</li>
            <li>Initializes an <code>onboarding_progress</code> row in DRAFT state.</li>
          </ul>
        </div>
      }
    />
  );
}
