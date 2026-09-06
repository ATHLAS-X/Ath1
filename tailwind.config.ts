import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Orange/black system from design/import/AthlasX Onboarding.html's
      // :root (same palette as / and /auth, commit 0d19f74) — registered
      // globally per this design-system pass. Values copied verbatim, not
      // invented; see design/import/MAPPING.md "System A" for provenance.
      colors: {
        ax: {
          bg: "#0D0D0D",
          bgSoft: "#141312",
          text: "#F5F5F0",
          textDim: "rgba(245, 245, 240, 0.62)",
          textFaint: "rgba(245, 245, 240, 0.4)",
          accent: "#FF8A1E",
          accentBright: "#FFA64D",
          ok: "#38d39f",
          bad: "#ff5a4d",
          cardBorder: "rgba(245, 245, 240, 0.14)",
          fieldBg: "rgba(245, 245, 240, 0.06)",
        },
      },
      // The mockups' literal radius values that don't land on Tailwind's
      // existing rounded-md(6px)/rounded-lg(8px)/rounded-xl(12px)/
      // rounded-2xl(16px)/rounded-full scale.
      borderRadius: {
        "ax-xs": "3px",
        "ax-sm": "7px",
        "ax-md": "9px",
        "ax-lg": "10px",
        "ax-xl": "11px",
      },
      fontFamily: {
        anton: ["var(--font-anton)", "sans-serif"],
        barlow: ["var(--font-barlow)", "sans-serif"],
        "barlow-semi": ["var(--font-barlow-semi)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
