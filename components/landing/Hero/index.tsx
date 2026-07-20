import { anton, barlow, barlowSemiCondensed } from "./fonts";
import { heroStyles } from "./styles";
import HeroCollage from "./HeroCollage";
import HeroBrand from "./HeroBrand";
import HeroAuthBar from "./HeroAuthBar";
import HeroCorner from "./HeroCorner";

/* Multi-sport hero — replaces the old cricket-ball Three.js scene
   (HeroScene.tsx) + HeroOverlay.tsx. Ported from the standalone
   "AthlasX Hero.html" spec: a 7-panel golden-ratio photo collage with a
   centered brand overlay, top-right account bar, and top-left brandmark. */
export default function Hero() {
  return (
    <main
      className={`hx-stage ${anton.variable} ${barlow.variable} ${barlowSemiCondensed.variable}`}
      aria-label="AthlasX — multi-sport talent discovery"
    >
      <style dangerouslySetInnerHTML={{ __html: heroStyles }} />

      <HeroCollage />
      <div className="hx-vignette" />
      <HeroCorner />
      <HeroBrand />
      <HeroAuthBar />
    </main>
  );
}
