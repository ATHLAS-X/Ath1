"use client";

import Link from "next/link";
import { useState } from "react";
import "@/app/athlasx.css";

interface Props {
  backHref: string;
  role: string;
}

interface Phase { i: string; n: string; s: string; level?: string }
const PHASES: Phase[] = [
  { i: "P1", n: "Onboard",         s: "Sign up · Profile draft", level: "L1" },
  { i: "P2", n: "Verify Identity", s: "Aadhaar OTP · Consent",   level: "L2" },
  { i: "P3", n: "Capture Perf.",   s: "Stats · Videos · Fitness" },
  { i: "P4", n: "Match Verify",    s: "Scorecards · AthlasX review", level: "L3" },
  { i: "P5", n: "Discover",        s: "Scout search · Watchlist" },
  { i: "P6", n: "Endorse",         s: "Trial · Scout verify",       level: "L4" },
];

interface Role { id: string; n: string; t: string; col: string; ic: string }
const ROLES: Role[] = [
  { id: "player",  n: "Player",  t: "Primary actor",       col: "#2EE07B",
    ic: '<circle cx="7" cy="4.5" r="2.5"/><path d="M2.5 12C2.5 9.8 4.5 8.3 7 8.3C9.5 8.3 11.5 9.8 11.5 12"/>' },
  { id: "parent",  n: "Parent",  t: "Minor consent",       col: "#FBBF24",
    ic: '<path d="M7 2L11 5V11C11 11.5 10.5 12 10 12H4C3.5 12 3 11.5 3 11V5L7 2Z"/><circle cx="7" cy="7" r="1.5"/>' },
  { id: "coach",   n: "Coach",   t: "Performance review",  col: "#4D9FFF",
    ic: '<circle cx="7" cy="4.5" r="2"/><path d="M3 12C3 9.8 4.8 8 7 8C9.2 8 11 9.8 11 12"/><path d="M9.5 5.5L11.5 3.5"/>' },
  { id: "academy", n: "Academy", t: "Bulk imports",        col: "#A78BFA",
    ic: '<rect x="2" y="5" width="10" height="7" rx="1"/><path d="M5 5V3.5L7 2.5L9 3.5V5"/>' },
  { id: "scout",   n: "Scout",   t: "Discovery + endorse", col: "#22D3EE",
    ic: '<circle cx="6" cy="6" r="3.5"/><path d="M9 9L12.5 12.5"/>' },
  { id: "admin",   n: "Admin",   t: "Trust & safety",      col: "#F87171",
    ic: '<path d="M7 1.8L11.5 3.5V7.5C11.5 10 9.5 11.8 7 12.3C4.5 11.8 2.5 10 2.5 7.5V3.5L7 1.8Z"/>' },
];

interface Cell { text?: string; passive?: boolean }
type Matrix = Record<string, Cell[]>;
const MATRIX: Matrix = {
  player: [
    { text: "Create account · pick role · draft profile" },
    { text: "Enter Aadhaar · OTP · profile match check" },
    { text: "Add stats, videos, fitness scores" },
    { text: "Upload scorecards · request review" },
    { text: "Profile shown in scout search results" },
    { text: "Accept trial invite · attend match" },
  ],
  parent: [
    { passive: true },
    { text: "Sign minor consent · 4 checkbox gate" },
    { text: "Approve video uploads · view fitness" },
    { passive: true },
    { text: "Receive scout contact alerts" },
    { text: "Confirm trial attendance" },
  ],
  coach: [
    { passive: true },
    { passive: true },
    { text: "Verify fitness assessment · log behaviour" },
    { text: "Endorse academy scorecards" },
    { text: "Recommend players to scouts" },
    { passive: true },
  ],
  academy: [
    { text: "Bulk-import players · CSV upload" },
    { text: "Vouch identity for academy roster" },
    { text: "Run training camps · log results" },
    { text: "Submit batch scorecards" },
    { text: "Surface academy roster to scouts" },
    { passive: true },
  ],
  scout: [
    { passive: true },
    { passive: true },
    { passive: true },
    { passive: true },
    { text: "Filter · watchlist · compare players" },
    { text: "Send trial invite · endorse to L4" },
  ],
  admin: [
    { text: "Approve scout / academy accounts" },
    { text: "Review identity flags · dedupe Aadhaar" },
    { text: "Audit performance + fitness data" },
    { text: "Approve scorecards · ratchet L3" },
    { text: "Moderate consent + fraud signals" },
    { text: "Endorse trusted scouts" },
  ],
};

