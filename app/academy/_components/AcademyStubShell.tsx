"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

/* Reused sidebar + topbar wrapper for stub academy pages (e.g. Settings).
   Keeps nav consistent with /academy/dashboard so links don't break. */

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
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--ax-bg)", color: "var(--ax-text)", fontFamily: "var(--ax-font-body)" }}>
      <style>{STYLES}</style>

      <aside className="ss-sidebar">
        <div className="ss-brand">
          <div>
            <div className="ss-word">ATHLAS<em>X</em></div>
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
.ss-sidebar { width: 240px; flex-shrink: 0; background: var(--ax-bg-soft); color: var(--ax-text); display: flex; flex-direction: column; padding: 20px 14px; position: sticky; top: 0; height: 100vh; border-right: 1px solid var(--ax-border); }
.ss-brand { display: flex; align-items: center; gap: 11px; padding: 4px 4px 14px; }
.ss-word { font-family: var(--ax-font-display); font-size: 16px; font-weight: 700; letter-spacing: 0.05em; }
.ss-word em { font-style: normal; color: var(--ax-accent); }
.ss-sub { font-size: 10px; color: var(--ax-text-faint); letter-spacing: 1.5px; text-transform: uppercase; margin-top: 1px; }
.ss-nav { display: flex; flex-direction: column; gap: 4px; padding-top: 8px; }
.ss-link { display: block; padding: 10px 14px; border-radius: var(--ax-radius-md); color: var(--ax-text-dim); font-size: 13px; font-weight: 500; text-decoration: none; border-left: 3px solid transparent; }
.ss-link:hover { color: var(--ax-text); background: var(--ax-bg-elevated); }
.ss-link.on { background: var(--ax-accent-14); color: var(--ax-accent-bright); border-left-color: var(--ax-accent); }
.ss-topbar { display: flex; justify-content: space-between; align-items: center; padding: 18px 28px; background: rgba(13,13,13,0.6); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); border-bottom: 1px solid var(--ax-border); position: sticky; top: 0; z-index: 10; }
.ss-title h1 { font-size: 18px; font-weight: 700; color: var(--ax-text); margin: 0; }
.ss-tsub { font-size: 11.5px; color: var(--ax-text-faint); margin-top: 2px; }
.ss-logout { padding: 7px 12px; border-radius: var(--ax-radius-md); background: var(--ax-field); border: 1px solid var(--ax-border); color: var(--ax-text-dim); font-size: 12px; font-weight: 600; cursor: pointer; }
.ss-logout:hover { background: var(--ax-bad-soft); color: var(--ax-bad-text); border-color: var(--ax-bad); }
.ss-main { padding: 32px 28px; max-width: 800px; }
.ss-card { background: var(--ax-card); border: 1px solid var(--ax-border); border-radius: var(--ax-radius-xl); padding: 36px 32px; text-align: center; box-shadow: var(--ax-shadow-card); }
.ss-stub-icon { font-size: 38px; }
.ss-h2 { font-size: 22px; font-weight: 700; color: var(--ax-text); margin: 10px 0 6px; font-family: var(--ax-font-display); }
.ss-p { font-size: 13.5px; color: var(--ax-text-dim); line-height: 1.55; max-width: 460px; margin: 6px auto 0; }
.ss-note { font-size: 11.5px; color: var(--ax-text-faint); max-width: 460px; margin: 12px auto 0; font-style: italic; }
.ss-back { display: inline-block; margin-top: 22px; padding: 9px 16px; background: var(--ax-accent); color: var(--ax-text-on-accent); border-radius: var(--ax-radius-md); font-size: 12px; font-weight: 600; text-decoration: none; box-shadow: var(--ax-glow-accent); }
.ss-back:hover { background: var(--ax-accent-bright); }
@media (max-width: 800px) { .ss-sidebar { width: 60px; padding: 16px 8px; } .ss-link { padding: 10px 8px; font-size: 10px; text-align: center; } .ss-brand div:nth-child(2) { display: none; } }
`;
