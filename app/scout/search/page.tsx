import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { isAdminRole, VISIBLE_STATUS } from "@/lib/authz";
import { initials, roleColor, AVA_COLORS } from "@/lib/score-utils";
import { Vlvl, Ring } from "@/components/sx/widgets";

export const dynamic = "force-dynamic";

/* The dashboard's filter sidebar collects q/role/state/bowling/academy/
   maxAge/minRuns/minWickets/minLevel, but only role/state ever reached the
   server (the rest were dead UI — see ScoutDashboardClient.tsx's
   handleSearch). This page is the previously-missing destination for that
   "Apply Filters" button; it actually applies role/state/maxAge, since
   those are what the live schema can filter on today. */
export default async function ScoutSearchPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login?from=/scout/search");
  const role = (session.user as any).role as string | undefined;
  if (role !== "scout" && !isAdminRole(role)) redirect("/dashboard");

  const q = (searchParams.q ?? "").trim();
  const roleFilter = (searchParams.role ?? "").trim();
  const state = (searchParams.state ?? "").trim();
  const maxAge = parseInt(searchParams.maxAge ?? "100", 10) || 100;
  const admin = isAdminRole(role);

  const rows = (await sql`
    SELECT
      u.id AS user_id, u.name,
      COALESCE(pp.city, pp.district, '') AS city,
      COALESCE(pp.state, '') AS state,
      COALESCE(ac.academy_name, '') AS academy_name_custom,
      COALESCE(cp.player_role, pp.playing_role, 'Player') AS playing_role,
      COALESCE(pp.verification_level, 1) AS verification_level,
      EXTRACT(YEAR FROM AGE(pp.date_of_birth))::int AS age,
      (CASE WHEN pp.date_of_birth IS NOT NULL THEN 15 ELSE 0 END)
        + (CASE WHEN COALESCE(pp.state, '') <> '' THEN 10 ELSE 0 END)
        + (CASE WHEN pp.academy_id IS NOT NULL THEN 10 ELSE 0 END)
        + (CASE WHEN cp.player_role IS NOT NULL OR pp.playing_role IS NOT NULL THEN 15 ELSE 0 END)
        + 10 AS profile_pct
    FROM users u
    LEFT JOIN cricket_profile cp ON u.id = cp.user_id
    LEFT JOIN player_profiles pp ON u.id = pp.user_id
    LEFT JOIN academies ac ON pp.academy_id = ac.id
    WHERE u.role = 'player'
      AND (${admin} OR pp.visibility = ${VISIBLE_STATUS})
      AND (${q} = '' OR u.name ILIKE ${"%" + q + "%"} OR COALESCE(pp.city, '') ILIKE ${"%" + q + "%"})
      AND (${roleFilter} = '' OR ${roleFilter} = 'All' OR LOWER(COALESCE(cp.player_role, pp.playing_role, '')) ILIKE ${"%" + roleFilter.toLowerCase() + "%"})
      AND (${state} = '' OR ${state} = 'All States' OR pp.state = ${state})
      AND (pp.date_of_birth IS NULL OR EXTRACT(YEAR FROM AGE(pp.date_of_birth)) <= ${maxAge})
    ORDER BY u.created_at DESC
    LIMIT 50
  `) as unknown as any[];

  return (
    <div className="sx-root" style={{ minHeight: "100vh", padding: 24 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
          <div>
            <Link href="/scout/dashboard" className="btn" style={{ textDecoration: "none", marginBottom: 8, display: "inline-block" }}>← Back to dashboard</Link>
            <h1 className="sect-title" style={{ fontSize: 22, marginTop: 8 }}>
              Search Results {q && <>for &ldquo;{q}&rdquo;</>}
            </h1>
            <p style={{ color: "var(--mut)", fontSize: 12.5 }}>
              {rows.length} player{rows.length === 1 ? "" : "s"} found
              {roleFilter && roleFilter !== "All" ? ` · Role: ${roleFilter}` : ""}
              {state && state !== "All States" ? ` · State: ${state}` : ""}
            </p>
          </div>
        </div>

        <div className="card" style={{ overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--head)" }}>
                {["Player", "Role", "Age", "State", "Verification", "Profile", ""].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "9px 12px", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1.2, color: "var(--lbl)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: "center", padding: 28, color: "var(--mut)" }}>No players match these filters.</td></tr>
              ) : rows.map((p, i) => (
                <tr key={p.user_id} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: "9px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{
                        width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center",
                        fontSize: 11, fontWeight: 700, color: "#fff",
                        background: `radial-gradient(circle at 32% 28%, ${AVA_COLORS[i % AVA_COLORS.length]}, rgba(0,0,0,0.55))`,
                      }}>{initials(p.name)}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                        <div style={{ fontSize: 10.5, color: "var(--mut)" }}>{[p.city, p.academy_name_custom || "Independent"].filter(Boolean).join(" · ")}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "9px 12px" }}><span className={`bdg ${roleColor(p.playing_role)}`}>{p.playing_role}</span></td>
                  <td style={{ padding: "9px 12px" }}>{p.age ?? "—"}</td>
                  <td style={{ padding: "9px 12px", color: "#8B958D" }}>{p.state || "—"}</td>
                  <td style={{ padding: "9px 12px" }}><Vlvl level={p.verification_level ?? 1} compact /></td>
                  <td style={{ padding: "9px 12px" }}><Ring pct={p.profile_pct ?? 0} size={30} stroke={3} /></td>
                  <td style={{ padding: "9px 12px", textAlign: "right" }}>
                    <Link href={`/profile/${p.user_id}`} className="btn sm" style={{ textDecoration: "none" }}>View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
