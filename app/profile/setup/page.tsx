"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { CheckCircle2, Circle, ChevronRight, ChevronDown, ArrowLeft, ArrowRight } from "lucide-react";
import ErrorBoundary from "@/components/ErrorBoundary";
import Loader from "@/components/Loader";
import MyProfileCard from "@/components/MyProfileCard";
import { ONBOARDING_STEPS, getStepMeta } from "@/lib/onboarding-steps";

interface OnboardingState {
  currentStep: number;
  completedSteps: number[];
  totalSteps: number;
  percentComplete: number;
  status: string;
}

interface ProfileMe {
  userId: string;
  profile: {
    city?: string | null;
    state?: string | null;
    playing_role?: string | null;
    avatar_url?: string | null;
  } | null;
}

interface CricketProfile {
  player_role?: string | null;
}

interface ScoreRow {
  total_score?: number;
  profile_strength?: "STRONG" | "MID" | "WEAK" | null;
  coach_verified?: boolean;
}

/**
 * The 12 onboarding steps grouped into 4 logical chapters so the editor
 * reads as a single coherent flow.
 */
const CHAPTERS: { title: string; tagline: string; steps: number[] }[] = [
  {
    title: "Identity & Consent",
    tagline: "Who you are, verified.",
    steps: [1, 2, 3],
  },
  {
    title: "Cricket Profile",
    tagline: "Your role, stats, and recent matches.",
    steps: [4, 5, 6],
  },
  {
    title: "Performance & Mindset",
    tagline: "Fitness, behaviour, and technique read.",
    steps: [7, 8, 9],
  },
  {
    title: "Verification & Discovery",
    tagline: "Coach endorsement, score, and going live.",
    steps: [10, 11, 12],
  },
];

