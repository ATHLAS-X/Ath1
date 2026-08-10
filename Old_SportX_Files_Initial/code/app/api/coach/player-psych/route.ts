import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

/* GET /api/coach/player-psych?player_user_id=<uuid>
   Returns the player's full psychological assessment (30 MCQ answers + free text +
   Gemini analysis) and the calling coach's existing mindset note for that player.

   Raw MCQ answers are coach-only — scouts and academies never see them.
   Only APPROVED coaches can access this endpoint. */

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as any).role !== "coach") {
    return NextResponse.json({ success: false, error: "Coach role required" }, { status: 403 });
  }
  const coachUserId = (session.user as any).id as string;

  const regRows = (await sql`
    SELECT coach_status FROM coach_registry WHERE user_id = ${coachUserId} LIMIT 1
  `) as unknown as Array<{ coach_status: string }>;
  if (!regRows[0] || regRows[0].coach_status !== "APPROVED") {
    return NextResponse.json(
      { success: false, error: "Only approved coaches can view psychological assessments" },
      { status: 403 },
    );
  }

  const url = new URL(req.url);
  const playerUserId = (url.searchParams.get("player_user_id") ?? "").trim();
  if (!playerUserId) {
    return NextResponse.json(
      { success: false, error: "player_user_id is required" },
      { status: 400 },
    );
  }

  const [psychRows, evalRows] = await Promise.all([
    sql`
      SELECT mcq_answers, free_text, strengths, gaps, mental_rating, coaching_tip,
             mindset_score, created_at
      FROM behavioral_assessment
      WHERE user_id = ${playerUserId}
      LIMIT 1
    ` as unknown as Promise<Array<{
      mcq_answers: Record<string, string> | null;
      free_text: string | null;
      strengths: string[];
      gaps: string[];
      mental_rating: number | null;
      coaching_tip: string | null;
      mindset_score: number | null;
      created_at: string;
    }>>,
    sql`
      SELECT notes, updated_at
      FROM coach_evaluations
      WHERE coach_user_id = ${coachUserId} AND player_user_id = ${playerUserId}
      LIMIT 1
    ` as unknown as Promise<Array<{ notes: string | null; updated_at: string }>>,
  ]);

  return NextResponse.json({
    success: true,
    data: {
      assessment: psychRows[0] ?? null,
      mindset_note: evalRows[0]?.notes ?? null,
      mindset_note_updated_at: evalRows[0]?.updated_at ?? null,
    },
  });
}
