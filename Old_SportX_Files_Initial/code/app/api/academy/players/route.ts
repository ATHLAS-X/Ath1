import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

/* GET /api/academy/players — list players in the calling admin's academy,
   with optional filters and pagination. Roughly:
     ?search=foo&role=Bowler&level=2&status=Live&page=1&size=20 */

const ROLE_FILTER_VALUES = new Set(["Batter", "Bowler", "All-Rounder", "Wicketkeeper"]);
const STATUS_FILTER_VALUES = new Set(["Draft", "Pending Approval", "Live"]);
/* DB uses "Batsman", but the filter dropdown reads "Batter" per the spec. */
const ROLE_DB_MAP: Record<string, string> = { Batter: "Batsman" };

async function resolveAcademy(userId: string): Promise<string | null> {
  const rows = (await sql`SELECT id FROM academies WHERE user_id = ${userId} LIMIT 1`) as any[];
  return rows[0]?.id ?? null;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "academy_admin") {
    return NextResponse.json({ success: false, error: "Academy admin only" }, { status: 403 });
  }
  const academyId = await resolveAcademy((session.user as any).id);
  if (!academyId) return NextResponse.json({ success: false, error: "No academy" }, { status: 404 });

  const url = new URL(req.url);
  const search = (url.searchParams.get("search") ?? "").trim();
  const roleParam = (url.searchParams.get("role") ?? "All").trim();
  const levelParam = (url.searchParams.get("level") ?? "All").trim();
  const statusParam = (url.searchParams.get("status") ?? "All").trim();
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const size = Math.max(1, Math.min(100, Number(url.searchParams.get("size") ?? "20") || 20));
  const offset = (page - 1) * size;

  const roleDb = ROLE_FILTER_VALUES.has(roleParam) ? (ROLE_DB_MAP[roleParam] ?? roleParam) : null;
  const statusDb = STATUS_FILTER_VALUES.has(statusParam) ? statusParam : null;
  const levelNum = ["1", "2", "3", "4"].includes(levelParam) ? Number(levelParam) : null;
  const searchPattern = search ? `%${search.toLowerCase()}%` : null;

  /* Single dynamic-filter SELECT — Neon's template engine handles params. */
  const rowsP = sql`
    SELECT pp.id, pp.user_id,
      TRIM(COALESCE(pp.first_name, '') || ' ' || COALESCE(pp.last_name, '')) AS name,
      pp.playing_role, pp.batting_style, pp.bowling_style,
      COALESCE(pp.verification_level, 1) AS verification_level,
      COALESCE(pp.profile_status, 'Draft') AS profile_status,
      pp.invite_token IS NOT NULL AS invite_sent,
      pp.invite_sent_at, pp.claimed_at,
      pp.created_at
    FROM player_profiles pp
    WHERE pp.academy_id = ${academyId}
      AND (${searchPattern}::text IS NULL OR LOWER(COALESCE(pp.first_name, '') || ' ' || COALESCE(pp.last_name, '')) LIKE ${searchPattern})
      AND (${roleDb}::text IS NULL OR pp.playing_role = ${roleDb})
      AND (${levelNum}::int IS NULL OR COALESCE(pp.verification_level, 1) = ${levelNum})
      AND (${statusDb}::text IS NULL OR COALESCE(pp.profile_status, 'Draft') = ${statusDb})
    ORDER BY pp.created_at DESC NULLS LAST
    LIMIT ${size} OFFSET ${offset}
  ` as unknown as Promise<any[]>;
  const countP = sql`
    SELECT COUNT(*)::int AS total FROM player_profiles pp
    WHERE pp.academy_id = ${academyId}
      AND (${searchPattern}::text IS NULL OR LOWER(COALESCE(pp.first_name, '') || ' ' || COALESCE(pp.last_name, '')) LIKE ${searchPattern})
      AND (${roleDb}::text IS NULL OR pp.playing_role = ${roleDb})
      AND (${levelNum}::int IS NULL OR COALESCE(pp.verification_level, 1) = ${levelNum})
      AND (${statusDb}::text IS NULL OR COALESCE(pp.profile_status, 'Draft') = ${statusDb})
  ` as unknown as Promise<any[]>;

  const [rows, countRows] = await Promise.all([rowsP, countP]);
  return NextResponse.json({
    success: true,
    players: rows,
    total: countRows[0]?.total ?? 0,
    page,
    size,
  });
}
