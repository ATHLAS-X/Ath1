"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { AddCoachForm, AddPlayerForm, BulkCsvForm } from "@/components/academy/forms";
import { DsIcon, DsButton, DsAvatar, DsPill } from "@/app/_ds";

interface Stats { total: number; verified: number; live: number; scoutViews: number; }
interface SessionSummary {
  today_sessions: number;
  upcoming_sessions: number;
  marked_count: number;
  unmarked_count: number;
  present_count: number;
  absent_count: number;
  late_count: number;
}
interface PlayerRow {
  id: string;
  user_id: string | null;
  name: string;
  playing_role: string | null;
  verification_level: number;
  profile_status: string;
  created_at: string;
}
interface Props {
  academy: { id: string; name: string; logoUrl: string | null; profileStatus: string; location: string };
  adminName: string;
  adminEmail: string;
  stats: Stats;
  sessionSummary: SessionSummary;
  recentPlayers: PlayerRow[];
}

const NAV: Array<{ label: string; href: string; icon: string }> = [
  { label: "Dashboard", href: "/academy/dashboard", icon: "dashboard" },
  { label: "Players", href: "/academy/players", icon: "players" },
  { label: "Sessions & Attendance", href: "/academy/sessions", icon: "calendar" },
  { label: "Coaches", href: "/academy/coaches", icon: "coaches" },
  { label: "Fitness & Assessments", href: "/academy/fitness", icon: "fitness" },
  { label: "Settings", href: "/academy/settings", icon: "settings" },
];

const VLEVEL_LABEL: Record<number, string> = { 1: "Unverified", 2: "Identity Verified", 3: "Performance Verified", 4: "Scout Verified" };
const VLEVEL_TONE: Record<number, "neutral" | "accent" | "ok" | "blue"> = { 1: "neutral", 2: "accent", 3: "ok", 4: "blue" };
const STATUS_TONE: Record<string, "neutral" | "accent" | "ok" | "bad" | "orange"> = {
  "Draft": "neutral", "Pending Approval": "accent", "Live": "ok", "Rejected": "bad", "Changes Requested": "orange",
};

