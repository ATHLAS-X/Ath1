import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

/* GET /api/scout/player/<player_user_id>
   Full player profile view for scouts and academy admins.

   Privacy boundary:
   - Raw MCQ answers and free-text are NEVER exposed here (coach-only via /api/coach/player-psych)
   - Scouts see: Gemini-interpreted strengths/gaps + mental_rating + coach's mindset note
   - Coach mindset note is optional — coaches add it after reviewing the psych test */

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as any).role as string;
  if (!["scout", "academy_admin", "athlasx_admin"].includes(role)) {
    return NextResponse.json({ error: "Scout or academy access required" }, { status: 403 });
  }

  const playerId = params.id;

  const [
    profileRows,
    scoreRows,
    statsRows,
    fitnessRows,
    psychRows,
    coachEvalRows,
    videoRows,
    cricketRows,
    matchRows,
  ] = await Promise.all([
    sql`
      SELECT first_name, last_name, city, state, district, date_of_birth,
             playing_role, batting_style, bowling_style, avatar_url,
             school_team, club_team, district_team, state_team,
             bio, strengths, improvement_areas, profile_status, visibility
      FROM player_profiles WHERE user_id = ${playerId} LIMIT 1
    ` as unknown as Promise<any[]>,

    sql`
      SELECT total_score, performance_score, experience_score, fitness_score,
             verification_score, mindset_score, profile_score,
             coach_verified, profile_strength, trajectory_boost, roadmap, calculated_at
      FROM athlasx_score WHERE user_id = ${playerId} LIMIT 1
    ` as unknown as Promise<any[]>,

    sql`
      SELECT format, matches, bpi, cbr
      FROM performance_stats WHERE user_id = ${playerId}
    ` as unknown as Promise<any[]>,

    sql`
      SELECT yoyo_score, sprint_30m, run_2km, is_supervised, assessment_date
      FROM player_fitness_assessments WHERE user_id = ${playerId}
      ORDER BY assessment_date DESC LIMIT 1
    ` as unknown as Promise<any[]>,

    // Psych: strengths/gaps/rating only — raw MCQ answers not included
    sql`
      SELECT strengths, gaps, mental_rating, coaching_tip, mindset_score, created_at
      FROM behavioral_assessment WHERE user_id = ${playerId} LIMIT 1
    ` as unknown as Promise<any[]>,

    // Coach evaluation: 6-dimension scores + mindset note (coach-written observation)
    sql`
      SELECT discipline, coachability, work_ethic, leadership, mental_toughness,
             communication, notes AS mindset_note, coaching_tip, updated_at
      FROM coach_evaluations WHERE player_user_id = ${playerId}
      ORDER BY updated_at DESC LIMIT 1
    ` as unknown as Promise<any[]>,

    sql`
      SELECT video_analysed, batting_style, wrist_movement, foot_work,
             bowling_action, strong_points, weak_points
      FROM video_analysis WHERE user_id = ${playerId} LIMIT 1
    ` as unknown as Promise<any[]>,

    sql`
      SELECT player_role, batting_hand, bowling_type
      FROM cricket_profile WHERE user_id = ${playerId} LIMIT 1
    ` as unknown as Promise<any[]>,

    // Verified match scorecards — scouts see all verified matches with scorecard images
    sql`
      SELECT id, opponent, match_date, format, competition_level, mqi_tag,
             runs_scored, wickets_taken, scorecard_url, ocr_status, verification_pts
      FROM match_logs
      WHERE user_id = ${playerId} AND ocr_status = 'VERIFIED'
      ORDER BY match_date DESC
    ` as unknown as Promise<any[]>,
  ]);

  const profile = profileRows[0];
  if (!profile || profile.visibility === "Private") {
    return NextResponse.json({ error: "Player profile not found or not public" }, { status: 404 });
  }

  return NextResponse.json({
    player_id: playerId,
    profile,
    cricket: cricketRows[0] ?? null,
    score: scoreRows[0] ?? null,
    performance_stats: statsRows,
    fitness: fitnessRows[0] ?? null,
    mindset: {
      // Gemini-interpreted output — no raw MCQ answers
      strengths: psychRows[0]?.strengths ?? [],
      gaps: psychRows[0]?.gaps ?? [],
      mental_rating: psychRows[0]?.mental_rating ?? null,
      coaching_tip: psychRows[0]?.coaching_tip ?? null,
      assessed_at: psychRows[0]?.created_at ?? null,
      // Coach's written observation after reviewing the psych test
      coach_mindset_note: coachEvalRows[0]?.mindset_note ?? null,
      coach_note_updated_at: coachEvalRows[0]?.updated_at ?? null,
    },
    coach_evaluation: coachEvalRows[0]
      ? {
          discipline: coachEvalRows[0].discipline,
          coachability: coachEvalRows[0].coachability,
          work_ethic: coachEvalRows[0].work_ethic,
          leadership: coachEvalRows[0].leadership,
          mental_toughness: coachEvalRows[0].mental_toughness,
          communication: coachEvalRows[0].communication,
          coaching_tip: coachEvalRows[0].coaching_tip,
        }
      : null,
    video: videoRows[0] ?? null,
    // Verified match history — scouts can view scorecard images to validate stats
    verified_matches: matchRows,
  });
}
