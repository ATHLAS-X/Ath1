import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import AcademyAdminDashboard from "./AcademyAdminDashboard";

const VLEVEL_LABELS: Record<number, string> = {
  1: "Unverified",
  2: "Identity Verified",
  3: "Performance Verified",
  4: "Scout Verified",
};

export default async function AcademyDashboardServer() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "academy_admin") {
    redirect("/auth/login?from=/academy/dashboard");
  }
  const userId = (session.user as any).id as string;

  // ── Query 1: academy info ─────────────────────────────────────────────
  const academyRows = (await sql`
    SELECT id, academy_name, city, state, verification_status
    FROM academies
    WHERE user_id = ${userId}
    LIMIT 1
  `) as any[];

  if (!academyRows[0]) redirect("/onboarding/academy");
  const academy = academyRows[0];

  // ── Query 2: KPI counts ───────────────────────────────────────────────
  const kpiRows = (await sql`
    SELECT
      COUNT(*)::int                                                         AS total,
      COUNT(*) FILTER (WHERE COALESCE(profile_status, 'Draft') = 'Live')::int  AS live,
      COUNT(*) FILTER (WHERE COALESCE(verification_level, 1) >= 2)::int    AS verified
    FROM player_profiles
    WHERE academy_id = ${academy.id}
  `) as any[];
  const kpis = kpiRows[0] ?? { total: 0, live: 0, verified: 0 };

  // ── Query 3: recent 10 players ────────────────────────────────────────
  const playerRows = (await sql`
    SELECT
      pp.id,
      COALESCE(
        NULLIF(TRIM(COALESCE(pp.first_name, '') || ' ' || COALESCE(pp.last_name, '')), ''),
        u.name,
        'Player'
      )                                       AS name,
      pp.playing_role                         AS role,
      COALESCE(pp.verification_level, 1)      AS vlevel,
      COALESCE(pp.profile_status, 'Draft')    AS status,
      pp.created_at                           AS added,
      pp.claimed_at IS NOT NULL               AS claimed
    FROM player_profiles pp
    LEFT JOIN users u ON u.id = pp.user_id
    WHERE pp.academy_id = ${academy.id}
    ORDER BY pp.created_at DESC NULLS LAST
    LIMIT 10
  `) as any[];

  const players = playerRows.map((p: any) => ({
    id:      String(p.id),
    name:    String(p.name),
    role:    String(p.role ?? "—"),
    vlevel:  VLEVEL_LABELS[Number(p.vlevel)] ?? "Unverified",
    status:  String(p.status ?? "Draft"),
    added:   new Date(p.added).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
    claimed: Boolean(p.claimed),
  }));

  return (
    <AcademyAdminDashboard
      academy={{
        name:               String(academy.academy_name),
        city:               String(academy.city ?? ""),
        state:              String(academy.state ?? ""),
        verificationStatus: String(academy.verification_status ?? "PENDING"),
      }}
      kpis={{
        total:    Number(kpis.total),
        live:     Number(kpis.live),
        verified: Number(kpis.verified),
      }}
      players={players}
    />
  );
}
