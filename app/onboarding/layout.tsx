"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams, usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { ONBOARDING_STEPS, TOTAL_ONBOARDING_STEPS, getStepMeta } from "@/lib/onboarding-steps";
import Loader from "@/components/Loader";
import SportXLogo from "@/components/SportXLogo";

interface OnboardingStateLite {
  currentStep: number;
  completedSteps: number[];
  status: string;
}

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ step?: string }>();
  const [state, setState] = useState<OnboardingStateLite | null>(null);

  // Auth gate
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/login");
  }, [status, router]);

  // Pull current onboarding state once authenticated
  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/onboarding/state");
        const text = await res.text();
        const data = text ? (() => { try { return JSON.parse(text); } catch { return null; } })() : null;
        if (cancelled || !data?.success) return;
        setState({
          currentStep: data.data.currentStep,
          completedSteps: data.data.completedSteps ?? [],
          status: data.data.status,
        });
      } catch {
        /* swallow — page handles its own errors */
      }
    })();
    return () => { cancelled = true; };
  }, [status, pathname]);

  // Figure out which step the user is currently viewing (from the URL slug
  // if present; otherwise fall back to the server state).
  const slugParam = (params?.step as string | undefined) ?? null;
  const viewingMeta = slugParam
    ? ONBOARDING_STEPS.find((s) => s.slug === slugParam || String(s.step) === slugParam) ?? null
    : null;
  const viewingStep = viewingMeta?.step ?? state?.currentStep ?? 1;
  const viewingName = getStepMeta(viewingStep)?.name ?? "Onboarding";
  const fillPct = Math.max(0, Math.min(100, (viewingStep / TOTAL_ONBOARDING_STEPS) * 100));

  if (status === "loading" || (status === "authenticated" && !state)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)", color: "var(--muted)" }}>
        <Loader label="Loading onboarding" />
      </div>
    );
  }

  if (status !== "authenticated") return null;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
      {/* Fixed progress bar */}
      <div
        style={{
          position: "fixed",
          top: 0, left: 0, right: 0,
          height: 2,
          background: "var(--border)",
          zIndex: 60,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${fillPct}%`,
            background: "var(--accent)",
            transition: "width 300ms ease",
          }}
        />
      </div>

      {/* Header */}
      <header
        style={{
          position: "sticky",
          top: 2,
          zIndex: 50,
          background: "rgba(0,0,0,0.85)",
          borderBottom: "1px solid var(--border)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <Link href="/dashboard" className="flex items-center">
            <SportXLogo />
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span style={{ color: "var(--muted)" }}>
              Step <span style={{ color: "var(--text)", fontWeight: 700 }}>{viewingStep}</span> / {TOTAL_ONBOARDING_STEPS}
            </span>
            <span style={{ width: 1, height: 16, background: "var(--border)" }} />
            <span style={{ color: "var(--text)", fontWeight: 600 }}>{viewingName}</span>
            <span style={{ width: 1, height: 16, background: "var(--border)" }} />
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/auth/login" })}
              style={{
                background: "transparent",
                border: "1px solid rgba(248,113,113,0.35)",
                color: "#F87171",
                fontSize: 12,
                fontWeight: 600,
                padding: "5px 12px",
                borderRadius: 8,
                cursor: "pointer",
                transition: "background 0.14s, border-color 0.14s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(248,113,113,0.1)";
                e.currentTarget.style.borderColor = "rgba(248,113,113,0.6)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "rgba(248,113,113,0.35)";
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-8 pb-16">{children}</main>
    </div>
  );
}
