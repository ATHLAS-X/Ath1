import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

/* GET /api/coach/dashboard
   Returns the calling coach's registry status, linked player (if any),
   recent evaluations they've submitted, and headline counts. */

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as any).role !== "coach") {
    return NextResponse.json({ success: false, error: "Coach role required" }, { status: 403 });
  }
  const userId = (session.user as any).id as string;

  // Coach's own registry record
  const regRows = (await sql`
    SELECT cr.id, cr.coach_name, cr.academy_club, cr.coach_status,
           cr.official_id, cr.created_at, cr.approved_at,
           cr.invite_id,
           ci.user_id AS linked_player_user_id
    FROM coach_registry cr
    LEFT JOIN coach_invites ci ON ci.id = cr.invite_id
    WHERE cr.user_id = ${userId}
    LIMIT 1
  `) as any[];

  if (!regRows[0]) {
    return NextResponse.json(
      { success: false, error: "No coach profile found — complete your registration first" },
      { status: 404 },
    );
  }
  const reg = regRows[0];

  // Linked player's basic profile (if invite-flow coach)
  let linkedPlayer: any = null;
  if (reg.linked_player_user_id) {
    const pRows = (await sql`
      SELECT pp.user_id,
             TRIM(COALESCE(pp.first_name,'') || ' ' || COALESCE(pp.last_name,'')) AS name,
             pp.playing_role, pp.profile_status,
             s.total_score
      FROM player_profiles pp
      LEFT JOIN athlasx_score s ON s.user_id = pp.user_id
      WHERE pp.user_id = ${reg.linked_player_user_id}
      LIMIT 1
    `) as any[];
    linkedPlayer = pRows[0] ?? null;
  }

  // Evaluations this coach has submitted
  const evalRows = (await sql`
    SELECT ce.player_user_id,
           TRIM(COALESCE(pp.first_name,'') || ' ' || COALESCE(pp.last_name,'')) AS player_name,
           ce.discipline, ce.coachability, ce.work_ethic,
           ce.leadership, ce.mental_toughness, ce.communication,
           ce.coaching_tip, ce.updated_at
    FROM coach_evaluations ce
    LEFT JOIN player_profiles pp ON pp.user_id = ce.player_user_id
    WHERE ce.coach_user_id = ${userId}
    ORDER BY ce.updated_at DESC
    LIMIT 10
  `) as any[];

  return NextResponse.json({
    success: true,
    data: {
      coach_status: reg.coach_status,
      coach_name: reg.coach_name,
      academy_club: reg.academy_club,
      official_id: reg.official_id,
      approved_at: reg.approved_at,
      linked_player: linkedPlayer,
      evaluations_submitted: evalRows.length,
      recent_evaluations: evalRows,
    },
  });
}
