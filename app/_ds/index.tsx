"use client";

import React, { useState, useRef, useCallback } from "react";

// ─── DsIcon ──────────────────────────────────────────────────────────────────

const DS_ICONS: Record<string, string> = {
  dashboard:  '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
  players:    '<circle cx="9" cy="8" r="3"/><path d="M3 21c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 3.5a3 3 0 0 1 0 5.8"/><path d="M21 21c0-2.5-1.5-4.6-3.6-5.5"/>',
  coaches:    '<path d="M4 19V7l8-3 8 3v12"/><path d="M9 21v-5h6v5"/><path d="M12 4v3"/>',
  fitness:    '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  brain:      '<path d="M9 3a3 3 0 0 0-3 3 3 3 0 0 0-1 5.8V15a3 3 0 0 0 4 2.8A3 3 0 0 0 12 19V5a3 3 0 0 0-3-2z"/><path d="M15 3a3 3 0 0 1 3 3 3 3 0 0 1 1 5.8V15a3 3 0 0 1-4 2.8A3 3 0 0 1 12 19"/>',
  milestone:  '<path d="M4 22V4h11l-2 3 2 3H6"/><line x1="4" y1="22" x2="4" y2="15"/>',
  settings:   '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 2.6 7a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 7 2.6h.1A1.6 1.6 0 0 0 9 1.1V1a2 2 0 1 1 4 0v.1A1.6 1.6 0 0 0 15 2.6a1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 2.7v.1A1.6 1.6 0 0 0 23 11h-.1A1.6 1.6 0 0 0 21.4 13z"/>',
  workflow:   '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M8.5 6H16M6 8.5V14a2 2 0 0 0 2 2h2M18 8.5V14a2 2 0 0 1-2 2h-2"/>',
  search:     '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  star:       '<polygon points="12 2 15 9 22 9.3 16.5 14 18.5 21 12 17 5.5 21 7.5 14 2 9.3 9 9"/>',
  notes:      '<path d="M4 4h13l3 3v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><line x1="7" y1="9" x2="14" y2="9"/><line x1="7" y1="13" x2="16" y2="13"/><line x1="7" y1="17" x2="12" y2="17"/>',
  eye:        '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>',
  bell:       '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  check:      '<polyline points="20 6 9 17 4 11"/>',
  x:          '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  plus:       '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  edit:       '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  help:       '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  lock:       '<rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  video:      '<rect x="2" y="5" width="14" height="14" rx="2"/><path d="m16 10 6-3v10l-6-3z"/>',
  shield:     '<path d="M12 3l7 3v6c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z"/>',
  spark:      '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>',
  logout:     '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  alert:      '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  building:   '<path d="M3 21h18"/><path d="M5 21V9l7-5 7 5v12"/><path d="M9 21v-6h6v6"/>',
  arrowRight: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  chevron:    '<polyline points="9 18 15 12 9 6"/>',
  upload:     '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  download:   '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  send:       '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  chart:      '<path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="6"/><rect x="12" y="7" width="3" height="10"/><rect x="17" y="13" width="3" height="4"/>',
  assigned:   '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="m9 14 2 2 4-4"/>',
  home:       '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/>',
  badge:      '<circle cx="12" cy="9" r="6"/><path d="M9 14.5 8 22l4-2 4 2-1-7.5"/>',
};

export function DsIcon({
  name,
  size = 18,
  stroke = 2,
  style,
}: {
  name: string;
  size?: number;
  stroke?: number;
  style?: React.CSSProperties;
}) {
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
      dangerouslySetInnerHTML={{ __html: DS_ICONS[name] ?? "" }}
    />
  );
}

// ─── DsPill ──────────────────────────────────────────────────────────────────

type PillTone = "neutral" | "accent" | "ok" | "bad" | "blue" | "orange" | "purple" | "ghost";
type PillSize = "sm" | "md";

const PILL_TONE: Record<PillTone, { bg: string; border: string; text: string }> = {
  neutral: { bg: "var(--ax-field)",             border: "var(--ax-border)",           text: "var(--ax-text)"       },
  accent:  { bg: "var(--ax-accent-14)",          border: "var(--ax-accent)",           text: "var(--ax-accent-bright)" },
  ok:      { bg: "var(--ax-ok-soft)",            border: "var(--ax-ok-border)",        text: "var(--ax-ok)"         },
  bad:     { bg: "var(--ax-bad-soft)",           border: "var(--ax-bad)",              text: "var(--ax-bad-text)"   },
  blue:    { bg: "rgba(74,158,255,0.14)",        border: "rgba(74,158,255,0.55)",      text: "#7DBBFF"              },
  orange:  { bg: "rgba(255,159,67,0.16)",        border: "rgba(255,159,67,0.6)",       text: "#FFB35C"              },
  purple:  { bg: "rgba(167,139,250,0.16)",       border: "rgba(167,139,250,0.6)",      text: "#C4B5FD"              },
  ghost:   { bg: "transparent",                  border: "var(--ax-border)",           text: "var(--ax-text-faint)" },
};

const PILL_SIZE: Record<PillSize, { padding: string; fontSize: string }> = {
  sm: { padding: "0.18rem 0.55rem", fontSize: "0.64rem" },
  md: { padding: "0.24rem 0.65rem", fontSize: "0.7rem"  },
};

