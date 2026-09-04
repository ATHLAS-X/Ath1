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
    <div className="min-h-screen flex flex-col">
      <header className="px-6 sm:px-10 py-6 flex items-center justify-between">
        <div className="text-lg font-black tracking-tight">
          Athlas<span className="text-gradient-green">X</span>
        </div>
        <a
          href="/api/auth/signin?callbackUrl=/dashboard"
          className="text-sm font-semibold px-4 py-2 rounded-lg border border-white/10 hover:border-[--ax-green] hover:text-[--ax-green] transition-colors"
        >
          Sign In
        </a>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center py-20">
        <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 mb-6">
          <span className="live-dot" />
          Built for the association pathway
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight max-w-3xl leading-[1.05]">
          Cricket talent intelligence,{' '}
          <span className="text-gradient-green">from first scorecard to selection</span>
        </h1>

        <p className="mt-6 text-base sm:text-lg text-zinc-400 max-w-xl">
          AthlasX turns historical association records into a verified, trackable player pathway
          &mdash; identity resolution, blind grading, and in-season tracking, built on match data
          that&apos;s actually confirmed, never self-reported.
        </p>

        <div className="mt-10 flex items-center gap-4">
          <a
            href="/api/auth/signin?callbackUrl=/dashboard"
            className="glow-green-sm text-sm font-bold px-6 py-3 rounded-xl bg-[--ax-green] text-black hover:brightness-110 transition"
          >
            Sign In to AthlasX
          </a>
        </div>
      </main>

      <section className="px-6 sm:px-10 pb-20">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map(f => (
            <div key={f.title} className="glass-card p-5 text-left">
              <h3 className="text-sm font-bold mb-2">{f.title}</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="px-6 sm:px-10 py-6 text-center text-xs text-zinc-600">
        AthlasX &mdash; Cricket talent intelligence for the association pathway.
      </footer>
    </div>
  )
}
