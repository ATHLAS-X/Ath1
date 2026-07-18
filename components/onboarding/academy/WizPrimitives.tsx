"use client";
import React, { useRef } from "react";

export const svgIcon = (path: string, sw = 2) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;

// ── Chips ─────────────────────────────────────────────────────────────────────
export function Chips({
  options, value, onChange, multi = false,
}: {
  options: string[];
  value: string | string[];
  onChange: (v: string | string[]) => void;
  multi?: boolean;
}) {
  function toggle(opt: string) {
    if (multi) {
      const arr = Array.isArray(value) ? value : [];
      onChange(arr.includes(opt) ? arr.filter((x) => x !== opt) : [...arr, opt]);
    } else {
      onChange(value === opt ? "" : opt);
    }
  }
  function isPressed(opt: string) {
    return multi ? (Array.isArray(value) && value.includes(opt)) : value === opt;
  }
  return (
    <div className="chips">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          className="chip"
          aria-pressed={isPressed(opt)}
          onClick={() => toggle(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// ── OptCards ──────────────────────────────────────────────────────────────────
export function OptCards({
  options, value, onChange,
}: {
  options: { value: string; label: string; sub?: string; icon?: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="cardset">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className="optcard"
          aria-pressed={value === opt.value}
          onClick={() => onChange(value === opt.value ? "" : opt.value)}
        >
          {opt.icon && (
            <span
              className="ico"
              dangerouslySetInnerHTML={{ __html: opt.icon }}
            />
          )}
          <span className="t">
            <b>{opt.label}</b>
            {opt.sub && <small>{opt.sub}</small>}
          </span>
        </button>
      ))}
    </div>
  );
}

// ── NumStep ───────────────────────────────────────────────────────────────────
export function NumStep({
  value, onChange, min = 0, max = 100,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="numstep">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
      />
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))}>+</button>
    </div>
  );
}

// ── OtpBoxes ──────────────────────────────────────────────────────────────────
export function OtpBoxes({
  value, onChange, disabled = false,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  function handleKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !value[i] && i > 0) refs.current[i - 1]?.focus();
  }
  function handleChange(i: number, ch: string) {
    const digit = ch.replace(/\D/, "").slice(-1);
    const next = [...value];
    next[i] = digit;
    onChange(next);
    if (digit && i < 5) refs.current[i + 1]?.focus();
  }
  function handlePaste(e: React.ClipboardEvent) {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6).split("");
    if (digits.length) {
      const next = [...value];
      digits.forEach((d, idx) => { next[idx] = d; });
      onChange(next);
      refs.current[Math.min(digits.length, 5)]?.focus();
      e.preventDefault();
    }
  }
  return (
    <div className="otp-boxes">
      {value.map((v, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          className={`otp-box${v ? " filled" : ""}`}
          value={v}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={handlePaste}
        />
      ))}
    </div>
  );
}

// ── Field ─────────────────────────────────────────────────────────────────────
export function Field({
  label, required, optional, children, error, full, className,
}: {
  label?: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
  error?: string;
  full?: boolean;
  className?: string;
}) {
  return (
    <div className={`field${error ? " invalid" : ""}${full ? " ffull" : ""}${className ? ` ${className}` : ""}`}>
      {label && (
        <label>
          {label}
          {required && <span className="req">*</span>}
          {optional && <span className="opt">(optional)</span>}
        </label>
      )}
      {children}
      {error && <p className="err">{error}</p>}
    </div>
  );
}
