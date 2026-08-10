"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface Props {
  step: number;
  children: React.ReactNode;
}

/**
 * Animated step entrance/exit. Slides left when moving forward,
 * right when moving backward. Direction is tracked internally.
 */
export default function StepTransition({ step, children }: Props) {
  const prevStep = useRef(step);
  const direction = step >= prevStep.current ? 1 : -1;

  useEffect(() => {
    prevStep.current = step;
  }, [step]);

  return (
    <AnimatePresence mode="wait" custom={direction}>
      <motion.div
        key={step}
        custom={direction}
        initial={{ x: 100 * direction, opacity: 0, scale: 0.95 }}
        animate={{
          x: 0,
          opacity: 1,
          scale: 1,
          transition: { type: "spring", stiffness: 200, damping: 25, duration: 0.35 },
        }}
        exit={{
          x: -100 * direction,
          opacity: 0,
          scale: 0.95,
          transition: { duration: 0.25 },
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
