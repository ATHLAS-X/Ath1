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
    <div className="sx-root" style={{ minHeight: "100vh", padding: 24 }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <Link href="/scout/dashboard" className="btn" style={{ textDecoration: "none", marginBottom: 8, display: "inline-block" }}>← Back to dashboard</Link>
        <h1 className="sect-title" style={{ fontSize: 22, marginTop: 8, marginBottom: 4 }}>My Notes</h1>
        <p style={{ color: "var(--mut)", fontSize: 12.5, marginBottom: 16 }}>{rows.length} note{rows.length === 1 ? "" : "s"}</p>

        {rows.length === 0 ? (
          <div className="card" style={{ padding: 28, textAlign: "center", color: "var(--mut)" }}>
            No notes yet — open a player profile and add one to see it here.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {rows.map((n, i) => (
              <div key={n.player_user_id} className="card" style={{ padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{
                    width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center",
                    fontSize: 10, fontWeight: 700, color: "#fff",
                    background: `radial-gradient(circle at 32% 28%, ${AVA_COLORS[i % AVA_COLORS.length]}, rgba(0,0,0,0.55))`,
                  }}>{initials(n.player_name)}</span>
                  <Link href={`/profile/${n.player_user_id}`} style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text)", textDecoration: "none" }}>
                    {n.player_name}
                  </Link>
                  <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--mut)" }}>
                    {new Date(n.updated_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--text)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{n.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
