import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { calculateAthlasXScore } from "@/lib/score-engine";

/* GET  /api/coach/scorecards?player_user_id=<uuid>
         Returns all match_logs for a player pending or reviewed by this coach.

   PATCH /api/coach/scorecards
         Body: { match_log_id, player_user_id, action: "APPROVE" | "REJECT", reject_reason? }
         Approves or rejects a scorecard. On approval, awards 3 verification pts and
         triggers a score recalculation. On rejection, notifies the player. */

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "coach") return NextResponse.json({ success: false, error: "Coach role required" }, { status: 403 });
  const coachUserId = (session.user as any).id as string;

  const regRows = (await sql`
    SELECT coach_status FROM coach_registry WHERE user_id = ${coachUserId} LIMIT 1
  `) as unknown as Array<{ coach_status: string }>;
  if (!regRows[0] || regRows[0].coach_status !== "APPROVED") {
    return NextResponse.json({ success: false, error: "Only approved coaches can view player scorecards" }, { status: 403 });
  }

  const url = new URL(req.url);
  const playerUserId = (url.searchParams.get("player_user_id") ?? "").trim();
  if (!playerUserId) {
    return NextResponse.json({ success: false, error: "player_user_id is required" }, { status: 400 });
  }

  const rows = (await sql`
    SELECT ml.id, ml.opponent, ml.match_date, ml.format, ml.competition_level,
           ml.mqi_tag, ml.runs_scored, ml.wickets_taken, ml.scorecard_url,
           ml.ocr_status, ml.verification_pts, ml.reject_reason, ml.created_at,
           u.name AS player_name
    FROM match_logs ml
    JOIN users u ON ml.user_id = u.id
    WHERE ml.user_id = ${playerUserId}
    ORDER BY ml.match_date DESC, ml.created_at DESC
  `) as unknown as any[];

  return NextResponse.json({ success: true, data: rows });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "coach") return NextResponse.json({ success: false, error: "Coach role required" }, { status: 403 });
  const coachUserId = (session.user as any).id as string;

  const regRows = (await sql`
    SELECT coach_status FROM coach_registry WHERE user_id = ${coachUserId} LIMIT 1
  `) as unknown as Array<{ coach_status: string }>;
  if (!regRows[0] || regRows[0].coach_status !== "APPROVED") {
    return NextResponse.json({ success: false, error: "Only approved coaches can verify scorecards" }, { status: 403 });
  }

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 }); }

  const matchLogId = String(body?.match_log_id ?? "").trim();
  const playerUserId = String(body?.player_user_id ?? "").trim();
  const action = String(body?.action ?? "").trim().toUpperCase();
  const rejectReason = body?.reject_reason ? String(body.reject_reason).trim().slice(0, 500) : null;

  if (!matchLogId || !playerUserId) return NextResponse.json({ success: false, error: "match_log_id and player_user_id are required" }, { status: 400 });
  if (!["APPROVE", "REJECT"].includes(action)) return NextResponse.json({ success: false, error: "action must be APPROVE or REJECT" }, { status: 400 });
  if (action === "REJECT" && !rejectReason) return NextResponse.json({ success: false, error: "reject_reason is required when rejecting" }, { status: 400 });

  // Confirm scorecard exists and belongs to this player
  const existing = (await sql`
    SELECT id, opponent, ocr_status FROM match_logs
    WHERE id = ${matchLogId} AND user_id = ${playerUserId} LIMIT 1
  `) as unknown as Array<{ id: string; opponent: string; ocr_status: string }>;
  if (!existing[0]) return NextResponse.json({ success: false, error: "Scorecard not found" }, { status: 404 });
  if (existing[0].ocr_status === "VERIFIED") return NextResponse.json({ success: false, error: "Scorecard is already verified" }, { status: 409 });

  const opponent = existing[0].opponent;

  if (action === "APPROVE") {
    await sql`
      UPDATE match_logs
      SET ocr_status = 'VERIFIED', verification_pts = 3,
          reviewed_by = ${coachUserId}, reviewed_at = NOW()
      WHERE id = ${matchLogId}
    `;

    // Notify player
    const msg = `Your scorecard vs ${opponent} has been verified by your coach. +3 verification points added.`;
    await sql`
      INSERT INTO player_notifications (user_id, kind, title, body)
      VALUES (${playerUserId}, 'SCORECARD_VERIFIED', 'Scorecard verified', ${msg})
    `;

    // Recalculate score
    const result = await calculateAthlasXScore(playerUserId);

    return NextResponse.json({
      success: true,
      action: "APPROVED",
      new_total_score: result.total,
      verification_pts_awarded: 3,
    });
  } else {
    await sql`
      UPDATE match_logs
      SET ocr_status = 'REJECTED', verification_pts = 0,
          reviewed_by = ${coachUserId}, reviewed_at = NOW(),
          reject_reason = ${rejectReason}
      WHERE id = ${matchLogId}
    `;

    const msg = `Your scorecard vs ${opponent} could not be verified. Reason: ${rejectReason}. Please re-upload a clearer image.`;
    await sql`
      INSERT INTO player_notifications (user_id, kind, title, body)
      VALUES (${playerUserId}, 'SCORECARD_REJECTED', 'Scorecard could not be verified', ${msg})
    `;

    return NextResponse.json({ success: true, action: "REJECTED" });
  }
}
