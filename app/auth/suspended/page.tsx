export default function SuspendedPage() {
  return (
    <div
      className="sx-root"
      style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}
    >
      <div className="card" style={{ maxWidth: 480, padding: 32, textAlign: "center" }}>
        <div className="sect-title" style={{ marginBottom: 12, color: "var(--red)" }}>
          Account Suspended
        </div>
        <h1
          style={{
            fontFamily: "var(--num)",
            fontSize: 26,
            fontWeight: 700,
            marginBottom: 8,
          }}
        >
          Access disabled
        </h1>
        <p style={{ color: "var(--mut)", fontSize: 13, marginBottom: 20 }}>
          Your account has been suspended by AthlasX Admin. Contact support to
          appeal or learn more.
        </p>
        <a
          href="mailto:support@athlasx.in"
          className="btn"
          style={{ display: "inline-flex", width: "100%", justifyContent: "center", textDecoration: "none" }}
        >
          Contact support
        </a>
      </div>
    </div>
  );
}
