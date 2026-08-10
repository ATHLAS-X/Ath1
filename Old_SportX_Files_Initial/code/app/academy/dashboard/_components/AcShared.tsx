"use client";

import React from "react";

// ─── Icon path map ───────────────────────────────────────────────────────────

const AC_ICONS: Record<string, string> = {
  dashboard:  '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
  players:    '<circle cx="9" cy="8" r="3"/><path d="M3 21c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 3.5a3 3 0 0 1 0 5.8"/><path d="M21 21c0-2.5-1.5-4.6-3.6-5.5"/>',
  coaches:    '<path d="M4 19V7l8-3 8 3v12"/><path d="M9 21v-5h6v5"/><path d="M12 4v3"/>',
  fitness:    '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  settings:   '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 2.6 7a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 7 2.6h.1A1.6 1.6 0 0 0 9 1.1V1a2 2 0 1 1 4 0v.1A1.6 1.6 0 0 0 15 2.6a1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 2.7v.1A1.6 1.6 0 0 0 23 11h-.1A1.6 1.6 0 0 0 21.4 13z"/>',
  plus:       '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  upload:     '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  download:   '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  eye:        '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>',
  bell:       '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  logout:     '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  alert:      '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  building:   '<path d="M3 21h18"/><path d="M5 21V9l7-5 7 5v12"/><path d="M9 21v-6h6v6"/>',
  arrowRight: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  x:          '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  search:     '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  chevron:    '<polyline points="9 18 15 12 9 6"/>',
};

// ─── AcIcon ──────────────────────────────────────────────────────────────────

interface AcIconProps {
  name: string;
  size?: number;
  stroke?: number;
  style?: React.CSSProperties;
}

export function AcIcon({ name, size = 18, stroke = 2, style }: AcIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      dangerouslySetInnerHTML={{ __html: AC_ICONS[name] ?? "" }}
    />
  );
}

// ─── AcPill ──────────────────────────────────────────────────────────────────

type PillTone = "neutral" | "accent" | "ok" | "bad" | "blue" | "orange";

const PILL_TONE: Record<PillTone, { bg: string; border: string; text: string }> = {
  neutral: { bg: "var(--ax-field)",           border: "var(--ax-border)",           text: "var(--ax-text)" },
  accent:  { bg: "var(--ax-accent-14)",        border: "var(--ax-accent)",           text: "var(--ax-accent-bright)" },
  ok:      { bg: "var(--ax-ok-soft)",          border: "var(--ax-ok-border)",        text: "var(--ax-ok)" },
  bad:     { bg: "var(--ax-bad-soft)",         border: "var(--ax-bad)",              text: "var(--ax-bad-text)" },
  blue:    { bg: "rgba(74,158,255,0.14)",      border: "rgba(74,158,255,0.55)",      text: "#7DBBFF" },
  orange:  { bg: "rgba(255,159,67,0.16)",      border: "rgba(255,159,67,0.6)",       text: "#FFB35C" },
};

interface AcPillProps {
  tone?: PillTone;
  dot?: boolean;
  children: React.ReactNode;
}

export function AcPill({ tone = "neutral", dot = false, children }: AcPillProps) {
  const { bg, border, text } = PILL_TONE[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.4rem",
        padding: "0.22rem 0.62rem",
        borderRadius: "var(--ax-radius-pill)",
        border: `1px solid ${border}`,
        background: bg,
        color: text,
        fontFamily: "var(--ax-font-label)",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        fontSize: "0.68rem",
        lineHeight: 1.2,
        whiteSpace: "nowrap",
      }}
    >
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "currentColor",
            boxShadow: "0 0 7px currentColor",
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}

// ─── AcAvatar ────────────────────────────────────────────────────────────────

interface AcAvatarProps {
  initial: string;
  size?: number;
  solid?: boolean;
}

export function AcAvatar({ initial, size = 30, solid = false }: AcAvatarProps) {
  return (
    <span
      style={{
        width: size,
        height: size,
        flex: "0 0 auto",
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
        background: solid ? "var(--ax-accent)" : "var(--ax-accent-14)",
        color: solid ? "var(--ax-text-on-accent)" : "var(--ax-accent-bright)",
        fontFamily: "var(--ax-font-label)",
        fontWeight: 700,
        fontSize: Math.round(size * 0.42),
        textTransform: "uppercase",
      }}
    >
      {initial.trim().slice(0, 2).toUpperCase()}
    </span>
  );
}
