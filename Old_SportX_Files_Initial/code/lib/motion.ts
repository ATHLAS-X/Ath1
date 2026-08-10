export const EASE = [0.22, 1, 0.36, 1] as const;
export const SPRING = { type: "spring", stiffness: 300, damping: 28 } as const;
export const SPRING_SOFT = { type: "spring", stiffness: 200, damping: 22 } as const;

export const staggerContainer = {
  initial: {},
  animate: { transition: { staggerChildren: 0.055, delayChildren: 0.15 } },
};

export const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
};

export const revealVariants = {
  initial: { height: 0, opacity: 0 },
  animate: {
    height: "auto",
    opacity: 1,
    transition: { height: { duration: 0.5, ease: EASE }, opacity: { duration: 0.4, ease: EASE, delay: 0.08 } },
  },
  exit: {
    height: 0,
    opacity: 0,
    transition: { height: { duration: 0.35, ease: EASE }, opacity: { duration: 0.2 } },
  },
};

export const sealVariants = {
  initial: { scale: 0.4, rotate: -20, opacity: 0 },
  animate: { scale: 1, rotate: 0, opacity: 1, transition: { ...SPRING, delay: 0.1 } },
};

export const chipVariants = {
  rest: { scale: 1 },
  hover: { scale: 1.02, y: -1, transition: SPRING },
  pressed: { scale: 0.95, transition: { duration: 0.1 } },
};

export const cardVariants = {
  rest: { scale: 1, y: 0 },
  hover: { scale: 1.01, y: -2, transition: SPRING },
  selected: { scale: 1, y: 0 },
};

export const ctaVariants = {
  rest: { scale: 1, y: 0 },
  hover: { scale: 1.02, y: -1, transition: SPRING },
  tap: { scale: 0.97, transition: { duration: 0.1 } },
};

export const stepNumVariants = {
  idle: { scale: 1, backgroundColor: "rgba(0,0,0,0)" },
  current: { scale: 1.05, transition: SPRING },
  done: { scale: 1, transition: { duration: 0.3 } },
};