const kicker: React.CSSProperties = { fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.18em", fontSize: "11px", fontWeight: 700, color: "var(--ax-accent-bright)", margin: "0 0 0.4rem" };

function StatCard({ icon, label, value, sub, tone = "accent", placeholder = false }: {
  icon: string; label: string; value: string; sub: string; tone?: "accent" | "ok" | "blue" | "neutral"; placeholder?: boolean;
}) {
  const tint = { accent: "var(--ax-accent-bright)", ok: "var(--ax-ok)", blue: "#7DBBFF", neutral: "var(--ax-text-dim)" }[tone];
  const tintBg = { accent: "var(--ax-accent-14)", ok: "var(--ax-ok-soft)", blue: "rgba(74,158,255,0.14)", neutral: "var(--ax-field)" }[tone];
  return (
    <div style={{ position: "relative", overflow: "hidden", padding: "1.15rem 1.2rem", borderRadius: "var(--ax-radius-xl)",
      background: "var(--ax-card)", border: "1px solid var(--ax-border)", boxShadow: "var(--ax-shadow-card)", opacity: placeholder ? 0.62 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.1em", fontSize: "0.66rem", fontWeight: 700, color: "var(--ax-text-dim)" }}>{label}</span>
        <span style={{ width: 30, height: 30, flex: "0 0 auto", borderRadius: "var(--ax-radius-sm)", display: "grid", placeItems: "center", background: tintBg, color: tint }}>
          <DsIcon name={icon} size={16} />
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginTop: "0.7rem" }}>
        <b style={{ fontFamily: "var(--ax-font-display)", fontWeight: 400, fontSize: "2.3rem", lineHeight: 0.9, color: placeholder ? "var(--ax-text-faint)" : "var(--ax-text)" }}>{value}</b>
        {placeholder && <DsPill tone="neutral">V2</DsPill>}
      </div>
      <p style={{ margin: "0.5rem 0 0", fontSize: "0.74rem", color: "var(--ax-text-faint)", lineHeight: 1.4 }}>{sub}</p>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: "accent" | "ok" | "blue" }) {
  const map = {
    accent: { bg: "var(--ax-accent-14)", fg: "var(--ax-accent-bright)" },
    ok: { bg: "var(--ax-ok-soft)", fg: "var(--ax-ok)" },
    blue: { bg: "rgba(74,158,255,0.14)", fg: "#7DBBFF" },
  }[tone];
  return (
    <div style={{ padding: "0.8rem 0.85rem", borderRadius: "var(--ax-radius-lg)", background: map.bg, border: "1px solid var(--ax-border)" }}>
      <div style={{ fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.62rem", color: "var(--ax-text-faint)", fontWeight: 700 }}>{label}</div>
      <div style={{ marginTop: "0.2rem", fontFamily: "var(--ax-font-display)", fontSize: "1.9rem", lineHeight: 1, color: map.fg }}>{value}</div>
    </div>
  );
}

function SessionLine({ label, value, tone }: { label: string; value: number; tone: "ok" | "bad" | "orange" | "neutral" }) {
  const fg = {
    ok: "var(--ax-ok)",
    bad: "var(--ax-bad-text)",
    orange: "#FFB35C",
    neutral: "var(--ax-text-dim)",
  }[tone];
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", padding: "0.55rem 0.7rem", borderRadius: "var(--ax-radius-md)", background: "var(--ax-field)", border: "1px solid var(--ax-border)" }}>
      <span style={{ fontSize: "0.82rem", color: "var(--ax-text-dim)", fontWeight: 600 }}>{label}</span>
      <span style={{ fontFamily: "var(--ax-font-display)", fontSize: "1.15rem", lineHeight: 1, color: fg }}>{value}</span>
    </div>
  );
}

export default function AcademyAdminDashboard(p: Props) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [openModal, setOpenModal] = useState<null | "player" | "csv" | "coach">(null);

  const bannerStatus = p.academy.profileStatus === "Draft" ? "draft"
    : p.academy.profileStatus === "Pending Approval" ? "pending"
    : null;

  const initials = p.adminName.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div style={{ position: "relative", display: "grid", gridTemplateColumns: "248px 1fr", width: "100%", minHeight: "100vh", background: "var(--ax-bg)", color: "var(--ax-text)" }}>

      {/* ===== SIDEBAR ===== */}
      <aside style={{ display: "flex", flexDirection: "column", background: "var(--ax-bg-soft)", borderRight: "1px solid var(--ax-border)", padding: "1.3rem 0.9rem", position: "sticky", top: 0, height: "100vh" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0 0.4rem 1.3rem" }}>
          <span style={{ fontFamily: "var(--ax-font-display)", fontSize: "1.35rem", lineHeight: 1, letterSpacing: "-0.01em" }}>
            ATHLAS<span style={{ color: "var(--ax-accent)" }}>X</span>
          </span>
          <span style={{ fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.16em", fontSize: "0.6rem", fontWeight: 700, color: "var(--ax-text-faint)", borderLeft: "1px solid var(--ax-border)", paddingLeft: "0.6rem" }}>
            Academy
          </span>
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
          {NAV.map((item) => {
            const on = pathname === item.href || (item.href !== "/academy/dashboard" && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} style={{ display: "flex", alignItems: "center", gap: "0.75rem", textAlign: "left", cursor: "pointer",
                padding: "0.62rem 0.7rem", borderRadius: "var(--ax-radius-md)", border: "1px solid " + (on ? "var(--ax-accent)" : "transparent"),
                background: on ? "var(--ax-accent-14)" : "transparent", color: on ? "var(--ax-accent-bright)" : "var(--ax-text-dim)",
                fontFamily: "var(--ax-font-body)", fontSize: "0.9rem", fontWeight: on ? 700 : 600, textDecoration: "none", transition: "all 0.14s ease" }}>
                <DsIcon name={item.icon} size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div style={{ marginTop: "auto", display: "flex", gap: "0.6rem", alignItems: "center", padding: "0.7rem 0.6rem", borderRadius: "var(--ax-radius-md)", background: "rgba(13,13,13,0.72)", border: "1px solid var(--ax-border)" }}>
          <span style={{ width: 34, height: 34, flex: "0 0 auto", borderRadius: "var(--ax-radius-sm)", display: "grid", placeItems: "center", background: "var(--ax-accent-14)", color: "var(--ax-accent-bright)" }}>
            <DsIcon name="building" size={17} />
          </span>
          <div style={{ minWidth: 0 }}>
            <b style={{ display: "block", fontSize: "0.82rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.academy.name}</b>
            {p.academy.location && <small style={{ fontSize: "0.72rem", color: "var(--ax-text-faint)" }}>{p.academy.location}</small>}
          </div>
        </div>
      </aside>

      {/* ===== MAIN ===== */}
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>

        {/* topbar */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", padding: "0.85rem 1.6rem", borderBottom: "1px solid var(--ax-border)", background: "rgba(13,13,13,0.6)", WebkitBackdropFilter: "blur(10px)", backdropFilter: "blur(10px)", position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
            {p.academy.logoUrl ? (
              <img src={p.academy.logoUrl} alt="" style={{ width: 38, height: 38, borderRadius: "var(--ax-radius-md)", objectFit: "cover" }} />
            ) : (
              <span style={{ width: 38, height: 38, borderRadius: "var(--ax-radius-md)", display: "grid", placeItems: "center", background: "var(--ax-field)", border: "1px solid var(--ax-border)", color: "var(--ax-accent-bright)" }}>
                <DsIcon name="building" size={18} />
              </span>
            )}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <b style={{ fontSize: "0.98rem" }}>{p.academy.name}</b>
                <DsPill tone={STATUS_TONE[p.academy.profileStatus] ?? "neutral"} dot>{p.academy.profileStatus}</DsPill>
              </div>
              <small style={{ fontSize: "0.74rem", color: "var(--ax-text-faint)" }}>/academy/dashboard</small>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <DsAvatar initial={initials} size={34} />
              <div style={{ lineHeight: 1.2 }}>
                <b style={{ display: "block", fontSize: "0.84rem" }}>{p.adminName}</b>
                <small style={{ fontSize: "0.72rem", color: "var(--ax-text-faint)" }}>{p.adminEmail}</small>
              </div>
            </div>
            <DsButton variant="ghost" size="sm" leadingIcon={<DsIcon name="logout" size={15} />} onClick={() => signOut({ callbackUrl: "/auth/login" })}>Logout</DsButton>
          </div>
        </header>

        {/* scroll area */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          <div style={{ maxWidth: 1600, margin: "0 auto", padding: "1.6rem 2.2rem 3rem" }}>

            {/* completion banner */}
            {bannerStatus && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.9rem", padding: "0.85rem 1.1rem", marginBottom: "1.5rem", borderRadius: "var(--ax-radius-lg)", background: "var(--ax-accent-08)", border: "1px solid var(--ax-accent-22)" }}>
                <span style={{ flex: "0 0 auto", color: "var(--ax-accent-bright)" }}><DsIcon name="alert" size={19} /></span>
                <p style={{ margin: 0, flex: 1, fontSize: "0.86rem", lineHeight: 1.45 }}>
                  <b style={{ color: "var(--ax-accent-bright)" }}>
                    {bannerStatus === "draft" ? "Finish setting up your academy." : "Your academy profile is under review."}
                  </b>{" "}
                  <span style={{ color: "var(--ax-text-dim)" }}>Players won&apos;t appear to scouts until your academy is approved.</span>
                </p>
                {bannerStatus === "draft" && (
                  <Link href="/academy/onboarding" style={{ flexShrink: 0 }}>
                    <DsButton variant="fill" size="sm">Complete your profile →</DsButton>
                  </Link>
                )}
              </div>
            )}

            {/* heading */}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "1rem", marginBottom: "1.2rem", flexWrap: "wrap" }}>
              <div>
                <p style={kicker}>Academy Overview</p>
                <h1 style={{ fontFamily: "var(--ax-font-display)", textTransform: "uppercase", fontWeight: 400, lineHeight: 0.95, fontSize: "clamp(28px,3vw,40px)", margin: 0 }}>Dashboard</h1>
              </div>
            </div>

            {/* KPI cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0.9rem", marginBottom: "1.8rem" }}>
              <StatCard icon="players" label="Total Players" value={p.stats.total.toLocaleString("en-IN")} sub="Profiles in your roster" tone="accent" />
              <StatCard icon="dashboard" label="Verified Players" value={p.stats.verified.toLocaleString("en-IN")} sub="Identity Verified or higher" tone="ok" />
              <StatCard icon="eye" label="Scout Views" value="—" sub="Coming in V2" tone="neutral" placeholder />
              <StatCard icon="fitness" label="Players Live" value={p.stats.live.toLocaleString("en-IN")} sub="profile_status = Live" tone="blue" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "0.9rem", marginBottom: "1.8rem" }}>
              <div style={{ padding: "1rem 1.1rem", borderRadius: "var(--ax-radius-xl)", background: "var(--ax-card)", border: "1px solid var(--ax-border)", boxShadow: "var(--ax-shadow-card)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "0.85rem" }}>
                  <div>
                    <div style={{ fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.68rem", fontWeight: 700, color: "var(--ax-text-faint)" }}>Sessions & Attendance</div>
                    <div style={{ fontSize: "1rem", fontWeight: 700, marginTop: "0.2rem" }}>Quick attendance snapshot</div>
                  </div>
                  <Link href="/academy/sessions" style={{ textDecoration: "none" }}>
                    <DsButton variant="outline" size="sm" leadingIcon={<DsIcon name="calendar" size={14} />}>Open sessions</DsButton>
                  </Link>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.75rem" }}>
                  <MiniStat label="Today" value={p.sessionSummary.today_sessions} tone="accent" />
                  <MiniStat label="Upcoming" value={p.sessionSummary.upcoming_sessions} tone="blue" />
                  <MiniStat label="Marked" value={p.sessionSummary.marked_count} tone="ok" />
                </div>
              </div>
              <div style={{ padding: "1rem 1.1rem", borderRadius: "var(--ax-radius-xl)", background: "var(--ax-card)", border: "1px solid var(--ax-border)", boxShadow: "var(--ax-shadow-card)" }}>
                <div style={{ fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.68rem", fontWeight: 700, color: "var(--ax-text-faint)", marginBottom: "0.35rem" }}>Attendance totals</div>
                <div style={{ display: "grid", gap: "0.55rem" }}>
                  <SessionLine label="Present" value={p.sessionSummary.present_count} tone="ok" />
                  <SessionLine label="Absent" value={p.sessionSummary.absent_count} tone="bad" />
                  <SessionLine label="Late" value={p.sessionSummary.late_count} tone="orange" />
                  <SessionLine label="Unmarked" value={p.sessionSummary.unmarked_count} tone="neutral" />
                </div>
              </div>
            </div>

            {/* quick actions */}
            <div style={{ marginBottom: "1.8rem" }}>
              <p style={{ ...kicker, color: "var(--ax-text-dim)", letterSpacing: "0.14em" }}>Quick actions</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.9rem" }}>
                {[
                  { key: "player" as const, t: "Add Player", s: "Create a single player profile", icon: "plus" },
                  { key: "csv" as const, t: "Upload CSV", s: "Bulk-import from a spreadsheet", icon: "upload" },
                  { key: "coach" as const, t: "Add Coach", s: "Link a coach to your roster", icon: "coaches" },
                ].map((a) => (
                  <button key={a.key} onClick={() => setOpenModal(a.key)} style={{ display: "flex", alignItems: "center", gap: "0.85rem", textAlign: "left", cursor: "pointer",
                    padding: "1rem 1.1rem", borderRadius: "var(--ax-radius-lg)", background: "var(--ax-field)", border: "1px solid var(--ax-border)",
                    color: "var(--ax-text)", transition: "all 0.14s ease" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--ax-accent)"; e.currentTarget.style.background = "var(--ax-accent-08)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--ax-border)"; e.currentTarget.style.background = "var(--ax-field)"; }}>
                    <span style={{ width: 38, height: 38, flex: "0 0 auto", borderRadius: "var(--ax-radius-md)", display: "grid", placeItems: "center", background: "var(--ax-accent)", color: "var(--ax-text-on-accent)", boxShadow: "var(--ax-glow-accent)" }}>
                      <DsIcon name={a.icon} size={18} />
                    </span>
                    <span>
                      <b style={{ display: "block", fontSize: "0.92rem", fontWeight: 700 }}>{a.t}</b>
                      <small style={{ fontSize: "0.76rem", color: "var(--ax-text-dim)" }}>{a.s}</small>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* recent players table */}
            <div style={{ borderRadius: "var(--ax-radius-xl)", border: "1px solid var(--ax-border)", background: "var(--ax-card)", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", padding: "1rem 1.2rem", borderBottom: "1px solid var(--ax-border)" }}>
                <div>
                  <b style={{ fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "1rem" }}>Recent Players</b>
                  <small style={{ display: "block", fontSize: "0.74rem", color: "var(--ax-text-faint)" }}>Last 10 players added to your academy</small>
                </div>
                <Link href="/academy/players" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "0.78rem", fontWeight: 700, color: "var(--ax-accent-bright)", textDecoration: "none" }}>
                  View all players <DsIcon name="arrowRight" size={14} />
                </Link>
              </div>

              {p.recentPlayers.length === 0 ? (
                <div style={{ padding: "2.4rem 1rem", textAlign: "center", color: "var(--ax-text-faint)" }}>
                  <p style={{ margin: 0, fontWeight: 700, color: "var(--ax-text)" }}>No players yet</p>
                  <p style={{ margin: "0.3rem 0 0", fontSize: "0.82rem" }}>Use the quick actions above to add your first player.</p>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.86rem" }}>
                    <thead>
                      <tr style={{ background: "var(--ax-bg-soft)" }}>
                        {["Name", "Role", "Verification", "Status", "Added On", ""].map((h, i) => (
                          <th key={i} style={{ textAlign: i === 5 ? "right" : "left", padding: "0.65rem 1.2rem", fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.66rem", fontWeight: 700, color: "var(--ax-text-faint)", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {p.recentPlayers.map((row) => {
                        const lvl = Math.max(1, Math.min(4, row.verification_level));
                        return (
                          <tr key={row.id} style={{ borderTop: "1px solid var(--ax-border)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ax-bg-elevated)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                            <td style={{ padding: "0.7rem 1.2rem", fontWeight: 600 }}>{row.name}</td>
                            <td style={{ padding: "0.7rem 1.2rem", color: "var(--ax-text-dim)" }}>{row.playing_role ?? "—"}</td>
                            <td style={{ padding: "0.7rem 1.2rem" }}><DsPill tone={VLEVEL_TONE[lvl]}>{VLEVEL_LABEL[lvl]}</DsPill></td>
                            <td style={{ padding: "0.7rem 1.2rem" }}><DsPill tone={STATUS_TONE[row.profile_status] ?? "neutral"} dot>{row.profile_status}</DsPill></td>
                            <td style={{ padding: "0.7rem 1.2rem", color: "var(--ax-text-faint)", whiteSpace: "nowrap" }}>
                              {row.created_at ? new Date(row.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                            </td>
                            <td style={{ padding: "0.7rem 1.2rem", textAlign: "right" }}>
                              <Link href={`/academy/players/${row.user_id ?? row.id}`} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontWeight: 700, color: "var(--ax-accent-bright)", textDecoration: "none" }}>
                                <DsIcon name="eye" size={14} /> View
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* ===== Modals ===== */}
      {openModal === "player" && (
        <Modal title="Add Player" onClose={() => setOpenModal(null)} width={720}>
          <AddPlayerForm variant="dark" onSuccess={() => {}} />
          <div style={{ marginTop: 14, textAlign: "right" }}>
            <DsButton variant="outline" onClick={() => { setOpenModal(null); router.refresh(); }}>Done</DsButton>
          </div>
        </Modal>
      )}
      {openModal === "csv" && (
        <Modal title="Bulk Upload Players" onClose={() => setOpenModal(null)} width={820}>
          <BulkCsvForm variant="dark" onSuccess={() => {}} />
          <div style={{ marginTop: 14, textAlign: "right" }}>
            <DsButton variant="outline" onClick={() => { setOpenModal(null); router.refresh(); }}>Done</DsButton>
          </div>
        </Modal>
      )}
      {openModal === "coach" && (
        <Modal title="Add Coach" onClose={() => setOpenModal(null)} width={640}>
          <AddCoachForm variant="dark" onSuccess={() => {}} />
          <div style={{ marginTop: 14, textAlign: "right" }}>
            <DsButton variant="outline" onClick={() => { setOpenModal(null); router.refresh(); }}>Done</DsButton>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children, width = 720 }: {
  title: string; onClose: () => void; children: React.ReactNode; width?: number;
}) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)", display: "grid", placeItems: "start center", padding: "40px 16px", overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: width, background: "var(--ax-card)", border: "1px solid var(--ax-border)", borderRadius: "var(--ax-radius-xl)", boxShadow: "var(--ax-shadow-pop)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.8rem", padding: "1rem 1.3rem", borderBottom: "1px solid var(--ax-border)" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0, color: "var(--ax-text)" }}>{title}</h3>
          <button onClick={onClose} aria-label="Close" style={{ width: 32, height: 32, borderRadius: "var(--ax-radius-sm)", border: "1px solid var(--ax-border)", background: "var(--ax-field)", fontSize: "1.2rem", lineHeight: 1, color: "var(--ax-text-dim)", cursor: "pointer" }}>×</button>
        </header>
        <div style={{ padding: "1.1rem 1.3rem 1.3rem", maxHeight: "70vh", overflowY: "auto" }}>{children}</div>
      </div>
    </div>
  );
}
