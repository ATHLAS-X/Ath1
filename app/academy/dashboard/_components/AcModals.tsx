"use client";

import React, { useState, useRef } from "react";
import { AcIcon } from "./AcShared";

// ─── AcButton (local) ────────────────────────────────────────────────────────

type BtnVariant = "fill" | "ghost";
type BtnSize    = "sm" | "md";

function AcButton({
  variant,
  size = "md",
  disabled,
  onClick,
  type = "button",
  children,
}: {
  variant: BtnVariant;
  size?: BtnSize;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);

  const sizeStyle: React.CSSProperties =
    size === "sm"
      ? { padding: "0.5rem 0.95rem", fontSize: "0.82rem" }
      : { padding: "0.78rem 1.5rem", fontSize: "0.92rem" };

  const fillBase: React.CSSProperties = {
    background: "var(--ax-accent)",
    color: "var(--ax-text-on-accent)",
    border: "1.5px solid var(--ax-accent)",
    boxShadow: "var(--ax-glow-accent)",
  };
  const fillHover: React.CSSProperties = {
    background: "var(--ax-accent-bright)",
    border: "1.5px solid var(--ax-accent-bright)",
    boxShadow: "var(--ax-glow-accent-strong)",
    color: "var(--ax-text-on-accent)",
  };
  const ghostBase: React.CSSProperties = {
    background: "transparent",
    color: "var(--ax-text)",
    border: "1.5px solid var(--ax-border)",
  };
  const ghostHover: React.CSSProperties = {
    borderColor: "var(--ax-text)",
    background: "rgba(245,245,240,0.06)",
    color: "var(--ax-text)",
  };

  const variantStyle =
    variant === "fill"
      ? hovered && !disabled ? fillHover : fillBase
      : hovered && !disabled ? ghostHover : ghostBase;

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.5rem",
        fontFamily: "var(--ax-font-label)",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        borderRadius: "var(--ax-radius-md)",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1,
        whiteSpace: "nowrap",
        transition: "all var(--ax-dur-fast) var(--ax-ease)",
        ...sizeStyle,
        ...variantStyle,
      }}
    >
      {children}
    </button>
  );
}

// ─── AcField (local) ─────────────────────────────────────────────────────────

function AcField({
  label,
  required,
  optional,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: "1.05rem" }}>
      <label
        style={{
          display: "block",
          fontFamily: "var(--ax-font-label)",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          fontSize: "10.5px",
          fontWeight: 700,
          color: "var(--ax-text-dim)",
          margin: "0 0 0.5rem",
        }}
      >
        {label}
        {required && (
          <span style={{ color: "var(--ax-accent)", marginLeft: "0.15rem" }}>*</span>
        )}
        {optional && (
          <span style={{ color: "var(--ax-text-faint)", fontWeight: 500, letterSpacing: "0.05em", marginLeft: "0.3rem" }}>
            optional
          </span>
        )}
      </label>
      {children}
      {hint && (
        <p style={{ fontSize: "0.76rem", color: "var(--ax-text-faint)", margin: "0.45rem 0 0", lineHeight: 1.45 }}>
          {hint}
        </p>
      )}
    </div>
  );
}

// ─── AcInput (local) ─────────────────────────────────────────────────────────

function AcInput(props: React.InputHTMLAttributes<HTMLInputElement> & { style?: React.CSSProperties }) {
  const [focused, setFocused] = useState(false);
  const { style: propStyle, ...rest } = props;
  return (
    <input
      {...rest}
      onFocus={e => { setFocused(true); rest.onFocus?.(e); }}
      onBlur={e => { setFocused(false); rest.onBlur?.(e); }}
      style={{
        width: "100%",
        padding: "0.78rem 0.95rem",
        fontFamily: "var(--ax-font-body)",
        fontSize: "0.95rem",
        color: "var(--ax-text)",
        background: focused ? "var(--ax-field-focus)" : "var(--ax-field)",
        border: focused ? "1px solid var(--ax-accent)" : "1px solid var(--ax-border)",
        borderRadius: "var(--ax-radius-md)",
        outline: "none",
        boxSizing: "border-box",
        boxShadow: focused ? "var(--ax-focus-ring)" : "none",
        transition: "all var(--ax-dur-fast) var(--ax-ease)",
        ...propStyle,
      }}
    />
  );
}

// ─── AcSelect (local) ────────────────────────────────────────────────────────

function AcSelect(props: React.SelectHTMLAttributes<HTMLSelectElement> & { style?: React.CSSProperties }) {
  const [focused, setFocused] = useState(false);
  const { style: propStyle, ...rest } = props;
  return (
    <select
      {...rest}
      onFocus={e => { setFocused(true); rest.onFocus?.(e); }}
      onBlur={e => { setFocused(false); rest.onBlur?.(e); }}
      style={{
        width: "100%",
        padding: "0.78rem 0.95rem",
        fontFamily: "var(--ax-font-body)",
        fontSize: "0.95rem",
        color: "var(--ax-text)",
        background: focused ? "var(--ax-field-focus)" : "var(--ax-field)",
        border: focused ? "1px solid var(--ax-accent)" : "1px solid var(--ax-border)",
        borderRadius: "var(--ax-radius-md)",
        outline: "none",
        boxSizing: "border-box",
        boxShadow: focused ? "var(--ax-focus-ring)" : "none",
        appearance: "none",
        transition: "all var(--ax-dur-fast) var(--ax-ease)",
        ...propStyle,
      }}
    />
  );
}

