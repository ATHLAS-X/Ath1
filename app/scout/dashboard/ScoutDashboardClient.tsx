"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useCallback } from "react";
import { initials, Ring, Vlvl } from "@/components/sx/widgets";
import { AVA_COLORS, roleColor } from "@/lib/score-utils";
import SportXLogo from "@/components/SportXLogo";
import "@/app/sportx.css";

const NAV = [
  {
    n: "Dashboard", href: "/scout/dashboard",
    ic: '<rect x="1.5" y="1.5" width="4.5" height="4.5" rx="1"/><rect x="8" y="1.5" width="4.5" height="4.5" rx="1"/><rect x="1.5" y="8" width="4.5" height="4.5" rx="1"/><rect x="8" y="8" width="4.5" height="4.5" rx="1"/>',
  },
  { n: "Search Players", href: "/scout/search", ic: '<circle cx="6" cy="6" r="4"/><path d="M9 9L12.5 12.5"/>' },
  { n: "Watchlist", href: "/scout/watchlist", badgeKey: "shortlist",
    ic: '<path d="M7 1.8L8.6 5.1L12.2 5.6L9.6 8.1L10.2 11.7L7 10L3.8 11.7L4.4 8.1L1.8 5.6L5.4 5.1L7 1.8Z"/>' },
  { n: "My Notes", href: "/scout/notes",
    ic: '<rect x="2.5" y="1.5" width="9" height="11" rx="1.5"/><path d="M4.8 5H9.2M4.8 7.5H9.2M4.8 10H7.5"/>' },
  { n: "Workflow", href: "/workflow",
    ic: '<rect x="1.5" y="3.5" width="3" height="3" rx="0.5"/><rect x="9.5" y="3.5" width="3" height="3" rx="0.5"/><rect x="1.5" y="9" width="3" height="3" rx="0.5"/><rect x="9.5" y="9" width="3" height="3" rx="0.5"/><path d="M4.5 5H9.5M4.5 10.5H9.5"/>' },
  { n: "Settings", href: "/scout/settings",
    ic: '<circle cx="7" cy="7" r="2"/><path d="M7 1.5V3M7 11V12.5M12.5 7H11M3 7H1.5M10.9 3.1L9.8 4.2M4.2 9.8L3.1 10.9M10.9 10.9L9.8 9.8M4.2 4.2L3.1 3.1"/>' },
];

const INDIAN_STATES = [
  "All States","Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh",
  "Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala",
  "Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha",
  "Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh",
  "Uttarakhand","West Bengal",
];

function StarIcon({ on }: { on: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill={on ? "#2EE07B" : "none"}
      stroke={on ? "#2EE07B" : "#6A746C"} strokeWidth="1.2" strokeLinejoin="round">
      <path d="M7 1.8L8.6 5.1L12.2 5.6L9.6 8.1L10.2 11.7L7 10L3.8 11.7L4.4 8.1L1.8 5.6L5.4 5.1L7 1.8Z" />
    </svg>
  );
}

interface Props {
  session: any;
  featuredPlayer: any;
  players: any[];
  shortlistIds: string[];
  recentNotes: any[];
  watchlist: { shortlist: number; notes: number; invites: number; accepted: number };
}

