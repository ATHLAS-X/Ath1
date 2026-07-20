import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { initials, AVA_COLORS } from "@/lib/score-utils";

export const dynamic = "force-dynamic";

export default async function ScoutNotesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login?from=/scout/notes");
  if ((session.user as any).role !== "scout") redirect("/dashboard");
  const scoutId = (session.user as any).id as string;

  const rows = (await sql`
    SELECT sn.player_user_id, sn.body, sn.updated_at, u.name AS player_name
    FROM scout_notes sn
    JOIN users u ON u.id = sn.player_user_id
    WHERE sn.scout_user_id = ${scoutId} AND sn.body <> ''
    ORDER BY sn.updated_at DESC
  `) as unknown as any[];

  return (
    <div style={{ minHeight: "100vh", padding: "1.6rem", background: "var(--ax-bg)", color: "var(--ax-text)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <Link href="/scout/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.82rem", color: "var(--ax-text-dim)", textDecoration: "none", marginBottom: "0.6rem" }}>← Back to dashboard</Link>
        <h1 style={{ fontFamily: "var(--ax-font-display)", textTransform: "uppercase", fontWeight: 400, fontSize: "1.8rem", margin: "0.4rem 0 0.4rem" }}>My Notes</h1>
        <p style={{ color: "var(--ax-text-dim)", fontSize: "0.84rem", marginBottom: "1rem" }}>{rows.length} note{rows.length === 1 ? "" : "s"}</p>

        {rows.length === 0 ? (
          <div style={{ padding: "1.8rem", textAlign: "center", color: "var(--ax-text-faint)", borderRadius: "var(--ax-radius-xl)", background: "var(--ax-card)", border: "1px solid var(--ax-border)" }}>
            No notes yet — open a player profile and add one to see it here.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {rows.map((n, i) => (
              <div key={n.player_user_id} style={{ padding: "0.9rem", borderRadius: "var(--ax-radius-xl)", background: "var(--ax-card)", border: "1px solid var(--ax-border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.5rem" }}>
                  <span style={{
                    width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center",
                    fontSize: "0.65rem", fontWeight: 700, color: "#fff",
                    background: `radial-gradient(circle at 32% 28%, ${AVA_COLORS[i % AVA_COLORS.length]}, rgba(0,0,0,0.55))`,
                  }}>{initials(n.player_name)}</span>
                  <Link href={`/profile/${n.player_user_id}`} style={{ fontWeight: 600, fontSize: "0.86rem", color: "var(--ax-text)", textDecoration: "none" }}>
                    {n.player_name}
                  </Link>
                  <span style={{ marginLeft: "auto", fontSize: "0.68rem", color: "var(--ax-text-faint)" }}>
                    {new Date(n.updated_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--ax-text-dim)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{n.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
