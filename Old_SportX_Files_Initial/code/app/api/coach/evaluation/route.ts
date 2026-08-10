import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

/* POST /api/coach/evaluation  — submit or update a behavioral evaluation
   GET  /api/coach/evaluation?player_user_id=<uuid> — fetch existing evaluation

   Only approved coaches can evaluate. One row per coach-player pair (upserted).
   The 6 dimension scores (1–10) feed into the player's mindset layer
   alongside their own self-assessment from onboarding.

   Score weights (equal for V1):
     discipline + coachability + work_ethic + leadership + mental_toughness + communication
     → averaged → stored as coach_mindset_score on the evaluation row
     → Hritvik can wire this into score-engine.ts as a second mindset signal later. */

const SCORE_FIELDS = [
  "discipline",
  "coachability",
  "work_ethic",
  "leadership",
  "mental_toughness",
  "communication",
] as const;
type ScoreField = (typeof SCORE_FIELDS)[number];

function validateScore(val: unknown): number | null {
  const n = Number(val);
  if (!Number.isFinite(n) || n < 1 || n > 10 || !Number.isInteger(n)) return null;
  return n;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as any).role !== "coach") {
    return NextResponse.json({ success: false, error: "Coach role required" }, { status: 403 });
  }
  const coachUserId = (session.user as any).id as string;

  const url = new URL(req.url);
  const playerUserId = (url.searchParams.get("player_user_id") ?? "").trim();
  if (!playerUserId) {
    return NextResponse.json(
      { success: false, error: "player_user_id query param is required" },
      { status: 400 },
    );
  }

  const rows = (await sql`
    SELECT discipline, coachability, work_ethic, leadership,
           mental_toughness, communication, notes, coaching_tip,
           created_at, updated_at
    FROM coach_evaluations
    WHERE coach_user_id = ${coachUserId} AND player_user_id = ${playerUserId}
    LIMIT 1
  `) as any[];

  if (!rows[0]) {
    return NextResponse.json({ success: true, data: null });
  }
  return NextResponse.json({ success: true, data: rows[0] });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as any).role !== "coach") {
    return NextResponse.json({ success: false, error: "Coach role required" }, { status: 403 });
  }
  const coachUserId = (session.user as any).id as string;

  // Must be APPROVED to submit evaluations
  const regRows = (await sql`
    SELECT coach_status FROM coach_registry WHERE user_id = ${coachUserId} LIMIT 1
  `) as any[];
  if (!regRows[0]) {
    return NextResponse.json(
      { success: false, error: "No coach profile found" },
      { status: 404 },
    );
  }
  if (regRows[0].coach_status !== "APPROVED") {
    return NextResponse.json(
      {
        success: false,
        error: `Your profile is ${regRows[0].coach_status.toLowerCase().replace("_", " ")} — evaluations can only be submitted after admin approval`,
      },
      { status: 403 },
    );
  }

  let body: any = {};
  try { body = await req.json(); }
  catch { return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 }); }

  const playerUserId = String(body.player_user_id ?? "").trim();
  if (!playerUserId) {
    return NextResponse.json(
      { success: false, error: "player_user_id is required" },
      { status: 400 },
    );
  }

  // Validate all 6 dimension scores
  const scores: Partial<Record<ScoreField, number>> = {};
  const invalid: string[] = [];
  for (const field of SCORE_FIELDS) {
    if (!(field in body)) { invalid.push(`${field} is required`); continue; }
    const v = validateScore(body[field]);
    if (v === null) invalid.push(`${field} must be a whole number between 1 and 10`);
    else scores[field] = v;
  }
  if (invalid.length > 0) {
    return NextResponse.json({ success: false, error: invalid.join("; ") }, { status: 400 });
  }

  const notes = body.notes ? String(body.notes).trim().slice(0, 2000) : null;
  const coachingTip = body.coaching_tip ? String(body.coaching_tip).trim().slice(0, 500) : null;

  // Verify the player exists
  const playerRows = (await sql`
    SELECT user_id FROM player_profiles WHERE user_id = ${playerUserId} LIMIT 1
  `) as any[];
  if (!playerRows[0]) {
    return NextResponse.json(
      { success: false, error: "Player not found" },
      { status: 404 },
    );
  }

  const avgScore = Math.round(
    (scores.discipline! + scores.coachability! + scores.work_ethic! +
     scores.leadership! + scores.mental_toughness! + scores.communication!) / 6,
  );

  await sql`
    INSERT INTO coach_evaluations
      (coach_user_id, player_user_id,
       discipline, coachability, work_ethic, leadership, mental_toughness, communication,
       notes, coaching_tip, created_at, updated_at)
    VALUES
      (${coachUserId}, ${playerUserId},
       ${scores.discipline}, ${scores.coachability}, ${scores.work_ethic},
       ${scores.leadership}, ${scores.mental_toughness}, ${scores.communication},
       ${notes}, ${coachingTip}, NOW(), NOW())
    ON CONFLICT (coach_user_id, player_user_id) DO UPDATE SET
      discipline       = EXCLUDED.discipline,
      coachability     = EXCLUDED.coachability,
      work_ethic       = EXCLUDED.work_ethic,
      leadership       = EXCLUDED.leadership,
      mental_toughness = EXCLUDED.mental_toughness,
      communication    = EXCLUDED.communication,
      notes            = EXCLUDED.notes,
      coaching_tip     = EXCLUDED.coaching_tip,
      updated_at       = NOW()
  `;

  return NextResponse.json({
    success: true,
    data: {
      player_user_id: playerUserId,
      avg_score: avgScore,
      scores,
    },
  });
}