export function DsPill({
  tone = "neutral",
  dot = false,
  size = "md",
  children,
}: {
  tone?: PillTone;
  dot?: boolean;
  size?: PillSize;
  children: React.ReactNode;
}) {
  const { bg, border, text } = PILL_TONE[tone];
  const { padding, fontSize } = PILL_SIZE[size];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.35rem",
        padding,
        borderRadius: "var(--ax-radius-pill)",
        border: `1px solid ${border}`,
        background: bg,
        color: text,
        fontFamily: "var(--ax-font-label)",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        lineHeight: 1.2,
        whiteSpace: "nowrap",
        fontSize,
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

// ─── DsAvatar ────────────────────────────────────────────────────────────────

export function DsAvatar({
  initial,
  size = 30,
  solid = false,
}: {
  initial: string;
  size?: number;
  solid?: boolean;
}) {
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
      {initial.slice(0, 2).toUpperCase()}
    </span>
  );
}

// ─── DsButton ────────────────────────────────────────────────────────────────

type BtnVariant = "fill" | "outline" | "ghost" | "text";
type BtnSize    = "sm" | "md" | "lg";

const BTN_VARIANT: Record<BtnVariant, React.CSSProperties> = {
  fill:    { background: "var(--ax-accent)", color: "var(--ax-text-on-accent)", border: "1.5px solid var(--ax-accent)", boxShadow: "var(--ax-glow-accent)" },
  outline: { background: "transparent",      color: "var(--ax-text)",           border: "1.5px solid var(--ax-border)" },
  ghost:   { background: "transparent",      color: "var(--ax-text)",           border: "1.5px solid var(--ax-border)" },
  text:    { background: "transparent",      color: "var(--ax-text-dim)",       border: "1.5px solid transparent"      },
};

const BTN_SIZE: Record<BtnSize, React.CSSProperties> = {
  sm: { padding: "0.5rem 0.95rem",  fontSize: "0.82rem" },
  md: { padding: "0.78rem 1.5rem",  fontSize: "0.92rem" },
  lg: { padding: "0.92rem 1.6rem",  fontSize: "1rem"    },
};

export function DsButton({
  variant = "fill",
  size = "md",
  disabled,
  block,
  leadingIcon,
  trailingIcon,
  onClick,
  type = "button",
  style: propStyle,
  children,
}: {
  variant?: BtnVariant;
  size?: BtnSize;
  disabled?: boolean;
  block?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const hoverOverride: React.CSSProperties =
    hovered && !disabled
      ? variant === "fill"
        ? { background: "var(--ax-accent-bright)", boxShadow: "var(--ax-glow-accent-strong)" }
        : variant === "text"
        ? { color: "var(--ax-text)" }
        : { borderColor: "var(--ax-text)", background: "rgba(245,245,240,0.06)" }
      : {};

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
        fontFamily: "var(--ax-font-label)",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        borderRadius: "var(--ax-radius-md)",
        cursor: disabled ? "default" : "pointer",
        whiteSpace: "nowrap",
        opacity: disabled ? 0.4 : 1,
        transition: `all var(--ax-dur-fast) var(--ax-ease)`,
        width: block ? "100%" : "auto",
        transform: pressed && !disabled ? "translateY(1px)" : "translateY(0)",
        ...BTN_VARIANT[variant],
        ...BTN_SIZE[size],
        ...hoverOverride,
        ...propStyle,
      }}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
}

// ─── DsToast ─────────────────────────────────────────────────────────────────

export function DsToast({
  message,
  fixed = false,
}: {
  message: string | null;
  fixed?: boolean;
}) {
  if (!message) return null;
  return (
    <div
      style={{
        position: fixed ? "fixed" : "absolute",
        bottom: "1.4rem",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        gap: "0.6rem",
        padding: "0.7rem 1.1rem",
        borderRadius: "var(--ax-radius-pill)",
        background: "var(--ax-bg-elevated)",
        border: "1px solid var(--ax-ok-border)",
        boxShadow: "var(--ax-shadow-pop)",
        animation: "acFade 0.18s ease-out",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "var(--ax-ok)",
          boxShadow: "0 0 8px var(--ax-ok)",
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: "0.86rem", fontWeight: 600 }}>{message}</span>
    </div>
  );
}

// ─── DsInput / DsSelect / DsChip ─────────────────────────────────────────────

const FIELD_STYLE: React.CSSProperties = {
  width: "100%",
  padding: "0.6rem 0.8rem",
  borderRadius: "var(--ax-radius-md)",
  background: "var(--ax-field)",
  border: "1px solid var(--ax-border)",
  color: "var(--ax-text)",
  fontFamily: "var(--ax-font-body)",
  fontSize: "0.86rem",
  outline: "none",
};

export const DsInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function DsInput({ style, ...props }, ref) {
    return <input ref={ref} {...props} style={{ ...FIELD_STYLE, ...style }} />;
  }
);

export const DsSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function DsSelect({ style, children, ...props }, ref) {
    return (
      <select ref={ref} {...props} style={{ ...FIELD_STYLE, cursor: "pointer", ...style }}>
        {children}
      </select>
    );
  }
);

export function DsChip({
  selected,
  onToggle,
  children,
}: {
  selected?: boolean;
  onToggle?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        height: 25,
        padding: "0 0.7rem",
        borderRadius: "var(--ax-radius-pill)",
        display: "inline-flex",
        alignItems: "center",
        background: selected ? "var(--ax-accent-14)" : "var(--ax-field)",
        border: `1px solid ${selected ? "var(--ax-accent)" : "var(--ax-border)"}`,
        color: selected ? "var(--ax-accent-bright)" : "var(--ax-text-dim)",
        fontFamily: "var(--ax-font-label)",
        fontSize: "0.66rem",
        fontWeight: 700,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

// ─── useToast ────────────────────────────────────────────────────────────────

export function useToast() {
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((text: string) => {
    setToast(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  return { toast, showToast };
}
