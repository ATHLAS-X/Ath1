"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

interface Props {
  role: string;
  title: string;
  lines: string[];
}

/**
 * Placeholder onboarding screen for non-player roles. Replaced with real
 * flows in a later phase.
 */
export default function OnboardingStub({ role, title, lines }: Props) {
  return (
    <div
      className="sx-root"
      style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}
    >
      <div className="card" style={{ maxWidth: 560, padding: 32 }}>
        <div className="sect-title" style={{ marginBottom: 8 }}>{role} Onboarding</div>
        <h1
          style={{
            fontFamily: "var(--num)",
            fontSize: 26,
            fontWeight: 700,
            marginBottom: 16,
          }}
        >
          {title}
        </h1>
        <ol style={{ paddingLeft: 18, color: "var(--mut)", fontSize: 13, lineHeight: 1.8 }}>
          {lines.map((l) => (
            <li key={l} style={{ marginBottom: 4 }}>{l}</li>
          ))}
        </ol>
        <div
          style={{
            marginTop: 18,
            padding: 12,
            background: "var(--amber-bg)",
            border: "1px solid var(--amber-bd)",
            borderRadius: 10,
            fontSize: 12,
            color: "var(--amber)",
          }}
        >
          🚧 This flow is being built. Your account is in <strong>PENDING</strong> status.
          Discovery features unlock once AthlasX Admin reviews and activates your account.
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <Link
            href="/"
            className="btn"
            style={{ flex: 1, display: "inline-flex", justifyContent: "center" }}
          >
            Back to home
          </Link>
          <button
            type="button"
            className="btn danger"
            style={{ flex: 1, justifyContent: "center" }}
            onClick={() => signOut({ callbackUrl: "/auth/login" })}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