const OUTPUTS = [
  "Verified profile",
  "Identity badge L2",
  "Intelligence signals",
  "Performance badge L3",
  "Discovery match",
  "Trial / Scout badge L4",
];

const INTEL = [
  { w: "40", n: "Performance",  src: "Scorecards · MQI weights", col: "#2EE07B" },
  { w: "15", n: "Athletic",     src: "YoYo · Sprint · 2km",      col: "#4D9FFF" },
  { w: "15", n: "Verification", src: "Aadhaar · Coach · Scout",  col: "#A78BFA" },
  { w: "15", n: "Experience",   src: "Format mix · Tournaments", col: "#FBBF24" },
  { w: "10", n: "Behavioural",  src: "Coach evaluation",         col: "#EC4899" },
  { w: "5",  n: "Profile",      src: "Completion %",             col: "#22D3EE" },
];

export default function WorkflowClient({ backHref, role }: Props) {
  const [active, setActive] = useState<string | null>(null);
  const dim = (id: string) => active !== null && active !== id;

  return (
    <div className="sx-root arch-root">
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      <div className="arch-page">
        {/* Top bar */}
        <div className="arch-top">
          <div>
            <div className="sect-title">User Workflow</div>
            <div className="arch-h1">How AthlasX moves a player from sign-up to scout-verified</div>
          </div>
          <div className="arch-spacer" />
          <div className="arch-links">
            <a href="#intel">Intelligence</a>
            <a href="#eco">Ecosystem</a>
            <a href="#gov">Governance</a>
          </div>
          <div className="arch-div" />
          <Link href={backHref} className="btn green" style={{ textDecoration: "none" }}>
            ← Back to Dashboard
          </Link>
        </div>

        {/* Thesis equation */}
        <div className="arch-eq">
          <span className="eq-p">Verified Talent</span>
          <i>=</i>
          <span className="eq-p">Player Effort</span>
          <i>×</i>
          <span className="eq-p">Cross-checked Signals</span>
          <i>×</i>
          <span className="eq-p">Trust Network</span>
        </div>

        {/* Legend (role filter) */}
        <div className="arch-legend">
          <span className="legend-lbl">Filter by role:</span>
          {ROLES.map((r) => (
            <button key={r.id}
              className={`legend-chip${active === r.id ? " on" : ""}`}
              style={{ ["--rc" as any]: r.col }}
              onClick={() => setActive(active === r.id ? null : r.id)}>
              <span className="legend-dot" />{r.n}
            </button>
          ))}
          {active && (
            <button className="legend-clear" onClick={() => setActive(null)}>Clear</button>
          )}
        </div>

        {/* Matrix */}
        <div className="am-wrap">
          <div className="am-grid">
            <div className="am-corner">
              <div className="am-corner-t">Role × Phase</div>
              <div className="am-corner-s">→ verification ladder</div>
            </div>
            {PHASES.map((p) => (
              <div key={p.i} className="am-phase">
                <span className="am-phase-i">{p.i}</span>
                <span className="am-phase-n">{p.n}</span>
                <span className="am-phase-s">{p.s}</span>
                {p.level && <span className="am-phase-lvl">{p.level}</span>}
              </div>
            ))}

            {ROLES.map((r) => (
              <RoleRow key={r.id} role={r} cells={MATRIX[r.id]} dim={dim(r.id)} active={active === r.id}
                onSelect={() => setActive(active === r.id ? null : r.id)} />
            ))}
          </div>

          {/* Output rail */}
          <div className="arch-output-rail">
            <div className="rail-lbl">Output</div>
            {OUTPUTS.map((o, i) => (
              <div key={i} className="rail-cell">
                <div className="rail-out">{o}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Lower cards */}
        <div className="arch-lower">
          {/* Intelligence streams */}
          <div className="card arch-card" id="intel">
            <div className="arch-chead">
              <span className="sect-title">Intelligence Streams</span>
              <span className="bdg green">AthlasX Score</span>
            </div>
            <div className="cb">
              <p className="arch-note">
                Six weighted streams produce the AthlasX Score. Weights sum to
                100; each stream is sourced from a different verification path.
              </p>
              <div className="intel-list">
                {INTEL.map((it) => (
                  <div key={it.n} className="intel-row">
                    <div className="intel-w" style={{ color: it.col }}>
                      {it.w}<small>%</small>
                    </div>
                    <div className="intel-body">
                      <div className="intel-n">{it.n}</div>
                      <div className="intel-track">
                        <div className="intel-fill" style={{ width: `${(Number(it.w) / 40) * 100}%`, background: it.col, color: it.col }} />
                      </div>
                      <div className="intel-src">{it.src}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Ecosystem */}
          <div className="card arch-card" id="eco">
            <div className="arch-chead">
              <span className="sect-title">Ecosystem</span>
              <span className="bdg ghost">Producers · Platform · Consumers</span>
            </div>
            <div className="cb">
              <p className="arch-note">
                Producers feed verifiable signals to the platform; the
                platform stitches them into one score; consumers act on it.
              </p>
              <div className="eco-grid">
                <div className="eco-col">
                  <div className="eco-h" style={{ color: "var(--green)" }}>Producers</div>
                  <div className="eco-node green">Players</div>
                  <div className="eco-node green">Academies</div>
                  <div className="eco-node green">Coaches</div>
                </div>
                <div className="eco-arrow">→</div>
                <div className="eco-col">
                  <div className="eco-h" style={{ color: "var(--text)" }}>Platform</div>
                  <div className="eco-node mid">Identity</div>
                  <div className="eco-node mid">Performance</div>
                  <div className="eco-node mid">Trust</div>
                </div>
                <div className="eco-arrow">→</div>
                <div className="eco-col">
                  <div className="eco-h" style={{ color: "var(--blue)" }}>Consumers</div>
                  <div className="eco-node blue">Scouts</div>
                  <div className="eco-node blue">Selectors</div>
                  <div className="eco-node blue">Tournaments</div>
                </div>
              </div>
            </div>
          </div>

          {/* Governance */}
          <div className="card arch-card" id="gov">
            <div className="arch-chead">
              <span className="sect-title">Governance</span>
              <span className="bdg amber">Trust & Safety</span>
            </div>
            <div className="cb gov-cb">
              <div>
                <div className="sect-title" style={{ marginBottom: 8 }}>Data Owners</div>
                <div className="gov-own">
                  <span className="bdg green">Player</span>
                  <span className="gov-own-d">Profile · stats · videos</span>
                </div>
                <div className="gov-own">
                  <span className="bdg amber">Parent</span>
                  <span className="gov-own-d">Minor consent · contact</span>
                </div>
                <div className="gov-own">
                  <span className="bdg purple">Academy</span>
                  <span className="gov-own-d">Roster · scorecards</span>
                </div>
                <div className="gov-own">
                  <span className="bdg red">Admin</span>
                  <span className="gov-own-d">Verification · fraud flags</span>
                </div>
              </div>
              <div>
                <div className="sect-title" style={{ marginBottom: 8 }}>Trust Rules</div>
                <div className="gov-rule"><span className="gov-x">✓</span><span>One profile per Aadhaar — duplicates auto-blocked</span></div>
                <div className="gov-rule"><span className="gov-x">✓</span><span>Minors need 4-checkbox parent consent before scouts see them</span></div>
                <div className="gov-rule"><span className="gov-x">✓</span><span>Scorecards require source tournament + clear photo</span></div>
                <div className="gov-rule"><span className="gov-x">✓</span><span>Scout endorsements are signed and revocable</span></div>
                <div className="gov-rule"><span className="gov-x">✓</span><span>Behavioural data hidden from scouts by default</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer chain */}
        <div className="arch-foot">
          <span>Player lifecycle</span>
          <div className="chain">
            <span className="chain-node">Sign up</span>
            <span className="chain-arrow">→</span>
            <span className="chain-node">Aadhaar L2</span>
            <span className="chain-arrow">→</span>
            <span className="chain-node">Profile + stats</span>
            <span className="chain-arrow">→</span>
            <span className="chain-node">Scorecards L3</span>
            <span className="chain-arrow">→</span>
            <span className="chain-node">Discovered</span>
            <span className="chain-arrow">→</span>
            <span className="chain-node">Scout L4</span>
          </div>
        </div>

        {/* You are here */}
        <div style={{ marginTop: 22, textAlign: "center" }}>
          <span className="bdg ghost">You're signed in as · {role}</span>
        </div>
      </div>
    </div>
  );
}

function RoleRow({ role, cells, dim, active, onSelect }: {
  role: Role; cells: Cell[]; dim: boolean; active: boolean; onSelect: () => void;
}) {
  return (
    <>
      <button className={`am-role${active ? " on" : ""}${dim ? " dim" : ""}`}
        style={{ ["--rc" as any]: role.col }}
        onClick={onSelect}>
        <span className="am-role-ic">
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none"
            stroke={role.col} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"
            dangerouslySetInnerHTML={{ __html: role.ic }} />
        </span>
        <span className="am-role-n">{role.n}</span>
        <span className="am-role-t">{role.t}</span>
      </button>
      {cells.map((c, i) => (
        <div key={i}
          className={`am-cell${c.passive ? " passive" : ""}${dim ? " dim" : ""}`}
          style={{ ["--rc" as any]: role.col }}>
          {c.passive
            ? <span className="am-pass">No action</span>
            : <span className="am-chip">{c.text}</span>}
        </div>
      ))}
    </>
  );
}

const STYLES = `
.arch-root { min-height: 100vh; }
.arch-page { max-width: 1480px; margin: 0 auto; padding: 22px 22px 40px; }
.arch-top { display: flex; align-items: center; gap: 14px; padding-bottom: 18px; flex-wrap: wrap; }
.arch-div { width: 1px; height: 34px; background: var(--line2); }
.arch-h1 { font-family: var(--num); font-size: 24px; font-weight: 700; line-height: 1.1; margin-top: 4px; max-width: 640px; }
.arch-spacer { flex: 1; }
.arch-links { display: flex; gap: 7px; }
.arch-links a { font-family: var(--num); font-size: 11px; font-weight: 600; color: var(--lbl); text-decoration: none; padding: 6px 11px; border: 1px solid var(--line2); border-radius: 99px; background: var(--card-alt); transition: all 0.14s; }
.arch-links a:hover { color: var(--text); border-color: #333; }

.arch-eq { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; padding: 14px 16px; background: var(--card); border: 1px solid var(--line); border-radius: 12px; margin-bottom: 16px; }
.arch-eq .eq-p { font-family: var(--num); font-size: 14px; font-weight: 600; color: var(--text); }
.arch-eq i { font-family: var(--num); font-style: normal; font-size: 14px; color: var(--green); font-weight: 700; }

.arch-legend { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
.legend-lbl { font-size: 11.5px; color: var(--mut); margin-right: 2px; }
.legend-chip { display: inline-flex; align-items: center; gap: 7px; height: 28px; padding: 0 13px; border-radius: 99px; background: var(--card-alt); border: 1px solid var(--line2); color: var(--lbl); font-family: var(--num); font-size: 11.5px; font-weight: 600; cursor: pointer; transition: all 0.14s; }
.legend-chip .legend-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--rc); box-shadow: 0 0 7px var(--rc); }
.legend-chip:hover { color: var(--text); border-color: var(--rc); }
.legend-chip.on { color: var(--text); border-color: var(--rc); background: color-mix(in srgb, var(--rc) 13%, transparent); box-shadow: 0 0 16px -5px var(--rc); }
.legend-clear { background: none; border: none; color: var(--mut); font-size: 11px; cursor: pointer; text-decoration: underline; font-family: var(--num); }

.am-wrap { position: relative; }
.am-grid { display: grid; grid-template-columns: 150px repeat(6, 1fr); gap: 9px; position: relative; }
.am-corner { display: flex; flex-direction: column; justify-content: flex-end; padding: 0 4px 8px; }
.am-corner-t { font-family: var(--num); font-size: 12px; font-weight: 700; color: var(--text); }
.am-corner-s { font-size: 9.5px; color: var(--lbl2); text-transform: uppercase; letter-spacing: 1.2px; }

.am-phase { position: relative; padding: 9px 11px; border-radius: 10px 10px 0 0; background: linear-gradient(180deg, var(--head), var(--card-alt)); border: 1px solid var(--line); border-bottom: none; }
.am-phase-i { font-family: var(--num); font-size: 9.5px; font-weight: 700; color: var(--lbl2); }
.am-phase-n { display: block; font-family: var(--num); font-size: 13px; font-weight: 600; color: var(--text); margin-top: 1px; }
.am-phase-s { display: block; font-size: 9.5px; color: var(--mut); margin-top: 1px; }
.am-phase-lvl { position: absolute; top: 9px; right: 10px; font-family: var(--num); font-size: 9px; font-weight: 700; color: var(--green); background: var(--green-bg); border: 1px solid var(--green-bd); padding: 1px 6px; border-radius: 99px; }

.am-role { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; text-align: left; padding: 12px 11px; border-radius: 10px; cursor: pointer; background: linear-gradient(150deg, color-mix(in srgb, var(--rc) 12%, var(--card)), var(--card)); border: 1px solid color-mix(in srgb, var(--rc) 26%, transparent); border-left: 3px solid var(--rc); transition: all 0.16s; }
.am-role:hover { transform: translateX(1px); box-shadow: 0 0 18px -8px var(--rc); }
.am-role.on { box-shadow: 0 0 22px -6px var(--rc); border-color: var(--rc); }
.am-role.dim { opacity: 0.4; }
.am-role-ic { margin-bottom: 5px; }
.am-role-n { font-family: var(--num); font-size: 13.5px; font-weight: 700; color: var(--text); }
.am-role-t { font-size: 9.5px; color: var(--mut); }

.am-cell { display: flex; flex-direction: column; gap: 5px; padding: 10px; background: var(--card); border: 1px solid var(--line); border-radius: 10px; transition: opacity 0.16s; }
.am-cell.dim { opacity: 0.32; }
.am-chip { font-size: 11px; line-height: 1.34; color: var(--text); padding: 6px 8px; background: color-mix(in srgb, var(--rc) 9%, var(--card-alt)); border: 1px solid color-mix(in srgb, var(--rc) 20%, transparent); border-radius: 7px; }
.am-cell.passive { background: repeating-linear-gradient(135deg, transparent, transparent 6px, rgba(255,255,255,0.012) 6px, rgba(255,255,255,0.012) 12px), var(--card-alt); border-style: dashed; align-items: center; justify-content: center; }
.am-pass { font-size: 9.5px; color: var(--lbl2); text-transform: uppercase; letter-spacing: 0.8px; text-align: center; }

.arch-output-rail { display: grid; grid-template-columns: 150px repeat(6, 1fr); gap: 9px; margin-top: 9px; }
.rail-lbl { font-family: var(--num); font-size: 9.5px; font-weight: 600; color: var(--lbl2); text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; padding: 0 4px; }
.rail-cell { padding: 9px 10px; border-radius: 0 0 10px 10px; background: linear-gradient(180deg, var(--green-bg), transparent); border: 1px solid var(--green-bd); border-top: 2px solid var(--green); }
.rail-out { font-size: 10.5px; font-weight: 600; color: var(--green); line-height: 1.3; }

.arch-lower { display: grid; grid-template-columns: 1fr 1.25fr; gap: 14px; margin-top: 22px; align-items: start; }
.arch-lower > .arch-card:nth-child(2) { grid-row: span 2; }
.arch-card { overflow: hidden; padding: 0; }
.arch-chead { display: flex; align-items: center; justify-content: space-between; padding: 13px 15px 0; gap: 10px; }
.arch-card .cb { padding: 12px 15px 15px; }
.arch-note { font-size: 12px; color: var(--mut); line-height: 1.5; margin-bottom: 13px; }

.intel-list { display: flex; flex-direction: column; gap: 11px; }
.intel-row { display: flex; align-items: center; gap: 12px; }
.intel-w { font-family: var(--num); font-size: 24px; font-weight: 700; width: 50px; flex-shrink: 0; text-align: right; }
.intel-w small { font-size: 12px; opacity: 0.6; }
.intel-body { flex: 1; min-width: 0; }
.intel-n { font-size: 12.5px; font-weight: 600; }
.intel-track { height: 6px; background: var(--card-alt); border: 1px solid var(--line); border-radius: 99px; margin: 5px 0 4px; overflow: hidden; }
.intel-fill { height: 100%; border-radius: 99px; box-shadow: 0 0 8px -1px currentColor; }
.intel-src { font-size: 10.5px; color: var(--mut); }

.eco-grid { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr; gap: 8px; align-items: stretch; }
.eco-col { display: flex; flex-direction: column; gap: 6px; }
.eco-h { font-family: var(--num); font-size: 10px; font-weight: 600; letter-spacing: 1.4px; text-transform: uppercase; margin-bottom: 3px; }
.eco-node { font-size: 11px; font-weight: 500; padding: 8px 10px; border-radius: 8px; background: var(--card-alt); border: 1px solid var(--line2); }
.eco-node.green { border-left: 2px solid var(--green); }
.eco-node.blue { border-left: 2px solid var(--blue); }
.eco-node.mid { background: linear-gradient(150deg, rgba(34,197,94,0.06), rgba(59,130,246,0.06)); border-color: var(--line2); text-align: center; font-weight: 600; }
.eco-arrow { display: flex; align-items: center; color: var(--lbl); font-size: 18px; padding: 0 2px; }

.gov-cb { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.gov-own { display: flex; align-items: center; gap: 9px; padding: 7px 0; }
.gov-own + .gov-own { border-top: 1px solid var(--line); }
.gov-own-d { font-size: 11px; color: var(--mut); }
.gov-rule { display: flex; gap: 8px; font-size: 11.5px; color: var(--mut); line-height: 1.4; padding: 6px 0; }
.gov-rule + .gov-rule { border-top: 1px solid var(--line); }
.gov-x { color: var(--green); font-weight: 700; flex-shrink: 0; }

.arch-foot { margin-top: 22px; padding: 15px 16px; background: var(--card); border: 1px solid var(--line); border-radius: 12px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.arch-foot > span:first-child { font-family: var(--num); font-size: 10px; font-weight: 600; letter-spacing: 1.4px; text-transform: uppercase; color: var(--lbl2); flex-shrink: 0; }
.chain { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.chain-node { font-family: var(--num); font-size: 11px; font-weight: 600; color: var(--text); padding: 6px 12px; border-radius: 99px; background: var(--card-alt); border: 1px solid var(--line2); }
.chain-arrow { color: var(--green); font-size: 14px; font-weight: 700; }

@media (max-width: 1180px) {
  .am-grid, .arch-output-rail { grid-template-columns: 120px repeat(6, minmax(130px, 1fr)); overflow-x: auto; }
  .arch-lower { grid-template-columns: 1fr; }
  .arch-lower > .arch-card:nth-child(2) { grid-row: auto; }
  .gov-cb { grid-template-columns: 1fr; }
}
`;
