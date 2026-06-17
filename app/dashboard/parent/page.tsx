export default function ParentDashboardPlaceholder() {
  return (
    <div className="sx-root" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="card" style={{ maxWidth: 520, padding: 32, textAlign: "center" }}>
        <div className="sect-title" style={{ marginBottom: 8 }}>Parent / Guardian</div>
        <h1 style={{ fontFamily: "var(--num)", fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
          Coming soon
        </h1>
        <p style={{ color: "var(--mut)", fontSize: 13 }}>
          View linked players, consent settings, scout activity notifications.
        </p>
      </div>
    </div>
  );
}
