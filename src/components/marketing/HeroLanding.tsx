import Image from 'next/image'
import { Anton, Barlow, Barlow_Semi_Condensed } from 'next/font/google'

const anton = Anton({ subsets: ['latin'], weight: '400', variable: '--font-anton' })
const barlow = Barlow({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-barlow' })
const barlowSemi = Barlow_Semi_Condensed({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-barlow-semi' })

// Palette + collage layout lifted from design/import/AthlasX Hero.html —
// scoped to this component only, not a site-wide token change. Resolves
// design/import/MAPPING.md's open decision #4 for the landing + auth pages
// specifically, on direct instruction, not globally.
const HERO_VARS = {
  '--accent': '#FF8A1E',
  '--accent-bright': '#FFA64D',
  '--bg': '#0D0D0D',
  '--bg-soft': '#141312',
} as React.CSSProperties

// grid-template-areas "p1 p2 p3 p3" / "p1 p4 p5 p7" / "p6 p4 p5 p7" from the
// mockup, translated to inline styles since Tailwind can't express a
// multi-row named grid-template-areas string as a utility class.
const PANELS = [
  { area: 'p1', src: '/images/hero/motorsport.jpg', alt: 'Motorsport driver standing on a single-seater race car under a vast cloud-streaked sky', objectPosition: '50% 38%' },
  { area: 'p2', src: '/images/hero/badminton.jpg', alt: 'Badminton player roaring in triumph with racket raised, national flag behind', objectPosition: '50% 38%' },
  { area: 'p3', src: '/images/hero/cricket.jpg', alt: 'Cricketer in national kit, number 18, looking out over a smoke-coloured sky', objectPosition: '50% 30%' },
  { area: 'p4', src: '/images/hero/tennis.jpg', alt: 'Cubist-style tennis player mid-roar gripping a racket', objectPosition: '50% 22%' },
  { area: 'p5', src: '/images/hero/volleyball.jpg', alt: 'Volleyball player leaping to serve against a splash of blue and gold paint', objectPosition: '46% 30%' },
  { area: 'p6', src: '/images/hero/cricket-sketch-wide.png', alt: 'Sketch-and-paint landscape composite of a cricketer in national blue', objectPosition: '50% 42%' },
  { area: 'p7', src: '/images/hero/tennis-sunburst.jpg', alt: 'Stylised tennis player against a radiating sunburst of warm colour', objectPosition: '50% 30%' },
]

const FEATURES = [
  {
    title: 'Association Ingest',
    body: 'Historical tournament and scorecard data flows in from state and district associations, normalized and confidence-scored before anything downstream trusts it.',
  },
  {
    title: 'Identity Resolution',
    body: 'Every performance resolves to a canonical player identity — no duplicate profiles, no lost history across seasons and formats.',
  },
  {
    title: 'Blind Selection',
    body: 'Selectors grade independently; no one sees a peer’s score until the chair unlocks convergence. The single most valuable design choice in the pathway.',
  },
  {
    title: 'In-Season Tracking',
    body: 'Form drops, workload spikes, and participation gaps surface automatically from verified match data — never self-reported.',
  },
]

export default function HeroLanding() {
  return (
    <div className={`${anton.variable} ${barlow.variable} ${barlowSemi.variable}`}>
      <div style={HERO_VARS} className="relative min-h-[100dvh] overflow-hidden bg-[color:var(--bg)]">
        {/* ── Collage background ── */}
        <div
          className="absolute inset-0 grid gap-[3px] bg-[color:var(--bg-soft)]"
          style={{
            gridTemplateColumns: '1.618fr 1fr 1fr 0.618fr',
            gridTemplateRows: '1fr 1.618fr 1fr',
            gridTemplateAreas: '"p1 p2 p3 p3" "p1 p4 p5 p7" "p6 p4 p5 p7"',
          }}
        >
          {PANELS.map((p) => (
            <div key={p.area} className="relative overflow-hidden" style={{ gridArea: p.area }}>
              <Image
                src={p.src}
                alt={p.alt}
                fill
                sizes="100vw"
                style={{ objectFit: 'cover', objectPosition: p.objectPosition }}
                priority={p.area === 'p1'}
              />
              <div className="absolute inset-0 bg-[color:var(--accent)]/[0.08] mix-blend-overlay pointer-events-none" />
            </div>
          ))}
        </div>

        {/* ── Vignette ── */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(115% 95% at 50% 46%, rgba(13,13,13,0) 0%, rgba(13,13,13,0.12) 38%, rgba(13,13,13,0.52) 72%, rgba(13,13,13,0.86) 100%), linear-gradient(to bottom, rgba(13,13,13,0.55) 0%, rgba(13,13,13,0) 24%, rgba(13,13,13,0) 62%, rgba(13,13,13,0.72) 100%)',
          }}
        />

        {/* ── Corner brandmark ── */}
        <div className="absolute top-6 left-6 sm:top-8 sm:left-8 z-10 font-[family-name:var(--font-barlow-semi)] text-sm font-bold uppercase tracking-[0.22em] text-white">
          Athlas<span className="text-[color:var(--accent)]">X</span>
        </div>

        {/* ── Account bar ── */}
        <div className="absolute top-6 right-6 sm:top-8 sm:right-8 z-10 flex items-center gap-2.5">
          <a
            href="/auth"
            className="font-[family-name:var(--font-barlow-semi)] text-sm font-bold uppercase tracking-wide px-5 py-2.5 rounded-lg border border-white/25 text-white hover:border-white/50 transition-colors"
          >
            Log In
          </a>
          <a
            href="/auth"
            className="font-[family-name:var(--font-barlow-semi)] text-sm font-bold uppercase tracking-wide px-5 py-2.5 rounded-lg bg-[color:var(--accent)] text-[#1a0e02] hover:bg-[color:var(--accent-bright)] transition-colors shadow-[0_8px_22px_-8px_rgba(255,138,30,0.7)]"
          >
            Sign In
          </a>
        </div>

        {/* ── Brand overlay ── */}
        <div className="relative z-10 flex flex-col items-center justify-center min-h-[100dvh] text-center px-6">
          <p className="font-[family-name:var(--font-barlow-semi)] text-[11px] sm:text-xs font-bold uppercase tracking-[0.35em] text-[color:var(--accent-bright)] mb-3">
            Grassroots to Global · District · State · Beyond
          </p>
          <h1 className="font-[family-name:var(--font-anton)] uppercase font-normal leading-[0.85] text-white text-[64px] sm:text-[110px] lg:text-[160px] [text-shadow:0_0.06em_0.5em_rgba(0,0,0,0.55)]">
            ATHLAS<span className="text-[color:var(--accent)]">X</span>
          </h1>
          <p className="font-[family-name:var(--font-barlow)] mt-4 text-base sm:text-2xl text-white">
            Every sport. Every talent. <b className="text-[color:var(--accent-bright)] font-bold">One platform.</b>
          </p>
          <div className="mt-7 h-0.5 w-40 sm:w-60" style={{ background: 'linear-gradient(90deg, transparent, var(--accent), transparent)' }} />
        </div>
      </div>

      {/* ── Feature grid — unchanged content, restyled to match the dark/orange palette ── */}
      <div className="bg-[color:var(--bg)] px-6 sm:px-10 py-16" style={HERO_VARS}>
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="p-5 text-left rounded-2xl border border-white/[0.08] bg-white/[0.03]">
              <h3 className="font-[family-name:var(--font-barlow-semi)] text-sm font-bold uppercase tracking-wide mb-2 text-[color:var(--accent-bright)]">{f.title}</h3>
              <p className="font-[family-name:var(--font-barlow)] text-xs text-white/60 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
        <p className="font-[family-name:var(--font-barlow)] mt-12 text-center text-xs text-white/40">
          AthlasX &mdash; Cricket talent intelligence for the association pathway.
        </p>
      </div>
    </div>
  )
}
