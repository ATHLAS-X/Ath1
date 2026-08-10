import Hero from "@/components/landing/Hero";
import LandingSections from "@/components/landing/LandingSections";

export default function Home() {
  return (
    <>
      <Hero />

      {/* Scrollable flow below the fold */}
      <LandingSections />
    </>
  );
}
