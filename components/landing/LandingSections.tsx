import Image from "next/image";
import Link from "next/link";
import { anton, barlow, barlowSemiCondensed } from "@/components/landing/Hero/fonts";
import { heroStyles } from "@/components/landing/Hero/styles";

/* Marketing content below the Hero (Master 20). Deliberately short — this
   is the page's only other section, by design (see Master 21). Reuses the
   Hero's own token/style source (heroStyles + the same font loaders) rather
   than athlasx.css, so it reads as a continuation of the Hero, not a
   different page bolted on underneath. `.hx-stage` is the exact same class
   the Hero's root uses — reused verbatim here, not redeclared, so this
   section inherits the same --hx-* custom properties from one definition. */

/* Pulled from the role gallery this section replaces (see Master 21) — same
   signup hrefs, just no longer presented as a full gallery. */
const ROLE_BLURBS = [
  {
    role: "Player",
    d: "Build a verified profile once. Get seen by scouts everywhere — no agent, no connections required.",
    href: "/auth/signup?role=player",
  },
  {
    role: "Academy",
    d: "Bulk-import your roster, manage coaches, and surface every player you train to verified scouts.",
    href: "/auth/signup?role=academy_admin",
  },
  {
    role: "Coach",
    d: "Log fitness and behavioural evaluations, and endorse the scorecards your players submit.",
    href: "/auth/signup?role=coach",
  },
  {
    role: "Scout",
    d: "Skip the word-of-mouth network. Filter, compare, and shortlist verified players by real performance data.",
    href: "/auth/signup?role=scout",
  },
] as const;

/* Small accent thumbnails — reuse the Hero's own collage images (already in
   this codebase, not new assets) for visual continuity into this section. */
const ACCENT_THUMBS = [
  { src: "/images/hero/cricket.jpg", alt: "" },
  { src: "/images/hero/badminton.jpg", alt: "" },
  { src: "/images/hero/volleyball.jpg", alt: "" },
];

export default function LandingSections() {
  return (
    <>
      <section className={`hx-stage wd-section ${anton.variable} ${barlow.variable} ${barlowSemiCondensed.variable}`}>
        <style dangerouslySetInnerHTML={{ __html: heroStyles }} />

        <div className="wd-shell">
          <p className="wd-grassroots">Grassroots to Global · District · State · Beyond</p>
          <div className="wd-eyebrow">What We Do</div>
          <h2 className="wd-heading">
            One platform. <span className="wd-accent">Every</span> sport. Every talent, verified.
          </h2>
          <p className="wd-sub">
            AthlasX is where athletes get discovered on merit — verified profiles, real performance
            data, and direct access to scouts, with no agent and no connections required. It handles
            player onboarding, academy onboarding, and coach and scout onboarding, all in one place.
          </p>
          <p className="wd-tagline">
            Every sport. Every talent. <b>One platform.</b>
          </p>

          <div className="wd-thumbs" aria-hidden="true">
            {ACCENT_THUMBS.map((t) => (
              <div key={t.src} className="wd-thumb">
                <Image src={t.src} alt={t.alt} fill sizes="52px" />
              </div>
            ))}
          </div>

          <div className="wd-grid">
            {ROLE_BLURBS.map((r) => (
              <div key={r.role} className="wd-card">
                <div className="wd-card-role">{r.role}</div>
                <p className="wd-card-d">{r.d}</p>
                <Link href={r.href} className="hx-btn hx-btn-outline">
                  Start as {r.role}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className={`wd-foot ${barlow.variable}`}>
        © {new Date().getFullYear()} AthlasX. All rights reserved.
      </footer>
    </>
  );
}