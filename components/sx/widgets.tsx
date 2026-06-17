/* SX helper widgets — React ports of sportx-fx.js (ring, verification level, initials) */

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Completion ring — SX.ring(pct, size, stroke) */
export function Ring({ pct, size = 46, stroke = 4.5 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2 - 1;
  const c = 2 * Math.PI * r;
  const fill = (Math.max(0, Math.min(100, pct)) / 100) * c;
  const col = pct >= 75 ? "#2EE07B" : pct >= 50 ? "#FBBF24" : "#F87171";
  const fs = Math.max(9, Math.round(size * 0.26));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${fill.toFixed(1)} ${(c - fill).toFixed(1)}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ filter: `drop-shadow(0 0 4px ${col}66)` }}
      />
      <text x={size / 2} y={size / 2 + fs * 0.36} textAnchor="middle" fill="#F2F4F2"
        fontSize={fs} fontWeight={700} fontFamily="Space Grotesk,monospace">
        {Math.round(pct)}
      </text>
    </svg>
  );
}

const VLVL = [
  { n: "L1", full: "Self Registered",     col: "#6A746C" },
  { n: "L2", full: "Identity Verified",   col: "#4D9FFF" },
  { n: "L3", full: "Performance Verified", col: "#2EE07B" },
  { n: "L4", full: "Scout Verified",      col: "#EAB308" },
];

/** Verification level chip — SX.vlvl(level, compact) */
export function Vlvl({ level, compact = false }: { level: number; compact?: boolean }) {
  const idx = Math.max(1, Math.min(4, level)) - 1;
  const v = VLVL[idx];
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        height: 20, padding: "0 9px", borderRadius: 99,
        background: `${v.col}14`, border: `1px solid ${v.col}45`,
        color: v.col, fontFamily: "var(--num)", fontSize: 9.5, fontWeight: 700,
        whiteSpace: "nowrap",
      }}
      title={v.full}
    >
      <span style={{
        width: 6, height: 6, borderRadius: "50%", background: v.col,
        boxShadow: `0 0 5px ${v.col}88`,
      }} />
      {compact ? v.n : `${v.n} · ${v.full}`}
    </span>
  );
}

/** Verification ladder (4 rungs) — used on the player profile hero */
export function Ladder({ level }: { level: number }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", maxWidth: 460, marginTop: 24 }}>
      {VLVL.map((v, i) => {
        const done = i < level;
        return (
          <div key={v.n} style={{ flex: 1, position: "relative", textAlign: "center" }}>
            {i > 0 && (
              <div style={{
                position: "absolute", top: 11, left: "-50%", right: "50%", height: 2,
                background: done ? "linear-gradient(90deg, var(--green-deep), var(--green))" : "var(--line2)",
                boxShadow: done ? "0 0 8px var(--green-glow)" : "none",
              }} />
            )}
            <div style={{
              position: "relative", zIndex: 1, width: 22, height: 22, margin: "0 auto",
              borderRadius: "50%", display: "grid", placeItems: "center",
              background: done ? "radial-gradient(circle at 32% 28%, #46ff97, #0e6e33 75%)" : "var(--card-base)",
              border: done ? "2px solid rgba(46,224,123,0.5)" : "2px solid var(--line2)",
              fontFamily: "var(--num)", fontSize: 9, fontWeight: 700,
              color: done ? "#04140A" : "var(--mut)",
              boxShadow: done ? "0 0 12px var(--green-glow)" : "none",
            }}>
              {done ? "✓" : `L${i + 1}`}
            </div>
            <div style={{
              fontSize: 8.5, letterSpacing: 0.8, textTransform: "uppercase",
              color: done ? "var(--green)" : "var(--mut)", marginTop: 6, lineHeight: 1.3,
              fontFamily: "var(--num)", fontWeight: 600,
            }}>
              {v.full.split(" ").map((w, j) => <span key={j}>{w}<br /></span>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
