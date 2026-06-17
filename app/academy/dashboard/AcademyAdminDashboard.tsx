"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { AddCoachForm, AddPlayerForm, BulkCsvForm } from "@/components/academy/forms";

/* Academy Admin dashboard — the primary screen.
   Three-region layout: dark navy sidebar (sticky on desktop, collapsed to
   icons on mobile) · light grey main content · white cards + table. */

interface Stats { total: number; verified: number; live: number; scoutViews: number; }
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
  recentPlayers: PlayerRow[];
}

const NAV: Array<{ label: string; href: string; icon: React.ReactNode }> = [
  { label: "Dashboard",              href: "/academy/dashboard", icon: <IconHome /> },
  { label: "Players",                href: "/academy/players",   icon: <IconUsers /> },
  { label: "Coaches",                href: "/academy/coaches",   icon: <IconWhistle /> },
  { label: "Fitness & Assessments",  href: "/academy/fitness",   icon: <IconHeart /> },
  { label: "Settings",               href: "/academy/settings",  icon: <IconGear /> },
];

const VERIFICATION_META: Record<number, { label: string; bg: string; fg: string; border: string }> = {
  1: { label: "Unverified",            bg: "#F1F5F9", fg: "#475569", border: "#CBD5E1" },
  2: { label: "Identity Verified",     bg: "#FEF3C7", fg: "#92400E", border: "#FCD34D" },
  3: { label: "Performance Verified",  bg: "#DCFCE7", fg: "#15803D", border: "#86EFAC" },
  4: { label: "Scout Verified",        bg: "#DBEAFE", fg: "#1D4ED8", border: "#93C5FD" },
};

const PROFILE_STATUS_META: Record<string, { bg: string; fg: string }> = {
  "Draft":              { bg: "#F1F5F9", fg: "#475569" },
  "Pending Approval":   { bg: "#FEF3C7", fg: "#92400E" },
  "Live":               { bg: "#DCFCE7", fg: "#15803D" },
  "Rejected":           { bg: "#FEE2E2", fg: "#B91C1C" },
  "Changes Requested":  { bg: "#FFEDD5", fg: "#9A3412" },
};

