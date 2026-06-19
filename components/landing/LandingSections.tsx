"use client";

import Link from "next/link";
import "@/app/athlasx.css";

/* Marketing flow rendered below the hero. Sticks to the AthlasX design system
   (athlasx.css tokens) so it matches the rest of the app. Mirrors the
   /workflow page at a glance and ends with a per-role signup CTA. */

const PHASES = [
  { i: "1", n: "Onboard",       d: "Sign up, claim your role, draft your profile.",      lvl: "L1" },
  { i: "2", n: "Verify Identity", d: "Aadhaar OTP with parent consent for minors.",     lvl: "L2" },
  { i: "3", n: "Capture Performance", d: "Stats, fitness scores, match videos, coach reviews." },
  { i: "4", n: "Match Verify",  d: "AthlasX-reviewed scorecards from official tournaments.", lvl: "L3" },
  { i: "5", n: "Discover",      d: "Verified scouts surface you in role-scoped search.", },
  { i: "6", n: "Endorse",       d: "Trial invites and scout endorsement unlock the highest tier.", lvl: "L4" },
];

const LEVELS = [
  { n: "L1 · Self Registered",   d: "Profile created",                            col: "#6A746C" },
  { n: "L2 · Identity Verified", d: "Aadhaar checked, name & DOB match profile",  col: "#4D9FFF" },
  { n: "L3 · Performance Verified", d: "Three scorecards approved by AthlasX",     col: "#2EE07B" },
  { n: "L4 · Scout Verified",    d: "Endorsed by a verified scout at trial / match", col: "#EAB308" },
];

const ROLES = [
  { n: "Player",    d: "Build a verified profile, log performance, get scouted.", href: "/auth/signup?role=player",            col: "#2EE07B" },
  { n: "Parent",    d: "Approve consent for minor players and track their journey.", href: "/auth/signup?role=parent",         col: "#FBBF24" },
  { n: "Coach",     d: "Log fitness, behaviour, and endorse academy scorecards.",   href: "/auth/signup?role=coach",           col: "#4D9FFF" },
  { n: "Academy",   d: "Bulk-import players and surface your roster to scouts.",    href: "/auth/signup?role=academy_admin",   col: "#A78BFA" },
  { n: "Scout",     d: "Filter, watch and endorse verified talent across India.",   href: "/auth/signup?role=scout",           col: "#22D3EE" },
  { n: "Tournament", d: "Run age-group events with verified rosters and results.",  href: "/auth/signup?role=tournament_organizer", col: "#EC4899" },
];

const STATS = [
  { v: "4-tier", l: "Verification Ladder" },
  { v: "6", l: "Workflow Phases" },
  { v: "100%", l: "Aadhaar + Consent" },
  { v: "Pan-India", l: "Talent Coverage" },
];

