"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useCallback } from "react";
import { initials, roleColor, AVA_COLORS } from "@/lib/score-utils";
import { DsIcon, DsButton, DsAvatar, DsPill, DsInput, DsSelect, DsChip } from "@/app/_ds";

const NAV: Array<{ key: string; n: string; href: string; icon: string; badgeKey?: string }> = [
  { key: "dashboard", n: "Dashboard", href: "/scout/dashboard", icon: "dashboard" },
  { key: "search", n: "Search Players", href: "/scout/search", icon: "search" },
  { key: "watchlist", n: "Watchlist", href: "/scout/watchlist", icon: "star", badgeKey: "shortlist" },
  { key: "notes", n: "My Notes", href: "/scout/notes", icon: "notes" },
  { key: "workflow", n: "Workflow", href: "/workflow", icon: "workflow" },
  { key: "settings", n: "Settings", href: "/scout/settings", icon: "settings" },
];

const INDIAN_STATES = [
  "All States", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala",
  "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha",
  "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal",
];

const VLEVEL_LABEL: Record<number, string> = { 1: "L1 Self", 2: "L2 Identity", 3: "L3 Performance", 4: "L4 Scout" };
const VLEVEL_TONE: Record<number, "neutral" | "accent" | "ok" | "blue"> = { 1: "neutral", 2: "accent", 3: "ok", 4: "blue" };

function MiniRing({ percent, size = 64, stroke = 6 }: { percent: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = percent >= 80 ? "var(--ax-ok)" : percent >= 50 ? "var(--ax-accent)" : "var(--ax-bad)";
  return (
    <div style={{ position: "relative", width: size, height: size, flex: "0 0 auto" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ax-field)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (percent / 100) * c} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontFamily: "var(--ax-font-display)", fontSize: "0.95rem", color }}>{percent}</div>
    </div>
  );
}

