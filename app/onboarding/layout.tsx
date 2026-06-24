"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

/**
 * Wraps every route under /onboarding/* (flat directory, no route group —
 * this layout applies to /onboarding/player, /coach, /scout, /academy, not
 * just the legacy 12-step shell that used to live here).
 *
 * Auth gate only — no header bar. Each of the four real wizards renders its
 * own full-bleed OnboardingShell (rail + topbar with a Logout button), so a
 * second header here would just be a redundant black bar on top of it.
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/login");
  }, [status, router]);

  if (status !== "authenticated") return null;

  return <>{children}</>;
}
