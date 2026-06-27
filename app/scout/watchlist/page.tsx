import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { initials, roleColor, AVA_COLORS } from "@/lib/score-utils";
import { Vlvl } from "@/components/sx/widgets";

export const dynamic = "force-dynamic";

export default async function ScoutWatchlistPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login?from=/scout/watchlist");
  if ((session.user as any).role !== "scout") redirect("/dashboard");
  const scoutId = (session.user as any).id as string;

  const rows = (await sql`
    SELECT
      u.id AS user_id, u.name, ss.created_at AS shortlisted_at,
      COALESCE(pp.city, pp.district, '') AS city,
      COALESCE(pp.state, '') AS state,
      COALESCE(cp.player_role, pp.playing_role, 'Player') AS playing_role,
      COALESCE(pp.verification_level, 1) AS verification_level
    FROM scout_shortlist ss
    JOIN users u ON u.id = ss.player_user_id
    LEFT JOIN cricket_profile cp ON u.id = cp.user_id
    LEFT JOIN player_profiles pp ON u.id = pp.user_id
    WHERE ss.scout_user_id = ${scoutId}
    ORDER BY ss.created_at DESC
  `) as unknown as any[];

  return (
    <div className="sx-root" style={{ minHeight: "100vh", padding: 24 }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <Link href="/scout/dashboard" className="btn" style={{ textDecoration: "none", marginBottom: 8, display: "inline-block" }}>← Back to dashboard</Link>
        <h1 className="sect-title" style={{ fontSize: 22, marginTop: 8, marginBottom: 4 }}>My Watchlist</h1>
        <p style={{ color: "var(--mut)", fontSize: 12.5, marginBottom: 16 }}>{rows.length} player{rows.length === 1 ? "" : "s"} shortlisted</p>

        <div className="card" style={{ overflow: "hidden" }}>
          {rows.length === 0 ? (
            <div style={{ padding: 28, textAlign: "center", color: "var(--mut)" }}>
              No players shortlisted yet — star a player from{" "}
              <Link href="/scout/dashboard" style={{ color: "var(--green)" }}>the dashboard</Link> to add them here.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {rows.map((p, i) => (
                <Link
                  key={p.user_id}
                  href={`/profile/${p.user_id}`}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", textDecoration: "none", color: "inherit", borderTop: i === 0 ? "none" : "1px solid var(--line)" }}
                >
                  <span style={{
                    width: 36, height: 36, borderRadius: "50%", display: "grid", placeItems: "center",
                    fontSize: 12, fontWeight: 700, color: "#fff",
                    background: `radial-gradient(circle at 32% 28%, ${AVA_COLORS[i % AVA_COLORS.length]}, rgba(0,0,0,0.55))`,
                  }}>{initials(p.name)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: "var(--mut)" }}>{[p.city, p.state].filter(Boolean).join(", ")}</div>
                  </div>
                  <span className={`bdg ${roleColor(p.playing_role)}`}>{p.playing_role}</span>
                  <Vlvl level={p.verification_level ?? 1} compact />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