function FilterGroup({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div style={{ borderBottom: "1px solid var(--ax-border)" }}>
      <button onClick={onToggle} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem",
        padding: "0.7rem 0", background: "none", border: 0, cursor: "pointer", color: "var(--ax-text)",
        fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.74rem", fontWeight: 700 }}>
        {title}
        <span style={{ color: "var(--ax-text-faint)", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.18s ease" }}>
          <DsIcon name="chevron" size={14} />
        </span>
      </button>
      {open && <div style={{ padding: "0.2rem 0 0.9rem" }}>{children}</div>}
    </div>
  );
}

const groupLabel: React.CSSProperties = { fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.1em", fontSize: "0.62rem", fontWeight: 700, color: "var(--ax-text-dim)", margin: "0 0 0.5rem" };
const cardShell: React.CSSProperties = { position: "relative", overflow: "hidden", borderRadius: "var(--ax-radius-xl)", background: "var(--ax-card)", border: "1px solid var(--ax-border)", boxShadow: "var(--ax-shadow-card)" };
const kicker: React.CSSProperties = { fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.18em", fontSize: "11px", fontWeight: 700, color: "var(--ax-accent-bright)", margin: "0 0 0.35rem" };

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
  const [minLevel, setMinLevel] = useState("Any");
  const [openGroup, setOpenGroup] = useState("Demographics");

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
  const fpStats: Array<[string, string]> = [
    ["Runs", String(fp?.runs_scored ?? "—")],
    ["Wickets", String(fp?.wickets ?? "—")],
    ["Matches", String(fp?.matches_played ?? "—")],
    ["BPI", fp?.bpi ? Number(fp.bpi).toFixed(1) : "—"],
    ["Economy", fp?.economy ? Number(fp.economy).toFixed(1) : "—"],
  ];

  const WL: Array<[string, number]> = [
    ["Shortlist", watchlist.shortlist],
    ["Notes", watchlist.notes],
    ["Invites Sent", watchlist.invites],
    ["Accepted", watchlist.accepted],
  ];

  return (
    <div style={{ position: "relative", display: "grid", gridTemplateColumns: "232px 1fr 332px", width: "100%", minHeight: "100vh", background: "var(--ax-bg)", color: "var(--ax-text)" }}>

      {/* ===== SIDEBAR ===== */}
      <aside style={{ display: "flex", flexDirection: "column", background: "var(--ax-bg-soft)", borderRight: "1px solid var(--ax-border)", padding: "1.3rem 0.9rem", position: "sticky", top: 0, height: "100vh" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0 0.4rem 1.3rem" }}>
          <span style={{ fontFamily: "var(--ax-font-display)", fontSize: "1.35rem", lineHeight: 1, letterSpacing: "-0.01em" }}>
            ATHLAS<span style={{ color: "var(--ax-accent)" }}>X</span>
          </span>
          <span style={{ fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.16em", fontSize: "0.6rem", fontWeight: 700, color: "var(--ax-text-faint)", borderLeft: "1px solid var(--ax-border)", paddingLeft: "0.6rem" }}>
            Scout
          </span>
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
          {NAV.map((item) => {
            const on = pathname === item.href;
            const badge = item.badgeKey ? (watchlist as any)[item.badgeKey] : 0;
            return (
              <Link key={item.key} href={item.href} style={{ display: "flex", alignItems: "center", gap: "0.7rem", textAlign: "left", cursor: "pointer",
                padding: "0.6rem 0.7rem", borderRadius: "var(--ax-radius-md)", border: "1px solid " + (on ? "var(--ax-accent)" : "transparent"),
                background: on ? "var(--ax-accent-14)" : "transparent", color: on ? "var(--ax-accent-bright)" : "var(--ax-text-dim)",
                fontFamily: "var(--ax-font-body)", fontSize: "0.88rem", fontWeight: on ? 700 : 600, textDecoration: "none", transition: "all 0.14s ease" }}>
                <DsIcon name={item.icon} size={17} />
                <span style={{ flex: 1 }}>{item.n}</span>
                {badge > 0 && (
                  <span style={{ fontFamily: "var(--ax-font-label)", fontSize: "0.66rem", fontWeight: 700, padding: "0.05rem 0.4rem", borderRadius: "999px", background: "var(--ax-accent)", color: "var(--ax-text-on-accent)" }}>
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div style={{ marginTop: "auto", paddingTop: "0.9rem", borderTop: "1px solid var(--ax-border)", display: "flex", gap: "0.6rem", alignItems: "center" }}>
          <DsAvatar initial={userInitials} size={36} />
          <div style={{ minWidth: 0 }}>
            <b style={{ display: "block", fontSize: "0.82rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.name ?? "Scout"}</b>
            <DsPill tone="ok" size="sm" dot>Verified Scout</DsPill>
          </div>
        </div>
      </aside>

      {/* ===== CENTRE ===== */}
      <main style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", padding: "0.85rem 1.6rem", borderBottom: "1px solid var(--ax-border)", background: "rgba(13,13,13,0.6)", WebkitBackdropFilter: "blur(10px)", backdropFilter: "blur(10px)" }}>
          <div>
            <p style={kicker}>Talent Discovery</p>
            <h1 style={{ fontFamily: "var(--ax-font-display)", textTransform: "uppercase", fontWeight: 400, lineHeight: 0.95, fontSize: "1.7rem", margin: 0 }}>Scout Dashboard</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", maxWidth: 340, flex: 1, justifyContent: "flex-end" }}>
            <div style={{ position: "relative", flex: 1, maxWidth: 260 }}>
              <span style={{ position: "absolute", left: "0.7rem", top: "50%", transform: "translateY(-50%)", color: "var(--ax-text-faint)", pointerEvents: "none" }}>
                <DsIcon name="search" size={15} />
              </span>
              <DsInput placeholder="Name, city or academy…" style={{ paddingLeft: "2.1rem" }}
                value={search} onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }} />
            </div>
          </div>
        </header>

        <div style={{ flex: 1, overflowY: "auto", padding: "1.4rem 1.6rem 2.5rem" }}>
          {/* Featured player */}
          <div style={{ ...cardShell, marginBottom: "1.4rem" }}>
            <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "var(--ax-corner-glow)" }} />
            <div style={{ position: "relative", padding: "1.4rem 1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
                <DsPill tone="accent" size="sm">★ Featured</DsPill>
                <DsPill tone="neutral" size="sm">Workflow P5 · Discover</DsPill>
                <DsPill tone="neutral" size="sm">P6 · Endorse</DsPill>
                <Link href="/workflow" style={{ marginLeft: "auto", fontSize: "0.78rem", color: "var(--ax-text-faint)", textDecoration: "none" }}>How it fits →</Link>
              </div>
              {fp ? (
                <>
                  <div style={{ display: "flex", gap: "1.3rem", alignItems: "center", flexWrap: "wrap" }}>
                    <DsAvatar initial={initials(fp.name)} size={64} solid />
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                        <h2 style={{ fontFamily: "var(--ax-font-display)", textTransform: "uppercase", fontWeight: 400, fontSize: "1.8rem", lineHeight: 1, margin: 0 }}>{fp.name}</h2>
                        <DsPill tone="accent">{fp.playing_role}</DsPill>
                        <DsPill tone={VLEVEL_TONE[fp.verification_level ?? 1]} dot>{VLEVEL_LABEL[fp.verification_level ?? 1]}</DsPill>
                      </div>
                      <p style={{ margin: "0.5rem 0 0", fontSize: "0.86rem", color: "var(--ax-text-dim)" }}>
                        {[fp.academy_name_custom, fp.city, fp.state].filter(Boolean).join(" · ")}{fp.age ? ` · Age ${fp.age}` : ""}
                      </p>
                    </div>
                    <MiniRing percent={fp.profile_pct ?? 0} size={74} stroke={7} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${fpStats.length}, 1fr)`, gap: "0.7rem", marginTop: "1.3rem" }}>
                    {fpStats.map(([k, v]) => (
                      <div key={k} style={{ padding: "0.7rem 0.8rem", borderRadius: "var(--ax-radius-md)", background: "var(--ax-field)", border: "1px solid var(--ax-border)", textAlign: "center" }}>
                        <div style={{ fontFamily: "var(--ax-font-display)", fontWeight: 400, fontSize: "1.5rem", lineHeight: 1 }}>{v}</div>
                        <div style={{ fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.6rem", fontWeight: 700, color: "var(--ax-text-faint)", marginTop: "0.35rem" }}>{k}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginTop: "1.2rem", flexWrap: "wrap" }}>
                    <DsPill tone="purple" size="sm">Intelligence Score · Coming in V2</DsPill>
                    <div style={{ display: "flex", gap: "0.6rem" }}>
                      <DsButton variant="outline" size="sm" leadingIcon={<DsIcon name="star" size={15} />} onClick={() => toggleSave(String(fp.user_id))}>
                        {saved.has(String(fp.user_id)) ? "Watchlisted" : "Watchlist"}
                      </DsButton>
                      <Link href={`/profile/${fp.user_id}`} style={{ textDecoration: "none" }}>
                        <DsButton variant="fill" size="sm" leadingIcon={<DsIcon name="eye" size={15} />}>View Profile</DsButton>
                      </Link>
                    </div>
                  </div>
                </>
              ) : (
                <p style={{ margin: 0, color: "var(--ax-text-dim)" }}>No featured player yet</p>
              )}
            </div>
          </div>

          {/* Discovered players table */}
          <div style={cardShell}>
            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", padding: "1rem 1.2rem", borderBottom: "1px solid var(--ax-border)" }}>
              <div>
                <b style={{ fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "1rem" }}>Discovered Players</b>
                <small style={{ display: "block", fontSize: "0.74rem", color: "var(--ax-text-faint)" }}>Live + public profiles visible to scouts</small>
              </div>
              <DsPill tone="neutral" size="sm">{players.length} shown</DsPill>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "var(--ax-bg-soft)" }}>
                    {["Player", "Role", "Age", "State", "Verification", "Profile", ""].map((h, i) => (
                      <th key={i} style={{ textAlign: i === 6 ? "right" : i === 2 || i === 5 ? "center" : "left", padding: "0.6rem 1.1rem", fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.62rem", fontWeight: 700, color: "var(--ax-text-faint)", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {players.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--ax-text-faint)", padding: "1.5rem 0.8rem" }}>No players found</td></tr>
                  ) : players.map((p: any, i: number) => {
                    const isOn = saved.has(String(p.user_id));
                    return (
                      <tr key={p.user_id} style={{ borderTop: "1px solid var(--ax-border)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ax-bg-elevated)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                        <td style={{ padding: "0.6rem 1.1rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                            <span style={{ width: 30, height: 30, flex: "0 0 auto", borderRadius: "50%", display: "grid", placeItems: "center", fontSize: "0.7rem", fontWeight: 700, color: "#fff",
                              background: `radial-gradient(circle at 32% 28%, ${AVA_COLORS[i % AVA_COLORS.length]}, rgba(0,0,0,0.55))` }}>
                              {initials(p.name)}
                            </span>
                            <span><b style={{ fontWeight: 600 }}>{p.name}</b><small style={{ display: "block", fontSize: "0.68rem", color: "var(--ax-text-faint)" }}>{p.academy_name_custom || "Independent"}</small></span>
                          </div>
                        </td>
                        <td style={{ padding: "0.6rem 1.1rem", color: "var(--ax-text-dim)", whiteSpace: "nowrap" }}>{p.playing_role}</td>
                        <td style={{ padding: "0.6rem 1.1rem", textAlign: "center", color: "var(--ax-text-dim)", fontVariantNumeric: "tabular-nums" }}>{p.age ?? "—"}</td>
                        <td style={{ padding: "0.6rem 1.1rem", color: "var(--ax-text-dim)", whiteSpace: "nowrap" }}>{p.state || "—"}</td>
                        <td style={{ padding: "0.6rem 1.1rem" }}><DsPill tone={VLEVEL_TONE[p.verification_level ?? 1]} size="sm">{VLEVEL_LABEL[p.verification_level ?? 1]}</DsPill></td>
                        <td style={{ padding: "0.6rem 1.1rem", textAlign: "center" }}><MiniRing percent={p.profile_pct ?? 0} size={30} stroke={3} /></td>
                        <td style={{ padding: "0.6rem 1.1rem", textAlign: "right", whiteSpace: "nowrap" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.7rem" }}>
                            <button onClick={() => toggleSave(String(p.user_id))} aria-label="Toggle watchlist" style={{ background: "none", border: 0, cursor: "pointer", color: isOn ? "var(--ax-accent)" : "var(--ax-text-faint)", display: "grid", placeItems: "center" }}>
                              <DsIcon name="star" size={17} style={{ fill: isOn ? "var(--ax-accent)" : "none" }} />
                            </button>
                            <Link href={`/profile/${p.user_id}`} style={{ fontWeight: 700, color: "var(--ax-accent-bright)", textDecoration: "none" }}>View</Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* ===== RIGHT PANEL ===== */}
      <aside style={{ borderLeft: "1px solid var(--ax-border)", background: "var(--ax-bg-soft)", overflowY: "auto", padding: "1.3rem 1.2rem 2.5rem" }}>
        {/* Filters */}
        <div style={{ marginBottom: "1.6rem" }}>
          <p style={{ ...groupLabel, color: "var(--ax-accent-bright)", letterSpacing: "0.16em" }}>Search filters</p>
          <FilterGroup title="Demographics" open={openGroup === "Demographics"} onToggle={() => setOpenGroup(openGroup === "Demographics" ? "" : "Demographics")}>
            <p style={groupLabel}>Age range · up to {ageMax}</p>
            <input type="range" min={14} max={30} value={ageMax} onChange={(e) => setAgeMax(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--ax-accent)" }} />
            <div style={{ marginTop: "0.7rem" }}>
              <p style={groupLabel}>State</p>
              <DsSelect value={selectedState} onChange={(e) => setSelectedState(e.target.value)}>
                {INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}
              </DsSelect>
            </div>
          </FilterGroup>

          <FilterGroup title="Cricket" open={openGroup === "Cricket"} onToggle={() => setOpenGroup(openGroup === "Cricket" ? "" : "Cricket")}>
            <p style={groupLabel}>Role</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
              {["All", "Batter", "Bowler", "All-Rounder", "WK"].map((r) => (
                <DsChip key={r} selected={activeRole === r} onToggle={() => setActiveRole(r)}>{r}</DsChip>
              ))}
            </div>
            <p style={{ ...groupLabel, marginTop: "0.7rem" }}>Bowling Style</p>
            <DsSelect value={bowlStyle} onChange={(e) => setBowlStyle(e.target.value)}>
              {["Any", "Fast", "Medium", "Off Spin", "Leg Spin", "Left-arm Spin"].map((s) => <option key={s}>{s}</option>)}
            </DsSelect>
          </FilterGroup>

          <FilterGroup title="Academy" open={openGroup === "Academy"} onToggle={() => setOpenGroup(openGroup === "Academy" ? "" : "Academy")}>
            <DsInput type="text" placeholder="Academy name…" value={academy} onChange={(e) => setAcademy(e.target.value)} />
          </FilterGroup>

          <FilterGroup title="Performance" open={openGroup === "Performance"} onToggle={() => setOpenGroup(openGroup === "Performance" ? "" : "Performance")}>
            <p style={groupLabel}>Min runs · {minRuns}+</p>
            <input type="range" min={0} max={1000} step={50} value={minRuns} onChange={(e) => setMinRuns(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--ax-accent)" }} />
            <p style={{ ...groupLabel, marginTop: "0.7rem" }}>Min wickets · {minWkts}+</p>
            <input type="range" min={0} max={150} step={5} value={minWkts} onChange={(e) => setMinWkts(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--ax-accent)" }} />
          </FilterGroup>

          <FilterGroup title="Athletic" open={openGroup === "Athletic"} onToggle={() => setOpenGroup(openGroup === "Athletic" ? "" : "Athletic")}>
            <p style={groupLabel}>Min Yo-Yo score · {minYoyo.toFixed(1)}+</p>
            <input type="range" min={10} max={21} step={0.5} value={minYoyo} onChange={(e) => setMinYoyo(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--ax-accent)" }} />
          </FilterGroup>

          <FilterGroup title="Verification" open={openGroup === "Verification"} onToggle={() => setOpenGroup(openGroup === "Verification" ? "" : "Verification")}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
              {["Any", "L2 Identity", "L3 Performance", "L4 Scout"].map((l) => (
                <DsChip key={l} selected={minLevel === l} onToggle={() => setMinLevel(l)}>{l}</DsChip>
              ))}
            </div>
          </FilterGroup>

          <DsButton variant="fill" block size="sm" style={{ marginTop: "1rem" }} onClick={handleSearch}>Apply Filters</DsButton>
        </div>

        {/* Watchlist summary */}
        <p style={{ ...groupLabel, color: "var(--ax-accent-bright)", letterSpacing: "0.16em" }}>Your activity</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "1.4rem" }}>
          {WL.map(([k, v]) => (
            <Link key={k} href="/scout/watchlist" style={{ textAlign: "left", cursor: "pointer", padding: "0.8rem 0.9rem", borderRadius: "var(--ax-radius-md)", background: "var(--ax-card)", border: "1px solid var(--ax-border)", color: "var(--ax-text)", textDecoration: "none" }}>
              <div style={{ fontFamily: "var(--ax-font-display)", fontWeight: 400, fontSize: "1.6rem", lineHeight: 1, color: "var(--ax-accent-bright)" }}>{v}</div>
              <div style={{ fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.6rem", fontWeight: 700, color: "var(--ax-text-faint)", marginTop: "0.3rem" }}>{k}</div>
            </Link>
          ))}
        </div>

        {/* Recently noted */}
        <p style={{ ...groupLabel, color: "var(--ax-accent-bright)", letterSpacing: "0.16em" }}>Recently noted</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {recentNotes.length === 0 ? (
            <p style={{ fontSize: "0.78rem", color: "var(--ax-text-faint)" }}>No notes yet — open a player profile to add one</p>
          ) : recentNotes.map((n: any, i: number) => (
            <Link key={n.player_user_id} href={`/profile/${n.player_user_id}`} style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.55rem 0.7rem", borderRadius: "var(--ax-radius-md)", background: "var(--ax-card)", border: "1px solid var(--ax-border)", textDecoration: "none", color: "var(--ax-text)" }}>
              <span style={{ width: 28, height: 28, flex: "0 0 auto", borderRadius: "50%", display: "grid", placeItems: "center", fontSize: "0.65rem", fontWeight: 700, color: "#fff",
                background: `radial-gradient(circle at 32% 28%, ${AVA_COLORS[(i + 1) % AVA_COLORS.length]}, rgba(0,0,0,0.55))` }}>
                {initials(n.player_name)}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <b style={{ display: "block", fontSize: "0.82rem", fontWeight: 600 }}>{n.player_name}</b>
                <small style={{ fontSize: "0.68rem", color: "var(--ax-text-faint)" }}>Noted {new Date(n.updated_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</small>
              </span>
              <DsPill tone="purple" size="sm">Note</DsPill>
            </Link>
          ))}
        </div>
      </aside>
    </div>
  );
}