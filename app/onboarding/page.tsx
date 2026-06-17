"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ONBOARDING_STEPS, TOTAL_ONBOARDING_STEPS } from "@/lib/onboarding-steps";

export default function OnboardingRouterPage() {
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") return;
    (async () => {
      try {
        const res = await fetch("/api/onboarding/state");
        const text = await res.text();
        const data = text ? (() => { try { return JSON.parse(text); } catch { return null; } })() : null;
        if (!data?.success) {
          router.replace("/dashboard");
          return;
        }
        const completed: number[] = data.data.completedSteps ?? [];
        const current: number = data.data.currentStep ?? 1;

        if (completed.length >= TOTAL_ONBOARDING_STEPS || data.data.status === "COMPLETED") {
          router.replace("/dashboard");
          return;
        }

        const meta = ONBOARDING_STEPS.find((s) => s.step === current) ?? ONBOARDING_STEPS[0];
        router.replace(`/onboarding/${meta.slug}`);
      } catch {
        router.replace("/dashboard");
      }
    })();
  }, [status, router]);

  return (
    <div className="py-20 text-center" style={{ color: "#94A3B8" }}>
      Routing to your next step…
    </div>
  );
}
