"use client";

import dynamic from "next/dynamic";
import HeroOverlay from "@/components/landing/HeroOverlay";
import LandingSections from "@/components/landing/LandingSections";

const HeroScene = dynamic(() => import("@/components/landing/HeroScene"), { ssr: false });

export default function Home() {
  return (
    <>
      {/* Hero (full screen) */}
      <section
        className="relative h-screen overflow-hidden"
        style={{ background: "var(--bg)" }}
      >
        <HeroScene />
        <HeroOverlay />
      </section>

      {/* Scrollable flow below the fold */}
      <LandingSections />
    </>
  );
}
