"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

/* Reused sidebar + topbar wrapper for the not-yet-built academy pages
   (Players list / Coaches / Fitness / Settings). Keeps nav consistent
   with /academy/dashboard so links don't break. */

interface Props {
  title: string;
  sub: string;
  desc: string;
  note?: string;
}

const NAV = [
  { label: "Dashboard",              href: "/academy/dashboard" },
  { label: "Players",                href: "/academy/players" },
  { label: "Coaches",                href: "/academy/coaches" },
  { label: "Fitness & Assessments",  href: "/academy/fitness" },
  { label: "Settings",               href: "/academy/settings" },
];

export default function AcademyStubShell({ title, sub, desc, note }: Props) {
  const pathname = usePathname() ?? "";
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F5F5F5", color: "#0F172A", fontFamily: "'Instrument Sans', system-ui, sans-serif" }}>
      <style>{STYLES}</style>

      <aside className="ss-sidebar">
        <div className="ss-brand">
          <div className="ss-ball" />
          <div>
            <div className="ss-word">SPORT<em>X</em></div>
            <div className="ss-sub">Academy admin</div>
          </div>
        </div>
        <nav className="ss-nav">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} className={`ss-link${active ? " on" : ""}`}>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div style={{ flex: 1, minWidth: 0 }}>
        <header className="ss-topbar">
          <div className="ss-title">
            <h1>{title}</h1>
            <div className="ss-tsub">{sub}</div>
          </div>
          <button className="ss-logout" onClick={() => signOut({ callbackUrl: "/auth/login" })}>Logout</button>
        </header>

        <main className="ss-main">
          <div className="ss-card">
            <div className="ss-stub-icon">🚧</div>
            <h2 className="ss-h2">{title} coming soon</h2>
            <p className="ss-p">{desc}</p>
            {note && <p className="ss-note">{note}</p>}
            <Link href="/academy/dashboard" className="ss-back">← Back to Dashboard</Link>
          </div>
        </main>
      </div>
    </div>
  );
}

const STYLES = `
.ss-sidebar { width: 240px; flex-shrink: 0; background: #0A1628; color: #F1F5F9; display: flex; flex-direction: column; padding: 20px 14px; position: sticky; top: 0; height: 100vh; }
.ss-brand { display: flex; align-items: center; gap: 11px; padding: 4px 4px 14px; }
.ss-ball { width: 28px; height: 28px; border-radius: 50%; background: radial-gradient(circle at 32% 28%, #46ff97, #0e6e33 72%); box-shadow: 0 0 16px rgba(46,224,123,0.45); flex-shrink: 0; }
.ss-word { font-family: 'Space Grotesk', monospace; font-size: 16px; font-weight: 700; letter-spacing: 0.05em; }
.ss-word em { font-style: normal; color: #22C55E; }
.ss-sub { font-size: 10px; color: #94A3B8; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 1px; }
.ss-nav { display: flex; flex-direction: column; gap: 4px; padding-top: 8px; }
.ss-link { display: block; padding: 10px 14px; border-radius: 9px; color: #94A3B8; font-size: 13px; font-weight: 500; text-decoration: none; border-left: 3px solid transparent; }
.ss-link:hover { color: #F1F5F9; background: rgba(255,255,255,0.04); }
.ss-link.on { background: rgba(34,197,94,0.12); color: #FFFFFF; border-left-color: #22C55E; }
.ss-topbar { display: flex; justify-content: space-between; align-items: center; padding: 18px 28px; background: #FFFFFF; border-bottom: 1px solid #E2E8F0; }
.ss-title h1 { font-size: 18px; font-weight: 700; color: #0F172A; margin: 0; }
.ss-tsub { font-size: 11.5px; color: #64748B; margin-top: 2px; }
.ss-logout { padding: 7px 12px; border-radius: 7px; background: #F1F5F9; border: 1px solid #CBD5E1; color: #475569; font-size: 12px; font-weight: 600; cursor: pointer; }
.ss-main { padding: 32px 28px; max-width: 800px; }
.ss-card { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; padding: 36px 32px; text-align: center; }
.ss-stub-icon { font-size: 38px; }
.ss-h2 { font-size: 22px; font-weight: 700; color: #0F172A; margin: 10px 0 6px; font-family: 'Space Grotesk', monospace; }
.ss-p { font-size: 13.5px; color: #475569; line-height: 1.55; max-width: 460px; margin: 6px auto 0; }
.ss-note { font-size: 11.5px; color: #94A3B8; max-width: 460px; margin: 12px auto 0; font-style: italic; }
.ss-back { display: inline-block; margin-top: 22px; padding: 9px 16px; background: #22C55E; color: #FFFFFF; border-radius: 8px; font-size: 12px; font-weight: 600; text-decoration: none; }
.ss-back:hover { background: #16A34A; }
@media (max-width: 800px) { .ss-sidebar { width: 60px; padding: 16px 8px; } .ss-link { padding: 10px 8px; font-size: 10px; text-align: center; } .ss-brand div:nth-child(2) { display: none; } }
`;
