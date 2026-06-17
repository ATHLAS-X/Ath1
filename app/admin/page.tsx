import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin-server";
import { sql } from "@/lib/db";
import AdminDashboardClient from "./AdminDashboardClient";

export const dynamic = "force-dynamic";

async function safe<T>(p: Promise<T>, fb: T): Promise<T> {
  try { return await p; } catch { return fb; }
}

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/login?from=/admin");
  const admin = await isAdminUser(session.user.id, (session.user as any).role);
  if (!admin) redirect("/dashboard");

  const [
    statsRows, verRows, approvalsP, approvalsA, approvalsS,
    consentRows, blockedRows, distRows, signupRows, activityRows,
  ] = await Promise.all([
    safe(sql`
      SELECT
        (SELECT COUNT(*) FROM users WHERE COALESCE(role,'player') = 'player')::int AS total_players,
        (SELECT COUNT(*) FROM player_profiles WHERE visibility = 'Scout Visible')::int AS scout_visible,
        (SELECT COUNT(*) FROM users WHERE role = 'scout' AND COALESCE(account_status,'pending') = 'active')::int AS active_scouts,
        (SELECT COUNT(*) FROM verifications WHERE status = 'Pending')::int AS pending_verifications
    ` as unknown as Promise<any[]>, [{}] as any[]),

    safe(sql`
      SELECT v.id, v.verification_type, v.evidence_url, v.created_at,
             pu.name AS player_name, su.name AS submitted_by
      FROM verifications v
      LEFT JOIN users pu ON pu.id = v.player_user_id
      LEFT JOIN users su ON su.id = v.submitted_by_user_id
      WHERE v.status = 'Pending'
      ORDER BY v.created_at ASC LIMIT 6
    ` as unknown as Promise<any[]>, [] as any[]),

    safe(sql`
      SELECT pp.id, COALESCE(pp.first_name || ' ' || pp.last_name, u.name, 'Player') AS name,
             pp.state, pp.submitted_at, pp.source_channel
      FROM player_profiles pp
      LEFT JOIN users u ON u.id = pp.user_id
      WHERE pp.profile_status = 'Pending Approval'
      ORDER BY pp.submitted_at ASC NULLS LAST LIMIT 6
    ` as unknown as Promise<any[]>, [] as any[]),

    safe(sql`
      SELECT a.id, a.academy_name AS name, a.state, a.submitted_at,
        (SELECT COUNT(*)::int FROM player_profiles pp WHERE pp.academy_id = a.id) AS player_count
      FROM academies a
      WHERE a.profile_status = 'Pending Approval'
      ORDER BY a.submitted_at ASC NULLS LAST LIMIT 4
    ` as unknown as Promise<any[]>, [] as any[]),

    safe(sql`
      /* Alias id → user_id so the client reading r.user_id finds the value
         (otherwise admin "Approve" sends id="" and the API 400s with
         "kind, id, action required"). */
      SELECT u.id AS user_id, u.name, u.email, u.created_at
      FROM users u
      WHERE u.role = 'scout' AND COALESCE(u.account_status,'pending') = 'pending'
      ORDER BY u.created_at ASC LIMIT 4
    ` as unknown as Promise<any[]>, [] as any[]),

    safe(sql`
      SELECT
        COUNT(*) FILTER (WHERE pp.date_of_birth > NOW() - INTERVAL '18 years')::int AS minors,
        COUNT(*) FILTER (
          WHERE pp.date_of_birth > NOW() - INTERVAL '18 years'
          AND EXISTS (
            SELECT 1 FROM player_consents pc
            WHERE pc.user_id = pp.user_id
              AND pc.profile_visibility_ok AND pc.media_upload_ok
              AND pc.scout_contact_ok AND pc.data_usage_ok
          )
        )::int AS minors_with_consent
      FROM player_profiles pp
      WHERE pp.user_id IS NOT NULL
    ` as unknown as Promise<any[]>, [{ minors: 0, minors_with_consent: 0 }] as any[]),

    safe(sql`
      SELECT COALESCE(pp.first_name || ' ' || pp.last_name, u.name, 'Player') AS name,
             EXTRACT(YEAR FROM AGE(pp.date_of_birth))::int AS age
      FROM player_profiles pp
      LEFT JOIN users u ON u.id = pp.user_id
      WHERE pp.user_id IS NOT NULL
        AND pp.date_of_birth > NOW() - INTERVAL '18 years'
        AND NOT EXISTS (
          SELECT 1 FROM player_consents pc
          WHERE pc.user_id = pp.user_id
            AND pc.profile_visibility_ok AND pc.media_upload_ok
            AND pc.scout_contact_ok AND pc.data_usage_ok
        )
      LIMIT 4
    ` as unknown as Promise<any[]>, [] as any[]),

    safe(sql`
      SELECT COALESCE(verification_level, 1) AS lvl, COUNT(*)::int AS c
      FROM player_profiles GROUP BY COALESCE(verification_level, 1)
    ` as unknown as Promise<any[]>, [] as any[]),

    safe(sql`
      SELECT u.id, u.name, u.created_at,
             COALESCE(pp.playing_role, 'Player') AS playing_role,
             COALESCE(pp.source_channel, 'Independent Player') AS source_channel,
             COALESCE(pp.state, '') AS state,
             COALESCE(pp.verification_level, 1) AS verification_level,
             COALESCE(pp.profile_status, 'Draft') AS profile_status
      FROM users u
      LEFT JOIN player_profiles pp ON pp.user_id = u.id
      WHERE COALESCE(u.role,'player') = 'player'
      ORDER BY u.created_at DESC LIMIT 8
    ` as unknown as Promise<any[]>, [] as any[]),

    safe(sql`
      SELECT
        TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS day,
        COUNT(*) FILTER (WHERE COALESCE(role,'player') = 'player')::int AS players,
        COUNT(*) FILTER (WHERE role = 'scout')::int AS scouts
      FROM users
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY DATE_TRUNC('day', created_at)
    ` as unknown as Promise<any[]>, [] as any[]),
  ]);

  const stats = (statsRows as any[])[0] ?? {};
  const consent = (consentRows as any[])[0] ?? { minors: 0, minors_with_consent: 0 };

  /* fill missing days so the chart always covers 30 points */
  const byDay: Record<string, { players: number; scouts: number }> = {};
  for (const r of activityRows as any[]) byDay[r.day] = { players: Number(r.players), scouts: Number(r.scouts) };
  const activity: Array<{ day: string; players: number; scouts: number }> = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    activity.push({ day: key, ...(byDay[key] ?? { players: 0, scouts: 0 }) });
  }

  return (
    <AdminDashboardClient
      session={session}
      stats={{
        total_players: stats.total_players ?? 0,
        scout_visible: stats.scout_visible ?? 0,
        active_scouts: stats.active_scouts ?? 0,
        pending_verifications: stats.pending_verifications ?? 0,
        consent_blocked: Math.max(0, (consent.minors ?? 0) - (consent.minors_with_consent ?? 0)),
      }}
      verificationQueue={verRows as any[]}
      pendingPlayers={approvalsP as any[]}
      pendingAcademies={approvalsA as any[]}
      pendingScouts={approvalsS as any[]}
      consent={consent}
      consentBlocked={blockedRows as any[]}
      levelDistribution={distRows as any[]}
      signups={signupRows as any[]}
      activity={activity}
    />
  );
}
