"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

interface Panel {
  area: "p1" | "p2" | "p3" | "p4" | "p5" | "p6" | "p7";
  sport: string;
  src: string;
  alt: string;
  filter: string;
  focus?: string;
  bg?: string;
}

/* Per-panel data, alt text, and editorial filter grading ported verbatim
   from the source spec's ATHLASX_IMAGES array + per-panel CSS. */
const PANELS: Panel[] = [
  {
    area: "p1", sport: "motorsport", src: "/images/hero/motorsport.jpg",
    alt: "Motorsport driver standing on a single-seater race car under a vast cloud-streaked sky",
    filter: "saturate(1.05) contrast(1.04) brightness(0.96)",
  },
  {
    area: "p2", sport: "badminton", src: "/images/hero/badminton.jpg",
    alt: "Badminton player roaring in triumph with racket raised, national flag behind",
    filter: "saturate(1.2) contrast(1.05) brightness(1.02) hue-rotate(-4deg)",
  },
  {
    area: "p3", sport: "champions-1", src: "/images/hero/Champions1.jpg",
    alt: "Champions celebrating victory",
    filter: "saturate(1.18) contrast(1.12) brightness(0.98)",
    focus: "50% 30%",
  },
  {
    area: "p4", sport: "tennis", src: "/images/hero/tennis.jpg",
    alt: "Cubist-style tennis player mid-roar gripping a racket",
    filter: "saturate(1.1) contrast(1.06) brightness(0.99)",
    focus: "50% 22%",
  },
  {
    area: "p5", sport: "volleyball", src: "/images/hero/volleyball.jpg",
    alt: "Volleyball player leaping to serve against a splash of blue and gold paint",
    filter: "saturate(1.24) contrast(1.05) brightness(1.0)",
    focus: "46% 30%",
  },
  {
    area: "p6", sport: "champions-2", src: "/images/hero/Champions2.jpg",
    alt: "Champions celebrating victory",
    filter: "saturate(1.1) contrast(1.04) brightness(1.0)",
    focus: "50% 42%",
    bg: "#0d0d0d",
  },
  {
    area: "p7", sport: "tennis-2", src: "/images/hero/tennis-sunburst.jpg",
    alt: "Stylised tennis player against a radiating sunburst of warm colour",
    filter: "saturate(1.06) contrast(1.1) brightness(0.94)",
    focus: "50% 30%",
  },
];

/* Safety net: reveal the zoom-settle transition even if some images stall —
   ported from the source spec's `setTimeout(..., 2200)`. */
const SAFETY_TIMEOUT_MS = 2200;

export default function HeroCollage() {
  const [errored, setErrored] = useState<Record<string, boolean>>({});
  const [isReady, setIsReady] = useState(false);
  const readyRef = useRef(false);
  const settledSports = useRef<Set<string>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => {
      if (!readyRef.current) {
        readyRef.current = true;
        setIsReady(true);
      }
    }, SAFETY_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, []);

  function markSettled(sport: string) {
    if (settledSports.current.has(sport)) return;
    settledSports.current.add(sport);
    if (!readyRef.current && settledSports.current.size >= PANELS.length) {
      readyRef.current = true;
      setIsReady(true);
    }
  }

  return (
    <section className="hx-collage" aria-hidden="true">
      {PANELS.map((p) => {
        const hasErrored = !!errored[p.sport];
        return (
          <figure
            key={p.area}
            className={`hx-panel hx-${p.area}`}
            style={{
              background: hasErrored
                ? "linear-gradient(135deg, rgba(255,138,30,0.22), rgba(13,13,13,0.9))"
                : p.bg,
            }}
          >
            {!hasErrored && (
              <Image
                src={p.src}
                alt={p.alt}
                fill
                sizes="(max-width: 640px) 100vw, 50vw"
                priority={p.area === "p1"}
                className={`hx-img${isReady ? " hx-img--ready" : ""}`}
                style={{ objectFit: "cover", objectPosition: p.focus ?? "50% 38%", filter: p.filter }}
                onLoad={() => markSettled(p.sport)}
                onError={() => {
                  setErrored((prev) => ({ ...prev, [p.sport]: true }));
                  markSettled(p.sport);
                }}
              />
            )}
          </figure>
        );
      })}
    </section>
  );
}