// ─── AcModal (exported) ──────────────────────────────────────────────────────

export function AcModal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  width = 540,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 100,
        display: "grid",
        placeItems: "center",
        padding: "2rem",
        background: "rgba(5,5,5,0.66)",
        WebkitBackdropFilter: "blur(6px)",
        backdropFilter: "blur(6px)",
        animation: "acFade 0.18s ease-out",
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        style={{
          width: "100%",
          maxWidth: width,
          maxHeight: "100%",
          overflowY: "auto",
          background: "var(--ax-bg-soft)",
          border: "1px solid var(--ax-border)",
          borderRadius: "var(--ax-radius-xl)",
          boxShadow: "var(--ax-shadow-pop)",
          animation: "acRise 0.22s var(--ax-ease)",
        }}
      >
        {/* Header */}
        <div style={{ padding: "1.4rem 1.5rem 0.2rem", position: "relative" }}>
          {/* corner glow */}
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "var(--ax-corner-glow)" }} />
          <div style={{ position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
            <div>
              <h2 style={{
                fontFamily: "var(--ax-font-display)",
                textTransform: "uppercase",
                fontWeight: 400,
                lineHeight: 1,
                fontSize: "1.7rem",
                margin: "0 0 0.35rem",
                color: "var(--ax-text)",
              }}>
                {title}
              </h2>
              {subtitle && (
                <p style={{ margin: 0, fontSize: "0.86rem", color: "var(--ax-text-dim)" }}>{subtitle}</p>
              )}
            </div>
            <button
              onClick={onClose}
              style={{
                width: 34,
                height: 34,
                display: "grid",
                placeItems: "center",
                borderRadius: "var(--ax-radius-md)",
                border: "1px solid var(--ax-border)",
                background: "var(--ax-field)",
                color: "var(--ax-text-dim)",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <AcIcon name="x" size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "1.3rem 1.5rem" }}>{children}</div>

        {/* Footer */}
        {footer && (
          <div style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.6rem",
            padding: "1rem 1.5rem",
            borderTop: "1px solid var(--ax-border)",
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── AddPlayerModal ──────────────────────────────────────────────────────────

export function AddPlayerModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (msg: string) => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [email,     setEmail]     = useState("");
  const [dob,       setDob]       = useState("");
  const [role,      setRole]      = useState("");
  const [state,     setState]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");

  const handleSubmit = async () => {
    if (!firstName || !lastName || !dob || !role || !state) {
      setError("Please fill in all required fields.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/academy/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ first_name: firstName, last_name: lastName, email, dob, primary_role: role, state }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Something went wrong.");
        return;
      }
      onSuccess("Player added to roster — invite sent.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const STATES = ["Andhra Pradesh","Delhi","Goa","Gujarat","Karnataka","Kerala","Maharashtra","Punjab","Rajasthan","Tamil Nadu","Telangana","Uttar Pradesh","West Bengal"];

  return (
    <AcModal
      title="Add Player"
      subtitle="Create a single player profile in your roster."
      onClose={onClose}
      width={600}
      footer={
        <>
          <AcButton variant="ghost" onClick={onClose}>Cancel</AcButton>
          <AcButton variant="fill" disabled={loading} onClick={handleSubmit}>
            {loading ? "Adding…" : "Add Player"}
          </AcButton>
        </>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 1rem" }}>
        <AcField label="First Name" required>
          <AcInput value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Rohan" />
        </AcField>
        <AcField label="Last Name" required>
          <AcInput value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Sharma" />
        </AcField>
        <AcField label="Email" optional hint="An invite is sent so the player can claim the profile.">
          <AcInput type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="rohan@email.com" />
        </AcField>
        <AcField label="Date of Birth" required>
          <AcInput type="date" value={dob} onChange={e => setDob(e.target.value)} />
        </AcField>
        <AcField label="Primary Role" required>
          <AcSelect value={role} onChange={e => setRole(e.target.value)}>
            <option value="">Select role</option>
            <option>Batsman</option>
            <option>Bowler</option>
            <option>All-Rounder</option>
            <option>WK</option>
          </AcSelect>
        </AcField>
        <AcField label="State" required>
          <AcSelect value={state} onChange={e => setState(e.target.value)}>
            <option value="">Select state</option>
            {STATES.map(s => <option key={s}>{s}</option>)}
          </AcSelect>
        </AcField>
      </div>
      {error && <p style={{ color: "var(--ax-bad-text)", fontSize: "0.82rem", margin: "0.3rem 0 0" }}>{error}</p>}
    </AcModal>
  );
}

// ─── BulkCsvModal ────────────────────────────────────────────────────────────

export function BulkCsvModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (msg: string) => void }) {
  const [file,    setFile]    = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const text = await file.text();
      const res = await fetch("/api/academy/players/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: text }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const count = data.summary?.created ?? data.count ?? 0;
      onSuccess(`Imported ${count} players from ${file.name}.`);
    } catch {
      // swallow — modal stays open
    } finally {
      setLoading(false);
    }
  };

  return (
    <AcModal
      title="Upload CSV"
      subtitle="Bulk-import players from a spreadsheet."
      onClose={onClose}
      width={520}
      footer={
        <>
          <AcButton variant="ghost" onClick={onClose}>Cancel</AcButton>
          <AcButton variant="fill" disabled={!file || loading} onClick={handleSubmit}>
            {loading ? "Importing…" : "Import Players"}
          </AcButton>
        </>
      }
    >
      <label
        htmlFor="csv-upload"
        style={{
          display: "grid",
          placeItems: "center",
          gap: "0.7rem",
          padding: "2.2rem 1rem",
          textAlign: "center",
          cursor: "pointer",
          border: "1.5px dashed var(--ax-border-strong)",
          borderRadius: "var(--ax-radius-lg)",
          background: "var(--ax-field)",
        }}
      >
        <span style={{
          width: 46, height: 46, borderRadius: "50%",
          background: "var(--ax-accent-14)", color: "var(--ax-accent-bright)",
          display: "grid", placeItems: "center",
        }}>
          <AcIcon name="upload" size={22} />
        </span>
        <b style={{ fontSize: "0.95rem", color: "var(--ax-text)" }}>
          {file ? file.name : "Drop a CSV here or click to browse"}
        </b>
        <small style={{ fontSize: "0.78rem", color: "var(--ax-text-faint)" }}>
          Columns: first_name, last_name, email, dob, role, state
        </small>
        <input
          id="csv-upload"
          type="file"
          accept=".csv"
          style={{ display: "none" }}
          onChange={e => setFile(e.target.files?.[0] ?? null)}
        />
      </label>

      <a
        href="#"
        onClick={e => e.preventDefault()}
        style={{
          marginTop: "0.9rem",
          display: "inline-flex",
          alignItems: "center",
          gap: "0.4rem",
          fontSize: "0.82rem",
          fontWeight: 700,
          color: "var(--ax-accent-bright)",
          textDecoration: "none",
          cursor: "pointer",
        }}
      >
        <AcIcon name="download" size={14} /> Download template
      </a>
    </AcModal>
  );
}

// ─── AddCoachModal ───────────────────────────────────────────────────────────

export function AddCoachModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (msg: string) => void }) {
  const [coachName,       setCoachName]       = useState("");
  const [email,           setEmail]           = useState("");
  const [yearsExp,        setYearsExp]        = useState("");
  const [specialization,  setSpecialization]  = useState("");
  const [certifications,  setCertifications]  = useState("");
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState("");

  const handleSubmit = async () => {
    if (!coachName || !email || !specialization) {
      setError("Coach name, email, and specialization are required.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/academy/coaches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coach_name:       coachName,
          coach_email:      email,
          years_experience: yearsExp ? Number(yearsExp) : null,
          specialization,
          certifications,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Something went wrong.");
        return;
      }
      onSuccess("Coach added — status set to PENDING_REVIEW.");
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AcModal
      title="Add Coach"
      subtitle="Link a coach to your academy roster."
      onClose={onClose}
      width={580}
      footer={
        <>
          <AcButton variant="ghost" onClick={onClose}>Cancel</AcButton>
          <AcButton variant="fill" disabled={loading} onClick={handleSubmit}>
            {loading ? "Adding…" : "Add Coach"}
          </AcButton>
        </>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 1rem" }}>
        <AcField label="Coach Name" required>
          <AcInput value={coachName} onChange={e => setCoachName(e.target.value)} placeholder="Anil Kumar" />
        </AcField>
        <AcField label="Years of Experience" required>
          <AcInput type="number" min={0} value={yearsExp} onChange={e => setYearsExp(e.target.value)} placeholder="8" />
        </AcField>
        <AcField label="Email" required>
          <AcInput type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="anil@kca.in" />
        </AcField>
        <AcField label="Specialization" required>
          <AcSelect value={specialization} onChange={e => setSpecialization(e.target.value)}>
            <option value="">Select specialization</option>
            <option>Batting</option>
            <option>Pace bowling</option>
            <option>Spin bowling</option>
            <option>Fielding</option>
            <option>Wicket-keeping</option>
          </AcSelect>
        </AcField>
      </div>
      <AcField label="Certifications" optional hint="BCCI L1/L2, NIS, NCA or federation ID.">
        <AcInput
          value={certifications}
          onChange={e => setCertifications(e.target.value)}
          placeholder="e.g. BCCI Level 2"
        />
      </AcField>
      {error && <p style={{ color: "var(--ax-bad-text)", fontSize: "0.82rem", margin: "0.3rem 0 0" }}>{error}</p>}
    </AcModal>
  );
}
