"use client";

/* Login-page-style background applied app-wide.
   - Solid dark panel + floating particles canvas
   - position: fixed so content scrolls over it
   - Skipped on the marketing landing page (/) which has its own scene */

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const ACCENT_RGB = "255, 255, 255";

function ParticlesCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const setSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    setSize();
    window.addEventListener("resize", setSize);
    interface P { x: number; y: number; size: number; sx: number; sy: number; o: number }
    /* Lighter than login (40 vs 60) — runs on every page so we keep it cheap. */
    const particles: P[] = Array.from({ length: 40 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 1.6 + 0.8,
      sx: (Math.random() - 0.5) * 0.35,
      sy: (Math.random() - 0.5) * 0.35,
      o: Math.random() * 0.3 + 0.08,
    }));
    let raf = 0;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.sx; p.y += p.sy;
        if (p.x > canvas.width) p.x = 0;
        if (p.x < 0) p.x = canvas.width;
        if (p.y > canvas.height) p.y = 0;
        if (p.y < 0) p.y = canvas.height;
        ctx.fillStyle = `rgba(${ACCENT_RGB}, ${p.o})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", setSize);
    };
  }, []);
  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed", inset: 0, width: "100vw", height: "100vh",
        pointerEvents: "none", zIndex: 0,
      }}
    />
  );
}

/* Skipped on these paths — landing has its own hero scene, login/signup
   render their own background. */
const SKIP_PREFIXES = ["/auth/login", "/auth/signup"];

export default function AppBackground() {
  const pathname = usePathname() ?? "";
  const isLanding = pathname === "/";
  if (isLanding || SKIP_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  return (
    <>
      <div
        aria-hidden
        style={{
          position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
          background:
            "radial-gradient(1200px 600px at 50% -100px, rgba(46,224,123,0.05), transparent 70%)," +
            "#0A0A0A",
        }}
      />
      <ParticlesCanvas />
    </>
  );
}
