export default function TournamentDashboardPlaceholder() {
  return (
    <div className="sx-root" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="card" style={{ maxWidth: 520, padding: 32, textAlign: "center" }}>
        <div className="sect-title" style={{ marginBottom: 8 }}>Tournament Dashboard</div>
        <h1 style={{ fontFamily: "var(--num)", fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
          Coming soon
        </h1>
        <p style={{ color: "var(--mut)", fontSize: 13 }}>
          Upload schedules, scorecards, match results — feeds verified data into player profiles.
        </p>
      </div>
    </div>
  );
}
