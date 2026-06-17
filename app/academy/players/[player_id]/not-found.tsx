import Link from "next/link";

/* Renders when the [player_id] route either has no row at all OR the row
   belongs to a different academy. Server page calls notFound() in both
   cases; the message is identical because we don't want to leak the
   existence of players from other academies. */

export default function PlayerNotFound() {
  return (
    <div style={{
      minHeight: "100vh", background: "#F5F5F5", color: "#0F172A",
      fontFamily: "'Instrument Sans', system-ui, sans-serif",
      display: "grid", placeItems: "center", padding: 24,
    }}>
      <div style={{
        background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 14,
        padding: "44px 36px", maxWidth: 460, width: "100%", textAlign: "center",
        boxShadow: "0 4px 14px rgba(15,23,42,0.06)",
      }}>
        <div style={{ fontSize: 42, marginBottom: 10 }}>🔍</div>
        <h1 style={{
          fontFamily: "'Space Grotesk', monospace",
          fontSize: 22, fontWeight: 700, color: "#0F172A", margin: "6px 0 8px",
        }}>Player not found</h1>
        <p style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.55, margin: "0 0 20px" }}>
          This player isn&apos;t in your academy roster. They may have been
          removed, or you might be following an old link.
        </p>
        <Link href="/academy/players" style={{
          display: "inline-block", padding: "10px 18px", borderRadius: 9,
          background: "#22C55E", color: "#FFFFFF", textDecoration: "none",
          fontWeight: 600, fontSize: 13,
        }}>
          ← Back to Players
        </Link>
      </div>
    </div>
  );
}
