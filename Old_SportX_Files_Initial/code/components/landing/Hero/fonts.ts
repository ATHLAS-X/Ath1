import { Anton, Barlow, Barlow_Semi_Condensed } from "next/font/google";

/* Self-hosted via next/font/google — NOT the raw <link> tags the source
   static HTML used. That approach makes a runtime request to
   fonts.googleapis.com, which next.config.mjs's CSP (`font-src 'self'`)
   blocks; next/font downloads the files at build time and serves them
   same-origin, same pattern as the Inter/Space Grotesk/Instrument Sans
   loaders in app/layout.tsx. Scoped to this component tree only (applied
   via className on the Hero root, not on <html>) since the rest of the app
   doesn't use these typefaces. */

export const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-anton",
  display: "swap",
});

export const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-barlow",
  display: "swap",
});

export const barlowSemiCondensed = Barlow_Semi_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-barlow-semi",
  display: "swap",
});