function EditProfileHubInner() {
  const { data: session, status } = useSession();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [me, setMe] = useState<ProfileMe | null>(null);
  const [cricket, setCricket] = useState<CricketProfile | null>(null);
  const [score, setScore] = useState<ScoreRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [openChapter, setOpenChapter] = useState<number | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    (async () => {
      try {
        const [stateRes, meRes, cricketRes, scoreRes] = await Promise.all([
          fetch("/api/onboarding/state"),
          fetch("/api/profile/me"),
          fetch("/api/onboarding/cricket-profile"),
          fetch("/api/onboarding/score"),
        ]);
        const stateJson = await stateRes.json().catch(() => null);
        const meJson = await meRes.json().catch(() => null);
        const cricketJson = await cricketRes.json().catch(() => null);
        const scoreJson = await scoreRes.json().catch(() => null);
        if (cancelled) return;
        if (stateJson?.success) setState(stateJson.data);
        if (meJson?.success) setMe(meJson.data);
        if (cricketJson?.success) setCricket(cricketJson.data ?? null);
        if (scoreJson?.success) setScore(scoreJson.data ?? null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [status]);

  if (status === "loading" || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader />
      </main>
    );
  }

  const completed = new Set(state?.completedSteps ?? []);
  const currentStep = state?.currentStep ?? 1;
  const percent = state?.percentComplete ?? 0;

  const name = session?.user?.name ?? "Player";
  const handle = `@${name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24)}`;
  const locationStr =
    me?.profile?.city && me?.profile?.state
      ? `${me.profile.city}, ${me.profile.state}`
      : me?.profile?.state ?? null;
  const role = cricket?.player_role ?? me?.profile?.playing_role ?? null;

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="space-y-3">
          <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm sx-link">
            <ArrowLeft size={14} /> Back to dashboard
          </Link>
          <h1 className="text-3xl font-bold">Edit Profile</h1>
          <p style={{ color: "var(--muted)" }}>
            One flow, four chapters. Pick any step to update — your dashboard, public profile, and
            AthlasX Score refresh as soon as you save.
          </p>
        </header>

        {/* Player Card preview */}
        <MyProfileCard
          name={name}
          avatarUrl={me?.profile?.avatar_url ?? null}
          handle={handle}
          caption={role ? `${role}${locationStr ? ` · ${locationStr}` : ""}` : (locationStr ?? "AthlasX Player")}
          role={role}
          location={locationStr}
          score={score?.total_score ?? null}
          strength={score?.profile_strength ?? null}
          coachVerified={!!score?.coach_verified}
          isOwner={true}
          shareUrl={me?.userId ? `/profile/${me.userId}` : "/profile"}
        />

        {/* Unified flow card */}
        <section className="sx-card overflow-hidden">
          {CHAPTERS.map((chap, ci) => {
            const chapSteps = chap.steps.map((n) => getStepMeta(n)!).filter(Boolean);
            const chapDone = chap.steps.filter((n) => completed.has(n)).length;
            const isOpen = openChapter === ci;
            const allDone = chapDone === chap.steps.length;
            return (
              <div
                key={chap.title}
                style={{
                  borderTop: ci === 0 ? "none" : "1px solid var(--border)",
                }}
              >
                {/* Chapter header — clickable to expand/collapse */}
                <button
                  type="button"
                  onClick={() => setOpenChapter(isOpen ? null : ci)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between px-5 py-4 text-left"
                  style={{ background: "transparent", border: "none", cursor: "pointer" }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{
                        background: allDone ? "var(--accent)" : "var(--border)",
                        color: allDone ? "#000" : "var(--text)",
                      }}
                    >
                      {ci + 1}
                    </span>
                    <div>
                      <p className="font-bold" style={{ color: "var(--text)" }}>{chap.title}</p>
                      <p className="text-xs" style={{ color: "var(--muted)" }}>{chap.tagline}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs" style={{ color: "var(--muted)" }}>
                      {chapDone}/{chap.steps.length}
                    </span>
                    <ChevronDown
                      size={16}
                      style={{
                        color: "var(--muted)",
                        transition: "transform 200ms ease",
                        transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                      }}
                    />
                  </div>
                </button>

                {/* Chapter step rows — only render when open */}
                {isOpen && (
                  <ul style={{ borderTop: "1px solid var(--border)" }}>
                    {chapSteps.map((s, i) => {
                      const isDone = completed.has(s.step);
                      const isReachable = s.step <= currentStep;
                      const href = isReachable ? `/onboarding/${s.slug}` : "#";
                      return (
                        <li
                          key={s.step}
                          style={{
                            borderTop: i === 0 ? "none" : "1px solid var(--border)",
                            opacity: isReachable ? 1 : 0.45,
                          }}
                        >
                          <Link
                            href={href}
                            aria-disabled={!isReachable}
                            className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.03] transition-colors"
                            style={{
                              textDecoration: "none",
                              cursor: isReachable ? "pointer" : "not-allowed",
                            }}
                          >
                            {isDone ? (
                              <CheckCircle2 size={16} style={{ color: "var(--text)", flexShrink: 0 }} />
                            ) : (
                              <Circle size={16} style={{ color: "var(--muted)", flexShrink: 0 }} />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
                                <span style={{ color: "var(--muted)", marginRight: 8 }}>
                                  Step {s.step}
                                </span>
                                {s.name}
                              </p>
                            </div>
                            <span className="text-xs" style={{ color: "var(--muted)" }}>
                              {isDone ? "Edit" : isReachable ? "Continue" : "Locked"}
                            </span>
                            <ChevronRight size={14} style={{ color: "var(--muted)", flexShrink: 0 }} />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}

          {/* Footer CTA */}
          <div
            className="px-5 py-4 flex items-center justify-between gap-3 flex-wrap"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                {percent === 100 ? "Everything's saved." : "Pick up where you left off"}
              </p>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                {percent === 100
                  ? "Edit any step above to update your profile in place."
                  : `You're on step ${currentStep} of ${ONBOARDING_STEPS.length}.`}
              </p>
            </div>
            <Link
              href="/onboarding"
              className="sx-btn inline-flex items-center gap-2"
              style={{ width: "auto", padding: "10px 16px" }}
            >
              {percent === 100 ? "Open editor" : "Resume flow"} <ArrowRight size={14} />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function EditProfileHubPage() {
  return (
    <ErrorBoundary>
      <EditProfileHubInner />
    </ErrorBoundary>
  );
}
