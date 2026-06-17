"use client";

import { useEffect, useRef, useState } from "react";

export interface ScoreRingProps {
  /** 0–100 */
  score: number;
  /** sm = 80, md = 140, lg = 200 */
  size?: "sm" | "md" | "lg";
  /** Show "SportX Score" label inside the ring */
  showLabel?: boolean;
  /** Animate from 0 to the final value over 1500ms on mount */
  animate?: boolean;
  /** Override label text */
  label?: string;
}

const SIZE_MAP: Record<NonNullable<ScoreRingProps["size"]>, number> = {
  sm: 80,
  md: 140,
  lg: 200,
};

function colorFor(score: number) {
  if (score >= 70) return "#22C55E";
  if (score >= 40) return "#F59E0B";
  return "#EF4444";
}

export default function ScoreRing({
  score,
  size = "md",
  showLabel = true,
  animate = true,
  label,
}: ScoreRingProps) {
  const dim = SIZE_MAP[size];
  const stroke = size === "lg" ? 14 : size === "md" ? 10 : 7;
  const r = dim / 2 - stroke;
  const cx = dim / 2;
  const cy = dim / 2;
  const C = 2 * Math.PI * r;

  const target = Math.max(0, Math.min(100, Math.round(score)));
  const [display, setDisplay] = useState(animate ? 0 : target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!animate) {
      setDisplay(target);
      return;
    }
    const start = performance.now();
    const duration = 1500;
    const from = display;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (target - from) * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, animate]);

  const stroked = colorFor(display);
  const dash = (display / 100) * C;

  const scoreFontSize = size === "lg" ? 44 : size === "md" ? 32 : 20;
  const labelFontSize = size === "lg" ? 12 : size === "md" ? 10 : 8;

  return (
    <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} role="img" aria-label={`Score ${target}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1E3A5F" strokeWidth={stroke} />
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={stroked}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${C - dash}`}
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: "stroke 200ms ease" }}
      />
      <text
        x={cx} y={cy + scoreFontSize / 3}
        textAnchor="middle"
        fontSize={scoreFontSize}
        fontWeight={700}
        fill={stroked}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      >
        {display}
      </text>
      {showLabel && (
        <text
          x={cx} y={cy + scoreFontSize / 3 + labelFontSize + 6}
          textAnchor="middle"
          fontSize={labelFontSize}
          fill="#94A3B8"
          letterSpacing="2"
        >
          {(label ?? "SPORTX SCORE").toUpperCase()}
        </text>
      )}
    </svg>
  );
}
