import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

/* GET /api/coach/players
   Returns the players linked to this approved coach.

   How the link works:
     Player invites a coach during onboarding → coach_invites row (user_id = player's id)
     Coach redeems invite → coach_registry row (user_id = coach's own id, invite_id = invite)
   So we follow: coach_registry.invite_id → coach_invites → player_profiles. */

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as any).role !== "coach") {
    return NextResponse.json({ success: false, error: "Coach role required" }, { status: 403 });
  }
  const userId = (session.user as any).id as string;

  // Only approved coaches can see their players
  const regRows = (await sql`
    SELECT coach_status, invite_id FROM coach_registry WHERE user_id = ${userId} LIMIT 1
  `) as any[];
  const reg = regRows[0];
  if (!reg) {
    return NextResponse.json(
      { success: false, error: "No coach profile found" },
      { status: 404 },
    );
  }
  if (reg.coach_status !== "APPROVED") {
    return NextResponse.json({
      success: true,
      data: {
        players: [],
        note: `Your profile is ${reg.coach_status.toLowerCase().replace("_", " ")} — you can view players once approved.`,
      },
    });
  }

  if (!reg.invite_id) {
    // Self-registered coach not tied to a specific invite; no players assigned yet
    return NextResponse.json({
      success: true,
      data: { players: [], note: "No players assigned yet." },
    });
  }

  const players = (await sql`
    SELECT
      pp.user_id,
      TRIM(COALESCE(pp.first_name,'') || ' ' || COALESCE(pp.last_name,'')) AS name,
      pp.playing_role,
      pp.batting_style,
      pp.bowling_style,
      pp.profile_status,
      pp.date_of_birth,
      s.total_score,
      s.profile_strength,
      ce.updated_at AS last_evaluated_at
    FROM coach_invites ci
    JOIN player_profiles pp ON pp.user_id = ci.user_id
    LEFT JOIN athlasx_score s ON s.user_id = pp.user_id
    LEFT JOIN coach_evaluations ce
      ON ce.player_user_id = pp.user_id AND ce.coach_user_id = ${userId}
    WHERE ci.id = ${reg.invite_id}
    LIMIT 20
  `) as any[];

  return NextResponse.json({ success: true, data: { players } });
}
