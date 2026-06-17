"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { ONBOARDING_STEPS, TOTAL_ONBOARDING_STEPS, getStepMeta } from "@/lib/onboarding-steps";
import StepTransition from "./StepTransition";

const CricketFieldBg = dynamic(() => import("./CricketFieldBg"), { ssr: false });
const StepCube3D = dynamic(() => import("./StepCube3D"), { ssr: false });
const StepIcon3D = dynamic(() => import("./StepIcon3D"), { ssr: false });

export interface StepShellProps {
  step: number;
  currentStep: number;
  completedSteps: number[];
  /** Main form content (player action). Single private panel. */
  frontend: React.ReactNode;
  /** Legacy prop — internal system/datastore detail. Intentionally NOT rendered
   *  anymore so we don't leak implementation to players. Kept for API
   *  compatibility with existing step components. */
  backend?: React.ReactNode;
  systemFields?: string[];
  onNext?: () => Promise<boolean> | boolean;
  nextDisabled?: boolean;
  nextLabel?: string;
  readOnly?: boolean;
}

export default function StepShell({
  step,
  currentStep,
  completedSteps,
  frontend,
  onNext,
  nextDisabled,
  nextLabel = "Next",
  readOnly = false,
}: StepShellProps) {
  const router = useRouter();
  const meta = getStepMeta(step);
  const [submitting, setSubmitting] = useState(false);

  function go(toStep: number) {
    const target = getStepMeta(toStep);
    if (!target) return;
    if (toStep > currentStep) return;
    router.push(`/onboarding/${target.slug}`);
  }

  async function handleNext() {
    if (readOnly) {
      if (step < TOTAL_ONBOARDING_STEPS) go(step + 1);
      return;
    }
    if (!onNext) {
      if (step < TOTAL_ONBOARDING_STEPS) go(step + 1);
      return;
    }
    setSubmitting(true);
    try {
      const ok = await onNext();
      if (ok) {
        if (step < TOTAL_ONBOARDING_STEPS) {
          const next = getStepMeta(step + 1);
          if (next) router.push(`/onboarding/${next.slug}`);
        } else {
          router.push("/dashboard");
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handlePrev() {
    if (step <= 1) return;
    const prev = getStepMeta(step - 1);
    if (prev) router.push(`/onboarding/${prev.slug}`);
  }

  return (
    <div className="space-y-8">
      <CricketFieldBg />
      <style>{`
        @keyframes sxNodePulse {
          0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.5); }
          70% { box-shadow: 0 0 0 8px rgba(34,197,94,0); }
          100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
        }
        @keyframes sxNodePop {
          0% { transform: scale(0.6); }
          60% { transform: scale(1.25); }
          100% { transform: scale(1); }
        }
        @keyframes sxBurst {
          0% { transform: translate(0,0) scale(1); opacity: 1; }
          100% { transform: translate(var(--bx), var(--by)) scale(0.3); opacity: 0; }
        }
      `}</style>

      {/* Step title strip */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <StepCube3D step={step} />
          <div>
            <p className="text-xs uppercase tracking-widest" style={{ color: "var(--muted)" }}>
              Step {step} of {TOTAL_ONBOARDING_STEPS}
            </p>
            <h1 className="text-3xl font-extrabold mt-1" style={{ color: "var(--text)" }}>
              {meta?.name ?? "Onboarding"}
            </h1>
          </div>
        </div>
        {readOnly && (
          <span
            className="text-xs px-2 py-1 rounded"
            style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted)" }}
          >
            Read-only (already completed)
          </span>
        )}
      </div>

      {/* Single private card — animated transition + 3D tilt */}
      <StepTransition step={step}>
        <TiltCard>
          <div style={{ position: "absolute", top: 12, right: 12, pointerEvents: "none" }}>
            <StepIcon3D step={step} />
          </div>
          {frontend}
        </TiltCard>
      </StepTransition>

      {/* Prev / Next */}
      <div className="flex items-center justify-between gap-3 mx-auto" style={{ maxWidth: 720 }}>
        <button
          type="button"
          onClick={handlePrev}
          disabled={step <= 1}
          className="flex items-center gap-2 px-4 py-2 rounded-md text-sm sx-btn-outline"
          style={{
            width: "auto",
            opacity: step <= 1 ? 0.4 : 1,
            cursor: step <= 1 ? "not-allowed" : "pointer",
          }}
        >
          <ChevronLeft size={16} />
          Prev
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={!!nextDisabled || submitting}
          className="flex items-center gap-2 px-5 py-2 rounded-md text-sm font-semibold sx-btn"
          style={{
            width: "auto",
            opacity: !!nextDisabled || submitting ? 0.5 : 1,
            cursor: !!nextDisabled || submitting ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "Saving…" : nextLabel}
          <ChevronRight size={16} />
        </button>
      </div>

      {/* 3D pipeline timeline */}
      <div className="pt-2 mx-auto" style={{ maxWidth: 980 }}>
        <div className="rounded-xl p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between gap-2 overflow-x-auto">
            {ONBOARDING_STEPS.map((s, idx) => {
              const done = completedSteps.includes(s.step);
              const active = s.step === step;
              const reachable = s.step <= currentStep;
              const nodeBg = active || done ? "#22C55E" : reachable ? "var(--border)" : "#0a1220";
              const labelColor = active || done ? "var(--text)" : reachable ? "var(--muted)" : "#3a3a3a";
              const lineFilled = s.step < step || completedSteps.includes(s.step + 1);
              return (
                <div key={s.step} className="flex items-center" style={{ minWidth: 80 }}>
                  <button
                    type="button"
                    onClick={() => reachable && go(s.step)}
                    disabled={!reachable}
                    className="flex flex-col items-center gap-1 group"
                    style={{ cursor: reachable ? "pointer" : "not-allowed", background: "transparent", border: "none" }}
                    title={`${s.step}. ${s.name}`}
                  >
                    <span style={{ position: "relative", display: "inline-flex" }}>
                      <span
                        style={{
                          width: active ? 18 : 16,
                          height: active ? 18 : 16,
                          borderRadius: 999,
                          background: nodeBg,
                          border: active ? "2px solid #4ADE80" : "2px solid transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          animation: active
                            ? "sxNodePulse 1.8s ease-out infinite"
                            : done
                            ? "sxNodePop 0.5s ease-out, sxNodePulse 2.6s ease-out infinite"
                            : "none",
                        }}
                      >
                        {done && !active && <Check size={9} color="#04130a" />}
                      </span>
                      {/* particle burst for completed nodes */}
                      {done &&
                        Array.from({ length: 5 }).map((_, i) => {
                          const a = (i / 5) * Math.PI * 2;
                          return (
                            <span
                              key={i}
                              style={
                                {
                                  position: "absolute",
                                  top: "50%",
                                  left: "50%",
                                  width: 3,
                                  height: 3,
                                  borderRadius: 999,
                                  background: "#4ADE80",
                                  "--bx": `${Math.cos(a) * 14}px`,
                                  "--by": `${Math.sin(a) * 14}px`,
                                  animation: `sxBurst 0.7s ease-out ${0.1 + idx * 0.02}s both`,
                                  pointerEvents: "none",
                                } as React.CSSProperties
                              }
                            />
                          );
                        })}
                    </span>
                    <span className="text-[10px] whitespace-nowrap" style={{ color: labelColor }}>
                      {s.step}. {s.short}
                    </span>
                  </button>
                  {idx < ONBOARDING_STEPS.length - 1 && (
                    <span
                      style={{
                        flex: 1,
                        height: 2,
                        marginInline: 6,
                        borderRadius: 2,
                        background: lineFilled
                          ? "linear-gradient(90deg, #22C55E, #14532D)"
                          : "var(--border)",
                        boxShadow: lineFilled ? "0 0 6px #22C55E55" : "none",
                        minWidth: 16,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* Glass card with mouse-tracked 3D tilt */
function TiltCard({ children }: { children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  const rotateX = useSpring(useMotionValue(0), { stiffness: 250, damping: 22 });
  const rotateY = useSpring(useMotionValue(0), { stiffness: 250, damping: 22 });
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div style={{ perspective: 1200, maxWidth: 720, margin: "0 auto" }}>
      <motion.div
        ref={ref}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = (e.clientX - rect.left) / rect.width - 0.5;
          const py = (e.clientY - rect.top) / rect.height - 0.5;
          rotateY.set(px * 12); // ±6
          rotateX.set(-py * 8); // ±4
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false);
          rotateX.set(0);
          rotateY.set(0);
        }}
        className="rounded-2xl p-6 md:p-8"
        style={{
          rotateX,
          rotateY,
          position: "relative",
          background: "var(--card)",
          border: `1px solid ${hovered ? "#22C55E99" : "var(--border)"}`,
          boxShadow: hovered
            ? "var(--glow-green, 0 0 20px #22C55E40, 0 0 60px #22C55E20), 0 30px 80px rgba(0,0,0,0.5)"
            : "0 30px 80px rgba(0,0,0,0.5)",
          transition: "border-color 0.3s ease, box-shadow 0.3s ease",
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
