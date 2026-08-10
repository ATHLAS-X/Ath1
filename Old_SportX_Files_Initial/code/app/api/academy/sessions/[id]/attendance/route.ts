import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { adminSession, isUuid } from "@/lib/session-access";

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "academy_admin") return NextResponse.json({ success: false, error: "Academy admin only" }, { status: 403 });
  if (!isUuid(ctx.params.id)) return NextResponse.json({ success: false, error: "Invalid session id" }, { status: 400 });
  const own = await adminSession((session.user as any).id, ctx.params.id);
  if (!own) return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
  if (!own.batch_id) return NextResponse.json({ success: true, session: own, players: [], cohort_missing: true });
  const players = (await sql`
    SELECT pp.id AS player_profile_id,
      TRIM(COALESCE(pp.first_name, '') || ' ' || COALESCE(pp.last_name, '')) AS player_name,
      pp.playing_role, COALESCE(sa.status, 'UNMARKED') AS status,
      sa.remarks, sa.marked_at, u.name AS marked_by_name
    FROM batch_players bp
    JOIN player_profiles pp ON pp.id = bp.player_profile_id
    LEFT JOIN session_attendance sa ON sa.session_id = ${own.id} AND sa.player_profile_id = pp.id
    LEFT JOIN users u ON u.id = sa.marked_by_user_id
    WHERE bp.batch_id = ${own.batch_id} AND pp.academy_id = ${own.academy_id}
    ORDER BY pp.first_name NULLS LAST, pp.last_name NULLS LAST, pp.id
  `) as any[];
  return NextResponse.json({ success: true, session: own, players, cohort_missing: false });
}
