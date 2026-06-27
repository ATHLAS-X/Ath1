import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { initials, AVA_COLORS } from "@/lib/score-utils";
import { DsPill } from "@/app/_ds";

const VLEVEL_LABEL: Record<number, string> = { 1: "L1 Self", 2: "L2 Identity", 3: "L3 Performance", 4: "L4 Scout" };
const VLEVEL_TONE: Record<number, "neutral" | "accent" | "ok" | "blue"> = { 1: "neutral", 2: "accent", 3: "ok", 4: "blue" };

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
    <div style={{ minHeight: "100vh", padding: "1.6rem", background: "var(--ax-bg)", color: "var(--ax-text)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <Link href="/scout/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.82rem", color: "var(--ax-text-dim)", textDecoration: "none", marginBottom: "0.6rem" }}>← Back to dashboard</Link>
        <h1 style={{ fontFamily: "var(--ax-font-display)", textTransform: "uppercase", fontWeight: 400, fontSize: "1.8rem", margin: "0.4rem 0 0.4rem" }}>My Watchlist</h1>
        <p style={{ color: "var(--ax-text-dim)", fontSize: "0.84rem", marginBottom: "1rem" }}>{rows.length} player{rows.length === 1 ? "" : "s"} shortlisted</p>

        <div style={{ overflow: "hidden", borderRadius: "var(--ax-radius-xl)", background: "var(--ax-card)", border: "1px solid var(--ax-border)" }}>
          {rows.length === 0 ? (
            <div style={{ padding: "1.8rem", textAlign: "center", color: "var(--ax-text-faint)" }}>
              No players shortlisted yet — star a player from{" "}
              <Link href="/scout/dashboard" style={{ color: "var(--ax-accent-bright)" }}>the dashboard</Link> to add them here.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {rows.map((p, i) => (
                <Link
                  key={p.user_id}
                  href={`/profile/${p.user_id}`}
                  style={{ display: "flex", alignItems: "center", gap: "0.8rem", padding: "0.75rem 1rem", textDecoration: "none", color: "inherit", borderTop: i === 0 ? "none" : "1px solid var(--ax-border)" }}
                >
                  <span style={{
                    width: 36, height: 36, borderRadius: "50%", display: "grid", placeItems: "center",
                    fontSize: "0.75rem", fontWeight: 700, color: "#fff",
                    background: `radial-gradient(circle at 32% 28%, ${AVA_COLORS[i % AVA_COLORS.length]}, rgba(0,0,0,0.55))`,
                  }}>{initials(p.name)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.86rem" }}>{p.name}</div>
                    <div style={{ fontSize: "0.7rem", color: "var(--ax-text-faint)" }}>{[p.city, p.state].filter(Boolean).join(", ")}</div>
                  </div>
                  <DsPill tone="neutral" size="sm">{p.playing_role}</DsPill>
                  <DsPill tone={VLEVEL_TONE[p.verification_level ?? 1]} size="sm">{VLEVEL_LABEL[p.verification_level ?? 1]}</DsPill>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
