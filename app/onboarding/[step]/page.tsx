"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ONBOARDING_STEPS, getStepMeta } from "@/lib/onboarding-steps";
import Loader from "@/components/Loader";

import StepRegister from "@/components/onboarding/steps/StepRegister";
import StepAadhaar from "@/components/onboarding/steps/StepAadhaar";
import StepMinorGuard from "@/components/onboarding/steps/StepMinorGuard";
import StepRole from "@/components/onboarding/steps/StepRole";
import StepStats from "@/components/onboarding/steps/StepStats";
import StepMatchLog from "@/components/onboarding/steps/StepMatchLog";
import StepFitness from "@/components/onboarding/steps/StepFitness";
import StepBehaviour from "@/components/onboarding/steps/StepBehaviour";
import StepVideoAI from "@/components/onboarding/steps/StepVideoAI";
import StepCoachVerify from "@/components/onboarding/steps/StepCoachVerify";
import StepScore from "@/components/onboarding/steps/StepScore";
import StepDiscover from "@/components/onboarding/steps/StepDiscover";

const COMPONENTS: Record<number, React.ComponentType<{ currentStep: number; completedSteps: number[]; readOnly: boolean }>> = {
  1: StepRegister,
  2: StepAadhaar,
  3: StepMinorGuard,
  4: StepRole,
  5: StepStats,
  6: StepMatchLog,
  7: StepFitness,
  8: StepBehaviour,
  9: StepVideoAI,
  10: StepCoachVerify,
  11: StepScore,
  12: StepDiscover,
};

export default function OnboardingStepPage() {
  const params = useParams<{ step: string }>();
  const router = useRouter();
  const { status } = useSession();
  const [state, setState] = useState<{ currentStep: number; completedSteps: number[]; status: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const slug = params?.step;
  const meta =
    ONBOARDING_STEPS.find((s) => s.slug === slug) ??
    (slug && /^\d+$/.test(slug) ? getStepMeta(Number(slug)) : null);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/onboarding/state");
        const text = await res.text();
        const data = text ? (() => { try { return JSON.parse(text); } catch { return null; } })() : null;
        if (cancelled) return;
        if (!data?.success) {
          setError(data?.error ?? "Failed to load onboarding state");
          return;
        }
        setState({
          currentStep: data.data.currentStep,
          completedSteps: data.data.completedSteps ?? [],
          status: data.data.status,
        });
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Network error");
      }
    })();
    return () => { cancelled = true; };
  }, [status, slug]);

  // Guard: invalid slug
  useEffect(() => {
    if (!meta && slug) {
      router.replace("/onboarding");
    }
  }, [meta, slug, router]);

  /* No guard on jumping ahead: players reach the dashboard via the wizard
     flow (/onboarding/player) which doesn't update onboarding_progress, so
     they'd otherwise be locked out of revisiting individual verification
     steps like Aadhaar. Each step component handles its own prerequisites. */

  if (status === "loading" || !state || !meta) {
    return <div className="py-20 flex justify-center"><Loader /></div>;
  }
  if (error) {
    return <div className="py-20 text-center" style={{ color: "#EF4444" }}>{error}</div>;
  }

  const Component = COMPONENTS[meta.step];
  if (!Component) {
    return <div className="py-20 text-center" style={{ color: "#EF4444" }}>Unknown step.</div>;
  }

  // Completed steps are editable on revisit — re-submitting upserts the data.
  // Pass `?view=1` in the URL to lock the form in read-only mode.
  const readOnly = false;

  return (
    <Component
      currentStep={state.currentStep}
      completedSteps={state.completedSteps}
      readOnly={readOnly}
    />
  );
}
