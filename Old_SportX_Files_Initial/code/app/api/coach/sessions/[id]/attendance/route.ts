import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { ATTENDANCE_STATUSES, coachSession, isUuid } from "@/lib/session-access";

async function guard(sessionId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { response: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  if ((session.user as any).role !== "coach" || (session.user as any).account_status !== "active") {
    return { response: NextResponse.json({ success: false, error: "Active coach role required" }, { status: 403 }) };
  }
  if (!isUuid(sessionId)) return { response: NextResponse.json({ success: false, error: "Invalid session id" }, { status: 400 }) };
  const own = await coachSession((session.user as any).id, sessionId);
  if (!own) return { response: NextResponse.json({ success: false, error: "Session not found" }, { status: 404 }) };
  return { own, userId: (session.user as any).id as string };
}

async function roster(sessionId: string, batchId: string | null, academyId: string) {
  if (!batchId) return null;
  return (await sql`
    SELECT pp.id AS player_profile_id,
      TRIM(COALESCE(pp.first_name, '') || ' ' || COALESCE(pp.last_name, '')) AS player_name,
      pp.playing_role,
      COALESCE(sa.status, 'UNMARKED') AS status,
      sa.remarks, sa.marked_at
    FROM batch_players bp
    JOIN player_profiles pp ON pp.id = bp.player_profile_id
    LEFT JOIN session_attendance sa ON sa.session_id = ${sessionId} AND sa.player_profile_id = pp.id
    WHERE bp.batch_id = ${batchId} AND pp.academy_id = ${academyId}
    ORDER BY pp.first_name NULLS LAST, pp.last_name NULLS LAST, pp.id
  `) as any[];
}

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const g = await guard(ctx.params.id);
  if ("response" in g) return g.response;
  if (!g.own.batch_id) return NextResponse.json({ success: false, error: "This session has no batch cohort, so attendance is unavailable" }, { status: 409 });
  const players = await roster(g.own.id, g.own.batch_id, g.own.academy_id);
  return NextResponse.json({ success: true, session: g.own, players });
}

export async function PUT(req: Request, ctx: { params: { id: string } }) {
  const g = await guard(ctx.params.id);
  if ("response" in g) return g.response;
  if (!g.own.batch_id) return NextResponse.json({ success: false, error: "This session has no batch cohort, so attendance cannot be marked" }, { status: 409 });
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 }); }
  if (!Array.isArray(body.attendance)) return NextResponse.json({ success: false, error: "attendance must be an array" }, { status: 400 });

  const cohort = await roster(g.own.id, g.own.batch_id, g.own.academy_id);
  const allowed = new Set((cohort ?? []).map((p) => p.player_profile_id));
  const updates = new Map<string, { status: string; remarks: string | null }>();
  for (const item of body.attendance) {
    const playerId = String(item?.player_profile_id ?? "").trim();
    const status = String(item?.status ?? "").trim().toUpperCase();
    if (!isUuid(playerId) || !allowed.has(playerId)) return NextResponse.json({ success: false, error: "Every player must belong to this session's batch" }, { status: 400 });
    if (!ATTENDANCE_STATUSES.has(status)) return NextResponse.json({ success: false, error: "Invalid attendance status" }, { status: 400 });
    const remarks = String(item?.remarks ?? "").trim();
    if (remarks.length > 2000) return NextResponse.json({ success: false, error: "remarks must be at most 2000 characters" }, { status: 400 });
    updates.set(playerId, { status, remarks: remarks || null });
  }
  for (const [playerId, update] of updates) {
    const isUnmarked = update.status === "UNMARKED";
    await sql`
      INSERT INTO session_attendance (session_id, player_profile_id, status, marked_by_user_id, marked_at, remarks)
      VALUES (${g.own.id}, ${playerId}, ${update.status}, ${isUnmarked ? null : g.userId}, ${isUnmarked ? null : new Date()}, ${isUnmarked ? null : update.remarks})
      ON CONFLICT (session_id, player_profile_id) DO UPDATE SET
        status = EXCLUDED.status,
        marked_by_user_id = EXCLUDED.marked_by_user_id,
        marked_at = EXCLUDED.marked_at,
        remarks = EXCLUDED.remarks
    `;
  }
  const players = await roster(g.own.id, g.own.batch_id, g.own.academy_id);
  return NextResponse.json({ success: true, players, updated: updates.size });
}
