"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { motion } from "framer-motion";
import SportXLogo from "@/components/SportXLogo";

const SUBHEADLINE = "Discover. Verify. Scout.";

export default function HeroOverlay() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [typed, setTyped] = useState("");

  /* Headline word stagger + CTA entrance */
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".hero-word",
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.4, stagger: 0.06, ease: "power3.out", delay: 0 }
      );
      gsap.fromTo(
        ".hero-cta",
        { y: 10, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.3, stagger: 0.05, ease: "power2.out", delay: 0.25 }
      );
    }, rootRef);
    return () => ctx.revert();
  }, []);

  /* Typewriter subheadline */
  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i++;
      setTyped(SUBHEADLINE.slice(0, i));
      if (i >= SUBHEADLINE.length) clearInterval(id);
    }, 18);
    return () => clearInterval(id);
  }, []);

  return (
    <div ref={rootRef} className="absolute inset-0 z-10 flex flex-col pointer-events-none">
      {/* Wordmark */}
      <header className="flex items-center justify-between p-6 pointer-events-auto">
        <div className="flex items-center gap-3">
          <SportXLogo size="md" />
        </div>
        <Link href="/auth/login" className="text-sm text-white/70 hover:text-white transition-colors">
          Login
        </Link>
      </header>

      {/* Headline */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
        <h1 className="relative font-extrabold tracking-tight leading-tight" style={{ textShadow: "0 2px 16px rgba(0,0,0,0.85), 0 1px 4px rgba(0,0,0,0.9)" }}>
          <span className="block text-[52px] sm:text-[80px]">
            <span className="hero-word inline-block text-white">SportX</span>
          </span>
          <span className="block text-[28px] sm:text-[42px] font-semibold tracking-wide">
            <span
              className="hero-word inline-block"
              style={{
                color: "#39FF14",
                textShadow: "0 0 12px #39FF14, 0 0 28px #39FF14, 0 0 50px #22C55E",
              }}
            >
              Pathway to Dreams
            </span>
          </span>
        </h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="relative mt-4 text-lg sm:text-xl text-white/60 font-medium h-7"
        >
          {typed}
          <motion.span
            animate={{ opacity: [1, 0] }}
            transition={{ repeat: Infinity, duration: 0.7 }}
            className="inline-block w-[2px] h-5 ml-0.5 align-middle bg-[#22C55E]"
          />
        </motion.p>
        <p className="relative mt-2 text-sm text-white/40">India&apos;s Cricket Talent Discovery Platform</p>

        {/* Role selector */}
        <div className="relative mt-8 flex flex-col items-center gap-3 pointer-events-auto">
          <p className="text-xs text-white/40 uppercase tracking-widest">Select your role</p>
          <div className="flex flex-col sm:flex-row gap-3">
            {[
              { label: "Player",  desc: "Build your verified profile",     href: "/auth/signup?role=player",        border: "border-[#22C55E]", text: "text-[#4ADE80]", glow: "hover:shadow-[0_0_24px_4px_#22C55E88]", bg: "hover:bg-[#22C55E22]" },
              { label: "Scout",   desc: "Discover verified talent",        href: "/auth/signup?role=scout",         border: "border-[#3B82F6]", text: "text-[#60A5FA]", glow: "hover:shadow-[0_0_24px_4px_#3B82F688]", bg: "hover:bg-[#3B82F622]" },
              { label: "Coach",   desc: "Manage & verify your players",    href: "/auth/signup?role=coach",         border: "border-[#F59E0B]", text: "text-[#FCD34D]", glow: "hover:shadow-[0_0_24px_4px_#F59E0B88]", bg: "hover:bg-[#F59E0B22]" },
              { label: "Academy", desc: "Onboard your players in bulk",    href: "/auth/signup?role=academy_admin", border: "border-[#A78BFA]", text: "text-[#C4B5FD]", glow: "hover:shadow-[0_0_24px_4px_#A78BFA88]", bg: "hover:bg-[#A78BFA22]" },
            ].map(({ label, desc, href, border, text, glow, bg }) => (
              <Link
                key={label}
                href={href}
                className={`hero-cta group flex flex-col items-center gap-1 px-8 py-5 rounded-xl border-2 ${border} ${bg} bg-white/5 backdrop-blur-sm transition-all duration-300 ${glow} hover:scale-105 min-w-[150px]`}
              >
                <span className={`text-xl font-extrabold ${text}`}>{label}</span>
                <span className="text-[12px] text-white/60 text-center leading-tight">{desc}</span>
              </Link>
            ))}
          </div>
          <p className="text-xs text-white/30 mt-1">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-white/50 hover:text-white underline transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="flex justify-center pb-6">
        <motion.svg
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </motion.svg>
      </div>
    </div>
  );
}
