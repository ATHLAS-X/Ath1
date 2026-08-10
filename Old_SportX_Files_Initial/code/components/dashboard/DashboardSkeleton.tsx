"use client";

import "@/app/athlasx.css";

/* Loading state used by app/profile/[userId]/page.tsx while server data
   fetches. Tracks the real player-profile layout (hero → 3-column main),
   uses athlasx.css tokens (no off-theme navy blue), and runs a single subtle
   pulse rather than the heavy shimmer sweep. */

export default function DashboardSkeleton() {
  return (
    <div className="sx-root sk-root">
      <style>{STYLES}</style>
      <div className="sk-shell">

        {/* Topbar */}
        <div className="sk-topbar">
          <Bar w={120} h={12} />
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <Bar w={90} h={26} />
            <Bar w={90} h={26} />
          </div>
        </div>

        {/* Hero */}
        <div className="sk-card sk-hero">
          <div className="sk-hero-left">
            <Bar w={100} h={10} />
            <div style={{ height: 14 }} />
            <Bar w={260} h={36} />
            <div style={{ height: 12 }} />
            <Bar w={180} h={12} />
            <div style={{ height: 22 }} />
            <div style={{ display: "flex", gap: 6 }}>
              {[60, 60, 60, 60, 60].map((w, i) => <Bar key={i} w={w} h={48} />)}
            </div>
          </div>
          <div className="sk-hero-right">
            <Bar w={80} h={10} />
            <div style={{ height: 10 }} />
            <Circle size={84} />
            <div style={{ height: 8 }} />
            <Bar w={80} h={18} />
          </div>
        </div>

        {/* Main 3-column grid */}
        <div className="sk-grid">
          {[1, 2, 3].map((col) => (
            <div key={col} className="sk-col">
              {[1, 2, 3].map((row) => (
                <div key={row} className="sk-card sk-section">
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                    <Bar w={110} h={10} />
                    <Bar w={50} h={16} />
                  </div>
                  <Bar w="100%" h={10} />
                  <div style={{ height: 6 }} />
                  <Bar w="80%" h={10} />
                  <div style={{ height: 6 }} />
                  <Bar w="65%" h={10} />
                  <div style={{ height: 12 }} />
                  <Bar w="100%" h={10} />
                  <div style={{ height: 6 }} />
                  <Bar w="70%" h={10} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Bar({ w, h }: { w: number | string; h: number }) {
  return <div className="sk-pulse" style={{ width: w, height: h, borderRadius: 6 }} />;
}

function Circle({ size }: { size: number }) {
  return <div className="sk-pulse" style={{ width: size, height: size, borderRadius: "50%" }} />;
}

const STYLES = `
@keyframes sk-pulse { 0%, 100% { opacity: 0.55; } 50% { opacity: 0.95; } }

.sk-root { min-height: 100vh; padding: 18px; }
.sk-shell { max-width: 1480px; margin: 0 auto; }

.sk-topbar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid var(--line); }

.sk-card { background: var(--card); border: 1px solid var(--line); border-radius: 12px; }
.sk-hero { display: flex; gap: 20px; padding: 24px 26px; margin-bottom: 14px; }
.sk-hero-left { flex: 1; min-width: 0; }
.sk-hero-right { width: 132px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; }

.sk-grid { display: grid; grid-template-columns: 30% 1fr 30%; gap: 14px; }
@media (max-width: 1000px) { .sk-grid { grid-template-columns: 1fr; } }
.sk-col { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.sk-section { padding: 16px; }

.sk-pulse {
  background: linear-gradient(168deg, rgba(46,224,123,0.06), rgba(46,224,123,0.02));
  border: 1px solid var(--line);
  animation: sk-pulse 1.6s ease-in-out infinite;
}
`;