export default function ScoutDashboardClient({ session, featuredPlayer, players, shortlistIds, recentNotes, watchlist }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const user = session?.user;
  const userInitials = initials(user?.name ?? "SC");

  const [saved, setSaved] = useState<Set<string>>(new Set(shortlistIds));
  const [search, setSearch] = useState("");
  const [activeRole, setActiveRole] = useState("All");
  const [ageMax, setAgeMax] = useState(23);
  const [selectedState, setSelectedState] = useState("All States");
  const [bowlStyle, setBowlStyle] = useState("Any");
  const [academy, setAcademy] = useState("");
  const [minRuns, setMinRuns] = useState(200);
  const [minWkts, setMinWkts] = useState(20);
  const [minYoyo, setMinYoyo] = useState(14);
  const [minDisc, setMinDisc] = useState(6);
  const [minCoach, setMinCoach] = useState(6);
  const [minLevel, setMinLevel] = useState("Any");
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(["Demographics", "Cricket"]));

  const toggleGroup = (g: string) =>
    setOpenGroups((s) => {
      const n = new Set(s);
      n.has(g) ? n.delete(g) : n.add(g);
      return n;
    });

  const toggleSave = useCallback(async (playerId: string) => {
    const isOn = saved.has(playerId);
    setSaved((s) => {
      const n = new Set(s);
      isOn ? n.delete(playerId) : n.add(playerId);
      return n;
    });
    await fetch("/api/scout/shortlist", {
      method: isOn ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_user_id: playerId }),
    }).catch(() => {});
  }, [saved]);

  const handleSearch = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (activeRole !== "All") params.set("role", activeRole);
    if (selectedState !== "All States") params.set("state", selectedState);
    if (bowlStyle !== "Any") params.set("bowling", bowlStyle);
    if (academy) params.set("academy", academy);
    params.set("maxAge", String(ageMax));
    params.set("minRuns", String(minRuns));
    params.set("minWickets", String(minWkts));
    if (minLevel !== "Any") params.set("minLevel", minLevel);
    router.push(`/scout/search?${params.toString()}`);
  }, [search, activeRole, selectedState, bowlStyle, academy, ageMax, minRuns, minWkts, minLevel, router]);

  const fp = featuredPlayer;
  const fpStats = [
    { v: String(fp?.runs_scored ?? "—"), l: "Runs" },
    { v: String(fp?.wickets ?? "—"), l: "Wickets" },
    { v: String(fp?.matches_played ?? "—"), l: "Matches" },
    { v: fp?.bpi ? Number(fp.bpi).toFixed(1) : "—", l: "BPI" },
    { v: fp?.economy ? Number(fp.economy).toFixed(1) : "—", l: "Economy" },
  ];

  const WL = [
    { c: watchlist.shortlist, n: "Shortlist", col: "#2EE07B" },
    { c: watchlist.notes, n: "Notes", col: "#4D9FFF" },
    { c: watchlist.invites, n: "Invites Sent", col: "#FBBF24" },
    { c: watchlist.accepted, n: "Accepted", col: "#A78BFA" },
  ];

  return (
    <div className="sx-root">
      <style dangerouslySetInnerHTML={{ __html: styles }} />

      <div className="shell">

        {/* ════ SIDEBAR ════ */}
        <aside className="sidebar">
          <div className="logo-row">
            <SportXLogo />
          </div>

          <nav className="nav">
            {NAV.map((item) => {
              const active = pathname === item.href;
              const badge = item.badgeKey ? (watchlist as any)[item.badgeKey] : 0;
              return (
                <Link key={item.n} href={item.href}
                  className={`nav-item${active ? " active" : ""}`}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                    stroke={active ? "#2EE07B" : "#6A746C"}
                    strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"
                    dangerouslySetInnerHTML={{ __html: item.ic }} />
                  {item.n}
                  {badge > 0 && <span className="nav-count">{badge}</span>}
                </Link>
              );
            })}
          </nav>

          <div className="card scout-card">
            <div className="scout-ava">{userInitials}</div>
            <div style={{ minWidth: 0 }}>
              <div className="scout-name">{user?.name ?? "Scout"}</div>
              <span className="bdg green" style={{ marginTop: 3 }}>Verified Scout</span>
            </div>
          </div>
        </aside>

        {/* ════ CENTRE ════ */}
        <div className="colstack">

          {/* Featured player */}
          <div className="card hero">
            <div className="hero-main">
              <div className="hero-left">
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                  <span className="sect-title">Featured Player</span>
                  <span className="bdg" style={{ background: "rgba(34,211,238,0.1)", border: "1px solid rgba(34,211,238,0.3)", color: "#22D3EE" }}>Workflow P5 · Discover</span>
                  <span className="bdg" style={{ background: "rgba(34,211,238,0.1)", border: "1px solid rgba(34,211,238,0.3)", color: "#22D3EE" }}>P6 · Endorse</span>
                  <Link href="/workflow" className="bdg ghost" style={{ textDecoration: "none" }}>How it fits →</Link>
                </div>
                {fp ? (
                  <>
                    <div className="hero-name-row">
                      <span className="hero-name">{fp.name}</span>
                      <span className="bdg solid-green">{fp.playing_role}</span>
                    </div>
                    <div className="hero-academy">
                      {[fp.academy_name_custom, fp.city, fp.state].filter(Boolean).join(" · ")}
                      {fp.age ? ` · Age ${fp.age}` : ""}
                    </div>
                    <div className="hero-trust">
                      <div className="blk">
                        <div className="k">Verification</div>
                        <Vlvl level={fp.verification_level ?? 1} />
                      </div>
                      <div className="blk">
                        <div className="k">Profile Completion</div>
                        <Ring pct={fp.profile_pct ?? 0} size={46} stroke={4.5} />
                      </div>
                      <div className="blk" style={{ alignSelf: "flex-end" }}>
                        <span className="v2-chip">✦ Intelligence Score — V2</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ color: "var(--mut)", marginTop: 8 }}>No featured player yet</div>
                )}
              </div>
              <div className="hero-photo">
                <div className="pedestal" />
                {fp && (
                  <div className="hero-ava">{initials(fp.name)}</div>
                )}
              </div>
            </div>
            {fp && (
              <div className="hero-strip">
                {fpStats.map((s) => (
                  <div key={s.l} className="hs-cell">
                    <div className="v">{s.v}</div>
                    <div className="l">{s.l}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Player table */}
          <div className="card" style={{ overflow: "hidden" }}>
            <div className="chead2" style={{ paddingBottom: 11 }}>
              <span className="sect-title">Discovered Players</span>
              <span className="bdg ghost">{players.length} shown · Scout Visible only</span>
            </div>
            <table className="ptable">
              <thead>
                <tr>
                  <th style={{ width: "27%" }}>Player</th>
                  <th>Role</th>
                  <th>Age</th>
                  <th>State</th>
                  <th>Verification</th>
                  <th>Profile</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {players.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", color: "var(--mut)", padding: "24px 12px" }}>
                      No players found
                    </td>
                  </tr>
                ) : players.map((p: any, i: number) => {
                  const isOn = saved.has(String(p.user_id));
                  return (
                    <tr key={p.user_id}>
                      <td>
                        <div className="pcell">
                          <span className="ava" style={{
                            background: `radial-gradient(circle at 32% 28%, ${AVA_COLORS[i % AVA_COLORS.length]}, rgba(0,0,0,0.55))`,
                            color: "#fff",
                          }}>
                            {initials(p.name)}
                          </span>
                          <span>
                            <span className="nm">{p.name}</span><br />
                            <span className="ds">{[p.city, p.academy_name_custom || "Independent"].filter(Boolean).join(" · ")}</span>
                          </span>
                        </div>
                      </td>
                      <td><span className={`bdg ${roleColor(p.playing_role)}`}>{p.playing_role}</span></td>
                      <td style={{ fontFamily: "var(--num)", fontWeight: 600 }}>{p.age ?? "—"}</td>
                      <td style={{ color: "#8B958D" }}>{p.state || "—"}</td>
                      <td><Vlvl level={p.verification_level ?? 1} compact /></td>
                      <td><Ring pct={p.profile_pct ?? 0} size={30} stroke={3} /></td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button className={`wl-btn${isOn ? " saved" : ""}`}
                          title={isOn ? "On watchlist" : "Save to watchlist"}
                          onClick={() => toggleSave(String(p.user_id))}>
                          <StarIcon on={isOn} />
                        </button>{" "}
                        <Link href={`/profile/${p.user_id}`} className="btn sm" style={{ textDecoration: "none" }}>
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ════ RIGHT ════ */}
        <div className="colstack">

          {/* Search & filters */}
          <div className="card">
            <div className="chead2">
              <span className="sect-title">Search Players</span>
              <span className="bdg green">7 filter groups</span>
            </div>
            <div className="cb">
              <input className="sinput" type="text" placeholder="Search name, city, academy…"
                value={search} onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()} />
              <div style={{ marginTop: 10 }}>

                <FGroup n="Demographics" open={openGroups.has("Demographics")} onToggle={toggleGroup}>
                  <div className="f-label">Age Range <span className="fv">14 – {ageMax}</span></div>
                  <input type="range" min={12} max={30} value={ageMax}
                    onChange={(e) => setAgeMax(Number(e.target.value))} />
                  <div className="f-label">State</div>
                  <select className="sinput" value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}>
                    {INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </FGroup>

                <FGroup n="Cricket" open={openGroups.has("Cricket")} onToggle={toggleGroup}>
                  <div className="f-label">Role</div>
                  <div className="role-pills">
                    {["All", "Batter", "Bowler", "All-Rounder", "WK"].map((r) => (
                      <button key={r} className={`rpill${activeRole === r ? " on" : ""}`}
                        onClick={() => setActiveRole(r)}>{r}</button>
                    ))}
                  </div>
                  <div className="f-label">Bowling Style</div>
                  <select className="sinput" value={bowlStyle} onChange={(e) => setBowlStyle(e.target.value)}>
                    {["Any", "Fast", "Medium", "Off Spin", "Leg Spin", "Left-arm Spin"].map((s) => <option key={s}>{s}</option>)}
                  </select>
                </FGroup>

                <FGroup n="Academy" open={openGroups.has("Academy")} onToggle={toggleGroup}>
                  <input className="sinput" type="text" placeholder="Academy name…"
                    value={academy} onChange={(e) => setAcademy(e.target.value)} />
                </FGroup>

                <FGroup n="Performance" open={openGroups.has("Performance")} onToggle={toggleGroup}>
                  <div className="f-label">Min Runs <span className="fv">{minRuns}+</span></div>
                  <input type="range" min={0} max={1000} step={50} value={minRuns}
                    onChange={(e) => setMinRuns(Number(e.target.value))} />
                  <div className="f-label">Min Wickets <span className="fv">{minWkts}+</span></div>
                  <input type="range" min={0} max={150} step={5} value={minWkts}
                    onChange={(e) => setMinWkts(Number(e.target.value))} />
                </FGroup>

                <FGroup n="Athletic" open={openGroups.has("Athletic")} onToggle={toggleGroup}>
                  <div className="f-label">Min YoYo Score <span className="fv">{minYoyo.toFixed(1)}+</span></div>
                  <input type="range" min={10} max={21} step={0.5} value={minYoyo}
                    onChange={(e) => setMinYoyo(Number(e.target.value))} />
                </FGroup>

                <FGroup n="Behavioral" open={openGroups.has("Behavioral")} onToggle={toggleGroup}>
                  <div className="f-label">Min Discipline <span className="fv">{minDisc}+</span></div>
                  <input type="range" min={1} max={10} value={minDisc}
                    onChange={(e) => setMinDisc(Number(e.target.value))} />
                  <div className="f-label">Min Coachability <span className="fv">{minCoach}+</span></div>
                  <input type="range" min={1} max={10} value={minCoach}
                    onChange={(e) => setMinCoach(Number(e.target.value))} />
                </FGroup>

                <FGroup n="Verification" open={openGroups.has("Verification")} onToggle={toggleGroup}>
                  <div className="role-pills">
                    {["Any", "L2 Identity", "L3 Performance", "L4 Scout"].map((v) => (
                      <button key={v} className={`rpill${minLevel === v ? " on" : ""}`}
                        onClick={() => setMinLevel(v)}>{v}</button>
                    ))}
                  </div>
                </FGroup>

              </div>
              <button className="btn green" style={{ width: "100%", marginTop: 4 }} onClick={handleSearch}>
                Apply Filters
              </button>
            </div>
          </div>

          {/* Watchlist summary */}
          <div className="card">
            <div className="chead2">
              <span className="sect-title">My Watchlist</span>
              <span className="bdg ghost">{watchlist.shortlist} players</span>
            </div>
            <div className="cb">
              <div className="wl-grid">
                {WL.map((w) => (
                  <Link key={w.n} href="/scout/watchlist" className="wl-cell" style={{ textDecoration: "none" }}>
                    <div className="c" style={{ color: w.col, textShadow: `0 0 14px ${w.col}44` }}>{w.c}</div>
                    <div className="n">{w.n}</div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Recently noted */}
          <div className="card">
            <div className="chead2"><span className="sect-title">Recently Noted</span></div>
            <div className="cb">
              {recentNotes.length === 0 ? (
                <div style={{ color: "var(--mut)", fontSize: 12 }}>No notes yet — open a player profile to add one</div>
              ) : recentNotes.map((r: any, i: number) => (
                <Link key={r.player_user_id} href={`/profile/${r.player_user_id}`} className="rv-row" style={{ textDecoration: "none", color: "inherit" }}>
                  <span className="ava" style={{
                    width: 28, height: 28, fontSize: 10,
                    background: `radial-gradient(circle at 32% 28%, ${AVA_COLORS[(i + 1) % AVA_COLORS.length]}, rgba(0,0,0,0.55))`,
                    color: "#fff",
                  }}>
                    {initials(r.player_name)}
                  </span>
                  <span className="rv-name">
                    <span className="n">{r.player_name}</span><br />
                    <span className="d">
                      Noted {new Date(r.updated_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </span>
                  </span>
                  <span className="bdg green">Note</span>
                </Link>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function FGroup({ n, open, onToggle, children }: {
  n: string; open: boolean; onToggle: (g: string) => void; children: React.ReactNode;
}) {
  return (
    <div className={`fgroup${open ? " open" : ""}`}>
      <button className="fgroup-head" onClick={() => onToggle(n)}>
        {n}
        <svg className="chev" width="9" height="9" viewBox="0 0 10 10" fill="none">
          <path d="M3 2L7 5L3 8" stroke="#6A746C" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className="fgroup-body">{children}</div>
    </div>
  );
}

const styles = `
.sx-root { font-family: 'Instrument Sans', system-ui, sans-serif; }
.shell { max-width: 1500px; margin: 0 auto; display: grid; grid-template-columns: 21% 1fr 27%; gap: 16px; padding: 18px; align-items: start; }
.colstack { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
@media (max-width: 1100px) { .shell { grid-template-columns: 1fr; } .sidebar { position: static; } }

.sidebar { position: sticky; top: 18px; display: flex; flex-direction: column; gap: 16px; }
.logo-row { display: flex; align-items: center; gap: 10px; padding: 6px 4px 0; }
.logo-ball { width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0; background: radial-gradient(circle at 32% 28%, #46ff97, #0e6e33 72%); position: relative; box-shadow: 0 0 16px var(--green-glow), inset 0 -5px 8px rgba(0,0,0,0.35), inset 0 2px 3px rgba(255,255,255,0.4); }
.logo-ball::after { content: ''; position: absolute; left: 50%; top: 3px; bottom: 3px; width: 1.5px; background: rgba(4,20,10,0.5); transform: translateX(-50%) rotate(14deg); border-radius: 99px; }
.logo-word { font-family: var(--num); font-size: 17px; font-weight: 700; letter-spacing: 0.05em; }
.logo-word em { font-style: normal; color: var(--green); text-shadow: 0 0 14px var(--green-glow); }

.nav { display: flex; flex-direction: column; gap: 5px; }
.nav-item { display: flex; align-items: center; gap: 10px; border: 1px solid transparent; border-radius: 11px; padding: 10px 12px; color: var(--lbl); font-size: 12.5px; font-weight: 500; cursor: pointer; text-decoration: none; transition: all 0.16s; }
.nav-item:hover { color: var(--text); background: var(--card-alt); border-color: var(--line); }
.nav-item.active { color: var(--text); background: linear-gradient(168deg, rgba(46,224,123,0.13), rgba(46,224,123,0.04)); border-color: var(--green-bd); box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 6px 18px -8px var(--green-glow); }
.nav-count { margin-left: auto; min-width: 19px; height: 18px; padding: 0 6px; border-radius: 99px; display: grid; place-items: center; font-family: var(--num); font-size: 9.5px; font-weight: 700; background: var(--green-bg); color: var(--green); border: 1px solid var(--green-bd); }
.scout-card { padding: 13px; display: flex; align-items: center; gap: 11px; }
.scout-ava { width: 38px; height: 38px; border-radius: 50%; background: radial-gradient(circle at 32% 28%, #46ff97, #0e6e33 75%); display: grid; place-items: center; font-family: var(--num); font-weight: 700; font-size: 13px; color: #04140a; box-shadow: inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -7px 10px rgba(0,0,0,0.3), 0 3px 10px rgba(0,0,0,0.5); }
.scout-name { font-size: 13px; font-weight: 600; }

.hero { overflow: hidden; position: relative; }
.hero::after { content: ''; position: absolute; right: -60px; top: -90px; width: 340px; height: 340px; border-radius: 50%; background: radial-gradient(circle, rgba(46,224,123,0.10), transparent 68%); pointer-events: none; }
.hero-main { display: flex; min-height: 212px; position: relative; }
.hero-left { flex: 1; padding: 20px 0 16px 22px; display: flex; flex-direction: column; min-width: 0; position: relative; z-index: 2; }
.hero-name-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
.hero-name { font-family: var(--num); font-size: 30px; font-weight: 700; line-height: 1.05; }
.hero-academy { font-size: 11.5px; color: var(--mut); margin-top: 4px; }
.hero-trust { display: flex; align-items: center; gap: 14px; margin-top: auto; padding-top: 14px; }
.hero-trust .blk .k { font-size: 9px; letter-spacing: 1.8px; text-transform: uppercase; color: var(--lbl2); margin-bottom: 5px; font-family: var(--num); font-weight: 600; }
.v2-chip { display: inline-flex; align-items: center; gap: 6px; height: 22px; padding: 0 10px; border-radius: 99px; border: 1px dashed rgba(167,139,250,0.4); color: var(--purple); font-family: var(--num); font-size: 9.5px; font-weight: 600; letter-spacing: 0.05em; }
.hero-photo { position: relative; width: 250px; flex-shrink: 0; display: flex; align-items: flex-end; justify-content: center; }
.hero-photo .pedestal { position: absolute; bottom: 6px; left: 50%; transform: translateX(-50%); width: 180px; height: 30px; border-radius: 50%; background: radial-gradient(ellipse, rgba(46,224,123,0.16), transparent 70%); }
.hero-ava { width: 130px; height: 130px; border-radius: 50%; margin-bottom: 36px; position: relative; z-index: 1; background: radial-gradient(circle at 32% 28%, #46ff97, #0e6e33 75%); display: grid; place-items: center; font-family: var(--num); font-weight: 700; font-size: 38px; color: #04140a; box-shadow: inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -14px 20px rgba(0,0,0,0.3), 0 6px 20px rgba(0,0,0,0.5); }
.hero-strip { display: grid; grid-template-columns: repeat(5, 1fr); border-top: 1px solid var(--line); background: rgba(0,0,0,0.22); border-radius: 0 0 12px 12px; }
.hs-cell { padding: 11px 6px; text-align: center; }
.hs-cell + .hs-cell { border-left: 1px solid var(--line); }
.hs-cell .v { font-family: var(--num); font-size: 17px; font-weight: 700; }
.hs-cell .l { font-size: 8.5px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--mut); margin-top: 2px; }

.chead2 { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px 0; }
.cb { padding: 12px 14px 14px; }

.ptable { width: 100%; border-collapse: collapse; }
.ptable th { background: var(--head); font-family: var(--num); font-size: 9.5px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: var(--lbl); text-align: left; padding: 9px 12px; }
.ptable th:first-child { border-radius: 8px 0 0 8px; }
.ptable th:last-child { border-radius: 0 8px 8px 0; }
.ptable td { padding: 9px 12px; font-size: 12.5px; vertical-align: middle; }
.ptable tbody tr { border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.12s; }
.ptable tbody tr:last-child { border-bottom: none; }
.ptable tbody tr:hover { background: rgba(46,224,123,0.05); }
.pcell { display: flex; align-items: center; gap: 10px; }
.pcell .nm { font-weight: 600; line-height: 1.2; }
.pcell .ds { font-size: 10.5px; color: var(--mut); }
.wl-btn { width: 26px; height: 26px; border-radius: 8px; border: 1px solid var(--line2); background: var(--card-alt); cursor: pointer; display: inline-grid; place-items: center; transition: all 0.14s; padding: 0; vertical-align: middle; }
.wl-btn:hover { border-color: var(--green-bd); background: var(--green-bg); }
.wl-btn.saved { border-color: var(--green-bd); background: var(--green-bg); }
.wl-btn svg { display: block; }

.fgroup { border-top: 1px solid var(--line); }
.fgroup:first-child { border-top: none; }
.fgroup-head { display: flex; align-items: center; gap: 8px; width: 100%; padding: 11px 0; background: none; border: none; cursor: pointer; font-family: var(--num); font-size: 10px; font-weight: 600; letter-spacing: 1.8px; text-transform: uppercase; color: var(--lbl); transition: color 0.14s; }
.fgroup-head:hover { color: var(--text); }
.fgroup-head .chev { margin-left: auto; transition: transform 0.2s; }
.fgroup.open .chev { transform: rotate(90deg); }
.fgroup-body { display: none; padding: 0 0 13px; }
.fgroup.open .fgroup-body { display: block; }
.f-label { font-size: 10px; letter-spacing: 1.4px; text-transform: uppercase; color: var(--lbl2); margin: 11px 0 6px; font-family: var(--num); font-weight: 600; }
.f-label:first-child { margin-top: 0; }
.f-label .fv { color: var(--green); float: right; letter-spacing: 0; }
.role-pills { display: flex; gap: 5px; flex-wrap: wrap; }
.rpill { height: 25px; padding: 0 11px; border-radius: 99px; display: inline-flex; align-items: center; background: var(--card-alt); border: 1px solid var(--line2); color: var(--lbl); font-family: var(--num); font-size: 10.5px; font-weight: 600; cursor: pointer; box-shadow: inset 0 1px 0 rgba(255,255,255,0.05); transition: all 0.13s; }
.rpill:hover { color: var(--text); border-color: rgba(255,255,255,0.25); }
.rpill.on { background: var(--green-bg); border-color: var(--green-bd); color: var(--green); box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 0 10px -3px var(--green-glow); }
input[type="range"] { width: 100%; height: 4px; appearance: none; -webkit-appearance: none; background: var(--line2); border-radius: 99px; outline: none; cursor: pointer; }
input[type="range"]::-webkit-slider-thumb { appearance: none; -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: var(--green); border: 2.5px solid #052e14; box-shadow: 0 0 8px var(--green-glow); cursor: grab; }

.wl-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.wl-cell { border: 1px solid var(--line); border-radius: 11px; padding: 10px 12px; background: var(--card-alt); cursor: pointer; transition: all 0.15s; box-shadow: inset 0 1px 0 rgba(255,255,255,0.05); display: block; }
.wl-cell:hover { transform: translateY(-2px); border-color: var(--line2); box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 18px -8px rgba(0,0,0,0.6); }
.wl-cell .c { font-family: var(--num); font-size: 21px; font-weight: 700; }
.wl-cell .n { font-size: 10px; color: var(--lbl); margin-top: 2px; }

.rv-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; }
.rv-row + .rv-row { border-top: 1px solid var(--line); }
.rv-name { flex: 1; min-width: 0; }
.rv-name .n { font-size: 12.5px; font-weight: 600; }
.rv-name .d { font-size: 10.5px; color: var(--mut); }
`;