export default function AcademyAdminDashboard(p: Props) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [openModal, setOpenModal] = useState<null | "player" | "csv" | "coach">(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const onModalSuccess = () => {
    setRefreshKey((k) => k + 1);
  };

  /* Show profile-completion banner while academy is still Draft or in review. */
  const bannerStatus = p.academy.profileStatus === "Draft" ? "draft"
    : p.academy.profileStatus === "Pending Approval" ? "pending"
    : null;

  const initials = p.adminName.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F5F5F5", color: "#0F172A", fontFamily: "'Instrument Sans', system-ui, sans-serif" }}>
      <style>{GLOBAL_STYLES}</style>

      {/* ═════ SIDEBAR ═════ */}
      <aside className="aa-sidebar">
        <div className="aa-brand">
          <div className="aa-logo-ball" />
          <div className="aa-brand-text">
            <div className="aa-brand-word">SPORT<em>X</em></div>
            <div className="aa-brand-sub">Academy admin</div>
          </div>
        </div>

        <nav className="aa-nav">
          {NAV.map((item) => {
            const active = pathname === item.href || (item.href !== "/academy/dashboard" && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} className={`aa-nav-item${active ? " on" : ""}`}>
                <span className="aa-nav-icon">{item.icon}</span>
                <span className="aa-nav-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="aa-side-footer">
          <div className="aa-side-acad">{p.academy.name}</div>
          {p.academy.location && <div className="aa-side-loc">{p.academy.location}</div>}
        </div>
      </aside>

      {/* ═════ MAIN ═════ */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Topbar */}
        <header className="aa-topbar">
          <div className="aa-top-name">
            {p.academy.logoUrl
              ? <img src={p.academy.logoUrl} alt="" className="aa-top-logo" />
              : <div className="aa-top-logo aa-top-logo--placeholder">🏏</div>}
            <div>
              <div className="aa-top-acad">{p.academy.name}</div>
              <StatusPill status={p.academy.profileStatus} />
            </div>
          </div>
          <div className="aa-top-right">
            <div className="aa-top-admin">
              <div className="aa-avatar">{initials}</div>
              <div className="aa-admin-meta">
                <div className="aa-admin-name">{p.adminName}</div>
                <div className="aa-admin-email">{p.adminEmail}</div>
              </div>
            </div>
            <button className="aa-logout" onClick={() => signOut({ callbackUrl: "/auth/login" })}>Logout</button>
          </div>
        </header>

        <main className="aa-main" key={refreshKey}>

          {/* ── Section 2: Profile banner ── */}
          {bannerStatus && (
            <div className={`aa-banner aa-banner--${bannerStatus}`}>
              <div className="aa-banner-icon">⚠</div>
              <div className="aa-banner-text">
                <div className="aa-banner-title">
                  {bannerStatus === "draft"
                    ? "Finish setting up your academy"
                    : "Your academy profile is under review"}
                </div>
                <div className="aa-banner-body">
                  Players won&apos;t appear to scouts until your academy is approved.
                </div>
              </div>
              {bannerStatus === "draft" && (
                <Link href="/academy/onboarding" className="aa-banner-cta">Complete your profile →</Link>
              )}
            </div>
          )}

          {/* ── Section 1: Stats row ── */}
          <section className="aa-stats">
            <StatCard label="Total Players"    value={p.stats.total}      hint="In your roster" />
            <StatCard label="Verified Players" value={p.stats.verified}   hint="Identity verified or higher" accent="#22C55E" />
            <StatCard label="Scout Views"      value={p.stats.scoutViews} hint="Coming in V2" muted />
            <StatCard label="Players Live"     value={p.stats.live}       hint="Profile status: Live" accent="#1D4ED8" />
          </section>

          {/* ── Section 4: Quick actions ── */}
          <section className="aa-actions">
            <QuickAction
              title="Add Player"
              desc="Single player form"
              accent="#22C55E"
              onClick={() => setOpenModal("player")}
              icon={<IconUserPlus />}
            />
            <QuickAction
              title="Upload CSV"
              desc="Bulk import from a spreadsheet"
              accent="#1D4ED8"
              onClick={() => setOpenModal("csv")}
              icon={<IconUpload />}
            />
            <QuickAction
              title="Add Coach"
              desc="Add a coach to your roster"
              accent="#7C3AED"
              onClick={() => setOpenModal("coach")}
              icon={<IconWhistle />}
            />
          </section>

          {/* ── Section 3: Recent players ── */}
          <section className="aa-card">
            <div className="aa-card-head">
              <div>
                <h3 className="aa-card-title">Recent Players</h3>
                <p className="aa-card-sub">Last 10 players added to your academy</p>
              </div>
              <Link href="/academy/players" className="aa-card-action">View all players →</Link>
            </div>

            {p.recentPlayers.length === 0 ? (
              <div className="aa-empty">
                <div className="aa-empty-icon">🏏</div>
                <div className="aa-empty-title">No players yet</div>
                <div className="aa-empty-body">Use the quick actions above to add your first player.</div>
              </div>
            ) : (
              <div className="aa-table-wrap">
                <table className="aa-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Verification Level</th>
                      <th>Profile Status</th>
                      <th>Added On</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.recentPlayers.map((row) => {
                      const meta = VERIFICATION_META[Math.max(1, Math.min(4, row.verification_level))]
                                   ?? VERIFICATION_META[1];
                      const psMeta = PROFILE_STATUS_META[row.profile_status]
                                     ?? PROFILE_STATUS_META["Draft"];
                      return (
                        <tr key={row.id}>
                          <td className="aa-td-name">{row.name}</td>
                          <td>{row.playing_role ?? "—"}</td>
                          <td>
                            <span className="aa-badge" style={{
                              background: meta.bg, color: meta.fg, border: `1px solid ${meta.border}`,
                            }}>
                              {meta.label}
                            </span>
                          </td>
                          <td>
                            <span className="aa-badge" style={{
                              background: psMeta.bg, color: psMeta.fg, border: "1px solid transparent",
                            }}>
                              {row.profile_status}
                            </span>
                          </td>
                          <td className="aa-td-muted">
                            {row.created_at
                              ? new Date(row.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                              : "—"}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <Link href={`/academy/players/${row.user_id ?? row.id}`} className="aa-link">View</Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

        </main>
      </div>

      {/* ═════ Modals ═════ */}
      {openModal === "player" && (
        <Modal title="Add Player" onClose={() => setOpenModal(null)} width={720}>
          <AddPlayerForm variant="light" onSuccess={() => { onModalSuccess(); }} />
          <div style={{ marginTop: 14, textAlign: "right" }}>
            <button onClick={() => { setOpenModal(null); router.refresh(); }} style={btnLight}>Done</button>
          </div>
        </Modal>
      )}
      {openModal === "csv" && (
        <Modal title="Bulk Upload Players" onClose={() => setOpenModal(null)} width={820}>
          <BulkCsvForm variant="light" onSuccess={() => { onModalSuccess(); }} />
          <div style={{ marginTop: 14, textAlign: "right" }}>
            <button onClick={() => { setOpenModal(null); router.refresh(); }} style={btnLight}>Done</button>
          </div>
        </Modal>
      )}
      {openModal === "coach" && (
        <Modal title="Add Coach" onClose={() => setOpenModal(null)} width={640}>
          <AddCoachForm variant="light" onSuccess={() => { onModalSuccess(); }} />
          <div style={{ marginTop: 14, textAlign: "right" }}>
            <button onClick={() => { setOpenModal(null); router.refresh(); }} style={btnLight}>Done</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─────────── Cards & widgets ─────────── */

function StatCard({ label, value, hint, accent, muted }: {
  label: string; value: number; hint: string; accent?: string; muted?: boolean;
}) {
  return (
    <div className="aa-stat">
      <div className="aa-stat-label">{label}</div>
      <div className="aa-stat-value" style={{ color: muted ? "#94A3B8" : (accent ?? "#0A1628") }}>
        {value.toLocaleString("en-IN")}
      </div>
      <div className="aa-stat-hint">{hint}</div>
    </div>
  );
}

function QuickAction({ title, desc, accent, onClick, icon }: {
  title: string; desc: string; accent: string; onClick: () => void; icon: React.ReactNode;
}) {
  return (
    <button className="aa-action" onClick={onClick}>
      <span className="aa-action-icon" style={{ background: `${accent}1A`, color: accent, border: `1px solid ${accent}55` }}>
        {icon}
      </span>
      <span className="aa-action-text">
        <span className="aa-action-title">{title}</span>
        <span className="aa-action-desc">{desc}</span>
      </span>
    </button>
  );
}

function StatusPill({ status }: { status: string }) {
  const meta = PROFILE_STATUS_META[status] ?? PROFILE_STATUS_META["Draft"];
  return (
    <span className="aa-badge" style={{
      background: meta.bg, color: meta.fg, border: "1px solid transparent",
    }}>
      {status}
    </span>
  );
}

function Modal({ title, onClose, children, width = 720 }: {
  title: string; onClose: () => void; children: React.ReactNode; width?: number;
}) {
  return (
    <div className="aa-modal-backdrop" onClick={onClose}>
      <div className="aa-modal" style={{ maxWidth: width }} onClick={(e) => e.stopPropagation()}>
        <header className="aa-modal-head">
          <h3 className="aa-modal-title">{title}</h3>
          <button onClick={onClose} className="aa-modal-close" aria-label="Close">×</button>
        </header>
        <div className="aa-modal-body">{children}</div>
      </div>
    </div>
  );
}

const btnLight: React.CSSProperties = {
  background: "#FFFFFF", border: "1px solid #CBD5E1", color: "#0F172A",
  padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
};

/* ─────────── Icons ─────────── */
function IconHome()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></svg>; }
function IconUsers()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.2" /><circle cx="17" cy="9" r="2.4" /><path d="M3 20c0-3.4 2.7-5.4 6-5.4s6 2 6 5.4" /><path d="M15.5 14.6c2.4 0 4.5 1.5 4.5 4.4" /></svg>; }
function IconWhistle() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12.5l8-3 7 3v3l-7 3-8-3z" /><circle cx="14" cy="14" r="2" /></svg>; }
function IconHeart()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11.5h4l2-4 3 8 2-4h7" /></svg>; }
function IconGear()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M22 12h-3M5 12H2M19 5l-2 2M7 17l-2 2M19 19l-2-2M7 7L5 5" /></svg>; }
function IconUserPlus(){ return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.5" /><path d="M3 20c0-3.4 2.7-5.5 6-5.5s6 2.1 6 5.5" /><path d="M19 8v6M16 11h6" /></svg>; }
function IconUpload()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="M7 8l5-5 5 5" /><path d="M3 17v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3" /></svg>; }

/* ─────────── Styles ─────────── */
const GLOBAL_STYLES = `
.aa-sidebar {
  width: 240px; flex-shrink: 0; background: #0A1628; color: #F1F5F9;
  display: flex; flex-direction: column; padding: 20px 14px; position: sticky; top: 0;
  height: 100vh; box-shadow: 1px 0 0 rgba(255,255,255,0.04);
}
.aa-brand { display: flex; align-items: center; gap: 11px; padding: 4px 4px 14px; }
.aa-logo-ball {
  width: 28px; height: 28px; border-radius: 50%;
  background: radial-gradient(circle at 32% 28%, #46ff97, #0e6e33 72%);
  box-shadow: 0 0 16px rgba(46,224,123,0.45), inset 0 -5px 8px rgba(0,0,0,0.35), inset 0 2px 3px rgba(255,255,255,0.4);
  position: relative; flex-shrink: 0;
}
.aa-brand-word { font-family: 'Space Grotesk', monospace; font-size: 16px; font-weight: 700; letter-spacing: 0.05em; }
.aa-brand-word em { font-style: normal; color: #22C55E; text-shadow: 0 0 12px rgba(34,197,94,0.55); }
.aa-brand-sub { font-size: 10px; color: #94A3B8; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 1px; }

.aa-nav { display: flex; flex-direction: column; gap: 4px; padding-top: 8px; }
.aa-nav-item {
  display: flex; align-items: center; gap: 11px; padding: 10px 12px; border-radius: 9px;
  color: #94A3B8; font-size: 13px; font-weight: 500; text-decoration: none;
  border-left: 3px solid transparent; transition: all 0.15s;
}
.aa-nav-item:hover { color: #F1F5F9; background: rgba(255,255,255,0.04); }
.aa-nav-item.on { background: rgba(34,197,94,0.12); color: #FFFFFF; border-left-color: #22C55E; }
.aa-nav-item.on .aa-nav-icon { color: #22C55E; }
.aa-nav-icon { width: 18px; height: 18px; flex-shrink: 0; color: #94A3B8; display: grid; place-items: center; }
.aa-nav-icon svg { width: 100%; height: 100%; }

.aa-side-footer { margin-top: auto; padding: 12px 4px; border-top: 1px solid rgba(255,255,255,0.05); }
.aa-side-acad { font-size: 12px; font-weight: 600; color: #F1F5F9; }
.aa-side-loc  { font-size: 11px; color: #64748B; margin-top: 2px; }

@media (max-width: 800px) {
  .aa-sidebar { width: 60px; padding: 16px 8px; }
  .aa-nav-label, .aa-brand-text, .aa-side-footer { display: none; }
  .aa-nav-item { justify-content: center; padding: 10px; }
}

.aa-topbar {
  display: flex; justify-content: space-between; align-items: center; gap: 16px;
  padding: 14px 28px; background: #FFFFFF; border-bottom: 1px solid #E2E8F0;
  position: sticky; top: 0; z-index: 10;
}
.aa-top-name { display: flex; align-items: center; gap: 12px; min-width: 0; }
.aa-top-logo { width: 38px; height: 38px; border-radius: 9px; object-fit: cover; background: #F1F5F9; flex-shrink: 0; }
.aa-top-logo--placeholder { display: grid; place-items: center; font-size: 18px; }
.aa-top-acad { font-size: 15px; font-weight: 700; color: #0F172A; }

.aa-top-right { display: flex; align-items: center; gap: 14px; }
.aa-top-admin { display: flex; align-items: center; gap: 9px; }
.aa-avatar {
  width: 34px; height: 34px; border-radius: 50%;
  background: linear-gradient(135deg, #22C55E, #1D4ED8);
  color: #FFF; display: grid; place-items: center;
  font-family: 'Space Grotesk', monospace; font-weight: 700; font-size: 12px;
}
.aa-admin-meta { line-height: 1.25; }
.aa-admin-name { font-size: 12.5px; font-weight: 600; color: #0F172A; }
.aa-admin-email { font-size: 10.5px; color: #64748B; }
.aa-logout {
  padding: 7px 12px; border-radius: 7px; background: #F1F5F9; border: 1px solid #CBD5E1;
  color: #475569; font-size: 12px; font-weight: 600; cursor: pointer;
}
.aa-logout:hover { background: #FEE2E2; color: #B91C1C; border-color: #FCA5A5; }

@media (max-width: 600px) { .aa-admin-meta { display: none; } }

.aa-main { padding: 24px 28px 48px; max-width: 1280px; }

/* Banner */
.aa-banner {
  display: flex; align-items: center; gap: 14px; padding: 14px 18px;
  border-radius: 11px; margin-bottom: 20px;
  background: #FEF3C7; border: 1px solid #FCD34D; color: #92400E;
}
.aa-banner--pending { background: #FEF3C7; border-color: #FCD34D; color: #92400E; }
.aa-banner--draft   { background: #FEF3C7; border-color: #FCD34D; color: #92400E; }
.aa-banner-icon { font-size: 18px; flex-shrink: 0; }
.aa-banner-text { flex: 1; min-width: 0; }
.aa-banner-title { font-size: 13.5px; font-weight: 700; }
.aa-banner-body  { font-size: 12px; margin-top: 2px; opacity: 0.9; }
.aa-banner-cta {
  background: #FBBF24; color: #422006; padding: 8px 14px; border-radius: 8px;
  font-size: 12px; font-weight: 700; text-decoration: none; flex-shrink: 0;
}
.aa-banner-cta:hover { background: #F59E0B; }

/* Stats */
.aa-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 20px; }
@media (max-width: 900px) { .aa-stats { grid-template-columns: repeat(2, 1fr); } }
.aa-stat { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; padding: 18px 18px 16px; }
.aa-stat-label { font-size: 11px; font-weight: 600; color: #64748B; letter-spacing: 0.6px; text-transform: uppercase; }
.aa-stat-value { font-family: 'Space Grotesk', monospace; font-size: 34px; font-weight: 700; line-height: 1.1; margin-top: 6px; }
.aa-stat-hint { font-size: 11px; color: #94A3B8; margin-top: 4px; }

/* Quick actions */
.aa-actions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 22px; }
@media (max-width: 800px) { .aa-actions { grid-template-columns: 1fr; } }
.aa-action {
  display: flex; align-items: center; gap: 14px; padding: 16px 18px;
  background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px;
  cursor: pointer; text-align: left; transition: all 0.15s;
}
.aa-action:hover { border-color: #22C55E; transform: translateY(-1px); box-shadow: 0 6px 14px -8px rgba(34,197,94,0.4); }
.aa-action-icon { width: 40px; height: 40px; border-radius: 10px; display: grid; place-items: center; flex-shrink: 0; }
.aa-action-icon svg { width: 22px; height: 22px; }
.aa-action-title { display: block; font-size: 13.5px; font-weight: 700; color: #0F172A; }
.aa-action-desc { display: block; font-size: 11.5px; color: #64748B; margin-top: 2px; }

/* Card */
.aa-card { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; }
.aa-card-head {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 18px 20px 14px; border-bottom: 1px solid #E2E8F0;
}
.aa-card-title { font-size: 15px; font-weight: 700; color: #0F172A; }
.aa-card-sub   { font-size: 11.5px; color: #64748B; margin-top: 2px; }
.aa-card-action { color: #22C55E; font-size: 12px; font-weight: 600; text-decoration: none; }
.aa-card-action:hover { text-decoration: underline; }

.aa-empty { padding: 38px 16px; text-align: center; color: #64748B; }
.aa-empty-icon { font-size: 30px; }
.aa-empty-title { font-size: 14px; font-weight: 700; color: #0F172A; margin-top: 6px; }
.aa-empty-body  { font-size: 12.5px; margin-top: 2px; }

/* Table */
.aa-table-wrap { overflow-x: auto; }
.aa-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.aa-table th {
  background: #F8FAFC; color: #475569; font-size: 10.5px; letter-spacing: 1px;
  text-transform: uppercase; font-weight: 600; padding: 11px 16px; text-align: left;
  border-bottom: 1px solid #E2E8F0;
}
.aa-table td { padding: 13px 16px; border-bottom: 1px solid #F1F5F9; color: #0F172A; }
.aa-table tbody tr { transition: background 0.13s; }
.aa-table tbody tr:hover { background: #ECFDF5; }
.aa-table tbody tr:last-child td { border-bottom: none; }
.aa-td-name { font-weight: 600; }
.aa-td-muted { color: #64748B; }
.aa-link { color: #22C55E; font-weight: 600; text-decoration: none; }
.aa-link:hover { text-decoration: underline; }

.aa-badge {
  display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 99px;
  font-family: 'Space Grotesk', monospace; font-size: 10.5px; font-weight: 600;
  letter-spacing: 0.2px;
}

/* Modal */
.aa-modal-backdrop {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(15,23,42,0.55); backdrop-filter: blur(2px);
  display: grid; place-items: start center; padding: 40px 16px; overflow-y: auto;
}
.aa-modal {
  width: 100%; background: #FFFFFF; border-radius: 14px;
  box-shadow: 0 20px 60px rgba(15,23,42,0.35);
  display: flex; flex-direction: column; overflow: hidden;
}
.aa-modal-head {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 16px 20px; border-bottom: 1px solid #E2E8F0;
}
.aa-modal-title { font-size: 16px; font-weight: 700; color: #0F172A; }
.aa-modal-close {
  width: 32px; height: 32px; border-radius: 8px; border: 1px solid #E2E8F0; background: #F8FAFC;
  font-size: 20px; line-height: 1; color: #475569; cursor: pointer;
}
.aa-modal-close:hover { background: #F1F5F9; color: #0F172A; }
.aa-modal-body { padding: 18px 20px 22px; max-height: 70vh; overflow-y: auto; }

/* ─── Mobile patches (Task 5) ─── */
@media (max-width: 640px) {
  .aa-sidebar { position: fixed; bottom: 0; left: 0; right: 0; top: auto; width: 100%; height: 60px; padding: 0; flex-direction: row; border-top: 1px solid rgba(255,255,255,0.08); z-index: 50; box-shadow: 0 -4px 14px rgba(0,0,0,0.2); }
  .aa-brand, .aa-side-footer { display: none; }
  .aa-nav { flex-direction: row; padding-top: 0; gap: 0; flex: 1; height: 100%; align-items: stretch; }
  .aa-nav-item { flex: 1; padding: 6px 4px; font-size: 9.5px; text-align: center; border-left: none; border-top: 3px solid transparent; line-height: 1.1; flex-direction: column; justify-content: center; gap: 4px; }
  .aa-nav-item.on { border-top-color: #22C55E; border-left-color: transparent; }
  .aa-nav-icon { width: 16px; height: 16px; }
  .aa-nav-label { display: block; }
  .aa-main { padding-bottom: 84px; }
  /* Stats stay 2x2 on small screens (already covered by 900px rule but
     this is the explicit mobile gate). */
  .aa-stats { grid-template-columns: repeat(2, 1fr); }
  .aa-actions { grid-template-columns: 1fr; }
  /* Modals full-screen on mobile. */
  .aa-modal-backdrop { padding: 0; align-items: stretch; }
  .aa-modal { max-width: 100% !important; max-height: 100vh; min-height: 100vh; border-radius: 0; display: flex; flex-direction: column; }
  .aa-modal-body { max-height: none; flex: 1; }
}
`;
