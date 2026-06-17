"use client";

import { useEffect, useRef, useState } from "react";

const COLORS = ["#22C55E", "#4ADE80", "#3B82F6", "#60A5FA", "#F59E0B", "#FBBF24", "#FFFFFF"];

interface Props {
  onDone?: () => void;
  durationMs?: number;
}

/** Full-screen confetti overlay for ~3s, then fades out and calls onDone. */
export default function CompletionCelebration({ onDone, durationMs = 3000 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    interface P {
      x: number; y: number; vx: number; vy: number;
      size: number; color: string; rot: number; vr: number;
    }
    const parts: P[] = Array.from({ length: 200 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height * 0.5,
      vx: (Math.random() - 0.5) * 2,
      vy: 2 + Math.random() * 3,
      size: 4 + Math.random() * 8,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.2,
    }));

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of parts) {
        p.vy += 0.04; // gravity
        p.vx += (Math.random() - 0.5) * 0.08; // drift
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        if (p.y > canvas.height + 20) {
          p.y = -20;
          p.vy = 2 + Math.random() * 3;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
    };
    tick();

    const fadeTimer = setTimeout(() => setFading(true), durationMs);
    const doneTimer = setTimeout(() => {
      cancelAnimationFrame(raf);
      onDone?.();
    }, durationMs + 600);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [durationMs, onDone]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        pointerEvents: "none",
        opacity: fading ? 0 : 1,
        transition: "opacity 0.6s ease",
      }}
    />
  );
}
