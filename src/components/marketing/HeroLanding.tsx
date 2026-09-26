import Image from 'next/image'
import { Anton, Barlow, Barlow_Semi_Condensed } from 'next/font/google'
import { ButtonLink } from '@/components/ui/button'

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
  { area: 'p1', src: '/images/hero/attached-f1-redbull-night.jpg', alt: 'Formula 1 driver in Red Bull racing suit standing on his car celebrating under floodlights and fireworks', objectPosition: '50% 30%' },
  { area: 'p2', src: '/images/hero/attached-badminton-smash.webp', alt: 'Badminton player leaping mid-air for an overhead smash on a tournament court', objectPosition: '50% 25%' },
  { area: 'p3', src: '/images/hero/attached-cricket-kohli-rohit.webp', alt: 'Two Indian cricketers embracing in celebration, arms around each other on the field', objectPosition: '50% 25%' },
  { area: 'p4', src: '/images/hero/attached-basketball-poster.jpg', alt: 'Basketball players contesting a shot at the rim in a packed arena', objectPosition: '50% 35%' },
  { area: 'p5', src: '/images/hero/attached-cricket-virat-bw.png', alt: 'Black-and-white photo of a cricketer in national kit, number 18, raising his bat in acknowledgement', objectPosition: '50% 35%' },
  { area: 'p6', src: '/images/hero/attached-volleyball-spike.jpg', alt: 'Volleyball player leaping high to spike the ball under stadium lights', objectPosition: '50% 30%' },
  { area: 'p7', src: '/images/hero/attached-soccer-boots-bw.webp', alt: 'Black-and-white close-up of a soccer player’s boots and gloved hands resting on the ball at kickoff', objectPosition: '50% 40%' },
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
          <ButtonLink
            href="/auth"
            variant="outline"
            className="font-[family-name:var(--font-barlow-semi)] text-sm font-bold tracking-wide rounded-lg border-white/25 text-white hover:border-white/50 hover:bg-transparent"
          >
            Sign In
          </ButtonLink>
          <ButtonLink
            href="/auth?mode=signup"
            variant="primary"
            className="font-[family-name:var(--font-barlow-semi)] text-sm font-bold tracking-wide rounded-lg bg-[color:var(--accent)] border-[color:var(--accent)] hover:bg-[color:var(--accent-bright)] hover:border-[color:var(--accent-bright)]"
          >
            Signup
          </ButtonLink>
        </div>

        {/* ── Brand overlay ── */}
        {/* pointer-events-none: this full-viewport flex box has no
            interactive content of its own, but sits after the account bar
            in DOM order with the same z-10 — without this it intercepts
            clicks across the whole screen, including Log In/Sign In. */}
        <div className="relative z-10 flex flex-col items-center justify-center min-h-[100dvh] text-center px-6 pointer-events-none">
          <h1
            className="font-[family-name:var(--font-anton)] uppercase font-normal leading-[0.85] text-white text-[88px] sm:text-[150px] lg:text-[220px]"
            style={{
              textShadow:
                '0 0.03em 0 rgba(0,0,0,0.9), 0 0.06em 0 rgba(0,0,0,0.85), 0 0.1em 0.14em rgba(0,0,0,0.75), 0 0.25em 0.6em rgba(0,0,0,0.7)',
            }}
          >
            ATHLAS<span className="text-[color:var(--accent)]">X</span>
          </h1>
        </div>
      </div>

    </div>
  )
}
