import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { isAdminRole, VISIBLE_STATUS } from "@/lib/authz";
import { initials, AVA_COLORS } from "@/lib/score-utils";
import { DsPill } from "@/app/_ds";

const VLEVEL_LABEL: Record<number, string> = { 1: "L1 Self", 2: "L2 Identity", 3: "L3 Performance", 4: "L4 Scout" };
const VLEVEL_TONE: Record<number, "neutral" | "accent" | "ok" | "blue"> = { 1: "neutral", 2: "accent", 3: "ok", 4: "blue" };

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
    <div style={{ minHeight: "100vh", padding: "1.6rem", background: "var(--ax-bg)", color: "var(--ax-text)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: "1.2rem" }}>
          <Link href="/scout/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.82rem", color: "var(--ax-text-dim)", textDecoration: "none", marginBottom: "0.6rem" }}>← Back to dashboard</Link>
          <h1 style={{ fontFamily: "var(--ax-font-display)", textTransform: "uppercase", fontWeight: 400, fontSize: "1.8rem", margin: "0.4rem 0 0" }}>
            Search Results {q && <>for &ldquo;{q}&rdquo;</>}
          </h1>
          <p style={{ color: "var(--ax-text-dim)", fontSize: "0.84rem", margin: "0.4rem 0 0" }}>
            {rows.length} player{rows.length === 1 ? "" : "s"} found
            {roleFilter && roleFilter !== "All" ? ` · Role: ${roleFilter}` : ""}
            {state && state !== "All States" ? ` · State: ${state}` : ""}
          </p>
        </div>

        <div style={{ overflow: "hidden", borderRadius: "var(--ax-radius-xl)", background: "var(--ax-card)", border: "1px solid var(--ax-border)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ background: "var(--ax-bg-soft)" }}>
                {["Player", "Role", "Age", "State", "Verification", "Profile", ""].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "0.6rem 1.1rem", fontFamily: "var(--ax-font-label)", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.62rem", fontWeight: 700, color: "var(--ax-text-faint)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: "center", padding: "1.6rem", color: "var(--ax-text-faint)" }}>No players match these filters.</td></tr>
              ) : rows.map((p, i) => (
                <tr key={p.user_id} style={{ borderTop: "1px solid var(--ax-border)" }}>
                  <td style={{ padding: "0.6rem 1.1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      <span style={{
                        width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center",
                        fontSize: "0.7rem", fontWeight: 700, color: "#fff",
                        background: `radial-gradient(circle at 32% 28%, ${AVA_COLORS[i % AVA_COLORS.length]}, rgba(0,0,0,0.55))`,
                      }}>{initials(p.name)}</span>
                      <div>
                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                        <div style={{ fontSize: "0.7rem", color: "var(--ax-text-faint)" }}>{[p.city, p.academy_name_custom || "Independent"].filter(Boolean).join(" · ")}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "0.6rem 1.1rem", color: "var(--ax-text-dim)", whiteSpace: "nowrap" }}>{p.playing_role}</td>
                  <td style={{ padding: "0.6rem 1.1rem" }}>{p.age ?? "—"}</td>
                  <td style={{ padding: "0.6rem 1.1rem", color: "var(--ax-text-dim)" }}>{p.state || "—"}</td>
                  <td style={{ padding: "0.6rem 1.1rem" }}><DsPill tone={VLEVEL_TONE[p.verification_level ?? 1]} size="sm">{VLEVEL_LABEL[p.verification_level ?? 1]}</DsPill></td>
                  <td style={{ padding: "0.6rem 1.1rem" }}>{p.profile_pct ?? 0}%</td>
                  <td style={{ padding: "0.6rem 1.1rem", textAlign: "right" }}>
                    <Link href={`/profile/${p.user_id}`} style={{ fontWeight: 700, color: "var(--ax-accent-bright)", textDecoration: "none" }}>View</Link>
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