export default function LandingSections() {
  return (
    <div className="sx-root ls-root">
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      {/* ── Workflow strip ─────────────────────────────────────────── */}
      <section className="ls-section">
        <div className="ls-shell">
          <div className="ls-eyebrow">How AthlasX Works</div>
          <h2 className="ls-h2">A six-phase pathway from sign-up to scout-verified.</h2>
          <p className="ls-sub">
            Every signal a scout sees has been verified by a different part of the network.
            That&apos;s what makes the score trustworthy.
          </p>

          <div className="ls-phase-grid">
            {PHASES.map((p) => (
              <div key={p.i} className="ls-phase-card card">
                <div className="ls-phase-head">
                  <span className="ls-phase-i">Phase {p.i}</span>
                  {p.lvl && <span className="bdg green" style={{ height: 18, fontSize: 9 }}>{p.lvl}</span>}
                </div>
                <div className="ls-phase-n">{p.n}</div>
                <div className="ls-phase-d">{p.d}</div>
              </div>
            ))}
          </div>

          <div className="ls-cta-row">
            <Link href="/workflow" className="btn">View full workflow →</Link>
          </div>
        </div>
      </section>

      {/* ── Trust ladder ───────────────────────────────────────────── */}
      <section className="ls-section ls-section--tint">
        <div className="ls-shell">
          <div className="ls-eyebrow">Trust Ladder</div>
          <h2 className="ls-h2">Four levels. Each one earned, not claimed.</h2>
          <p className="ls-sub">
            Verified profiles get up to <strong style={{ color: "var(--green)" }}>6× more scout views</strong>.
            Move up the ladder by adding evidence — not by adding self-reported claims.
          </p>

          <div className="ls-ladder">
            {LEVELS.map((l, i) => (
              <div key={l.n} className="ls-rung card" style={{ borderLeft: `4px solid ${l.col}` }}>
                <div className="ls-rung-num" style={{ color: l.col, borderColor: l.col }}>{i + 1}</div>
                <div>
                  <div className="ls-rung-n">{l.n}</div>
                  <div className="ls-rung-d">{l.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Role gallery ───────────────────────────────────────────── */}
      <section className="ls-section">
        <div className="ls-shell">
          <div className="ls-eyebrow">Built for everyone in cricket</div>
          <h2 className="ls-h2">Pick the role that fits — every dashboard is purpose-built.</h2>

          <div className="ls-role-grid">
            {ROLES.map((r) => (
              <Link key={r.n} href={r.href} className="ls-role card" style={{ ["--rc" as any]: r.col }}>
                <div className="ls-role-head">
                  <div className="ls-role-dot" style={{ background: r.col, boxShadow: `0 0 12px ${r.col}` }} />
                  <div className="ls-role-n">{r.n}</div>
                </div>
                <div className="ls-role-d">{r.d}</div>
                <div className="ls-role-cta">Start as {r.n} →</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Proof strip ────────────────────────────────────────────── */}
      <section className="ls-section ls-section--tint">
        <div className="ls-shell">
          <div className="ls-stats">
            {STATS.map((s) => (
              <div key={s.l} className="ls-stat">
                <div className="ls-stat-v">{s.v}</div>
                <div className="ls-stat-l">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────── */}
      <section className="ls-section">
        <div className="ls-shell ls-shell--center">
          <div className="ls-eyebrow">Ready when you are</div>
          <h2 className="ls-h2">Your verified cricket profile is one signup away.</h2>
          <p className="ls-sub" style={{ marginBottom: 24 }}>
            Free to start. No payment, no commitments — just verifiable evidence
            of your game.
          </p>
          <div className="ls-final-cta">
            <Link href="/auth/signup?role=player" className="btn green" style={{ minWidth: 180, justifyContent: "center" }}>
              Sign up as Player
            </Link>
            <Link href="/auth/signup?role=scout" className="btn" style={{ minWidth: 180, justifyContent: "center" }}>
              I&apos;m a Scout
            </Link>
            <Link href="/auth/login" className="btn" style={{ minWidth: 140, justifyContent: "center" }}>
              I have an account
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="ls-foot">
        <div className="ls-shell ls-foot-inner">
          <div className="ls-foot-brand">
            <strong>AthlasX</strong>
            <span>India&apos;s Cricket Talent Discovery Platform</span>
          </div>
          <div className="ls-foot-links">
            <Link href="/workflow">How it works</Link>
            <Link href="/auth/login">Login</Link>
            <Link href="/auth/signup?role=player">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

const STYLES = `
.ls-root { background: #0A0A0A; color: var(--text); font-family: 'Instrument Sans', system-ui, sans-serif; }
.ls-section { padding: 72px 24px; position: relative; }
.ls-section--tint { background: linear-gradient(180deg, rgba(46,224,123,0.03), transparent), #080B09; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.ls-shell { max-width: 1180px; margin: 0 auto; }
.ls-shell--center { text-align: center; }

.ls-eyebrow { font-family: var(--num); font-size: 11px; font-weight: 600; letter-spacing: 2.5px; text-transform: uppercase; color: var(--green); margin-bottom: 12px; }
.ls-h2 { font-family: var(--num); font-size: clamp(28px, 4vw, 40px); font-weight: 700; line-height: 1.15; letter-spacing: -0.01em; margin-bottom: 14px; max-width: 720px; }
.ls-shell--center .ls-h2 { margin-left: auto; margin-right: auto; }
.ls-sub { font-size: 15px; color: var(--mut); line-height: 1.65; max-width: 640px; margin-bottom: 36px; }
.ls-shell--center .ls-sub { margin-left: auto; margin-right: auto; }

.ls-cta-row { margin-top: 28px; }

/* Phases */
.ls-phase-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.ls-phase-card { padding: 18px 20px; transition: transform 0.18s, border-color 0.18s, box-shadow 0.18s; }
.ls-phase-card:hover { transform: translateY(-3px); border-color: var(--green-bd); box-shadow: 0 10px 30px -16px var(--green-glow); }
.ls-phase-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.ls-phase-i { font-family: var(--num); font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--lbl2); }
.ls-phase-n { font-family: var(--num); font-size: 18px; font-weight: 700; margin-bottom: 6px; }
.ls-phase-d { font-size: 13px; color: var(--mut); line-height: 1.55; }

/* Ladder */
.ls-ladder { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
.ls-rung { display: flex; align-items: center; gap: 16px; padding: 18px 20px; }
.ls-rung-num { width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; font-family: var(--num); font-size: 18px; font-weight: 700; border: 2px solid; flex-shrink: 0; background: rgba(0,0,0,0.4); }
.ls-rung-n { font-family: var(--num); font-size: 15px; font-weight: 700; }
.ls-rung-d { font-size: 12.5px; color: var(--mut); margin-top: 3px; line-height: 1.5; }

/* Roles */
.ls-role-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.ls-role { padding: 22px; text-decoration: none; color: inherit; transition: all 0.18s; border-top: 3px solid var(--rc); display: block; }
.ls-role:hover { transform: translateY(-3px); border-color: var(--rc); box-shadow: 0 14px 40px -18px var(--rc); }
.ls-role-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.ls-role-dot { width: 10px; height: 10px; border-radius: 50%; }
.ls-role-n { font-family: var(--num); font-size: 19px; font-weight: 700; }
.ls-role-d { font-size: 13px; color: var(--mut); line-height: 1.55; min-height: 60px; }
.ls-role-cta { margin-top: 14px; font-family: var(--num); font-size: 12px; font-weight: 600; color: var(--rc); letter-spacing: 0.02em; }

/* Stats */
.ls-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; text-align: center; }
.ls-stat-v { font-family: var(--num); font-size: clamp(28px, 3.5vw, 38px); font-weight: 700; color: var(--green); text-shadow: 0 0 18px var(--green-glow); }
.ls-stat-l { font-size: 11px; color: var(--lbl); margin-top: 6px; letter-spacing: 1.2px; text-transform: uppercase; font-family: var(--num); font-weight: 600; }

/* Final CTA */
.ls-final-cta { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }

/* Footer */
.ls-foot { padding: 28px 24px; background: #060807; border-top: 1px solid var(--line); }
.ls-foot-inner { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.ls-foot-brand { display: flex; align-items: center; gap: 12px; font-size: 12px; color: var(--mut); }
.ls-foot-brand strong { font-family: var(--num); color: var(--text); font-size: 14px; font-weight: 700; }
.ls-foot-links { display: flex; gap: 16px; }
.ls-foot-links a { font-size: 12px; color: var(--lbl); text-decoration: none; transition: color 0.15s; }
.ls-foot-links a:hover { color: var(--text); }

@media (max-width: 900px) {
  .ls-section { padding: 56px 18px; }
  .ls-phase-grid, .ls-role-grid { grid-template-columns: 1fr; }
  .ls-ladder { grid-template-columns: 1fr; }
  .ls-stats { grid-template-columns: repeat(2, 1fr); }
}
`;
