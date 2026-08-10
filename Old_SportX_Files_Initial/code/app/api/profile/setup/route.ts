import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import {
  BATTING_STYLES,
  BOWLING_STYLES,
  PLAYING_ROLES,
} from "@/lib/profile";

interface SetupBody {
  name?: string;
  date_of_birth?: string;
  city?: string;
  state?: string;
  district?: string;
  bio?: string;
  playing_role?: string;
  batting_style?: string;
  bowling_style?: string;
  matches_played?: number;
  runs_scored?: number;
  highest_score?: number;
  wickets_taken?: number;
  best_bowling?: string;
}

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}
function nonEmpty(s: unknown): s is string {
  return typeof s === "string" && s.trim().length > 0;
}
function toInt(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("Unauthorized", 401);
  const userId = session.user.id;

  let body: SetupBody;
  try {
    body = (await req.json()) as SetupBody;
  } catch {
    return err("Invalid JSON", 400);
  }

  if (!nonEmpty(body.city)) return err("City is required", 400);
  if (!nonEmpty(body.state)) return err("State is required", 400);
  if (!nonEmpty(body.district)) return err("District is required", 400);
  if (!nonEmpty(body.date_of_birth)) return err("Date of birth is required", 400);
  if (!nonEmpty(body.playing_role) || !PLAYING_ROLES.includes(body.playing_role as (typeof PLAYING_ROLES)[number])) {
    return err("Valid playing role required", 400);
  }
  if (!nonEmpty(body.batting_style) || !BATTING_STYLES.includes(body.batting_style as (typeof BATTING_STYLES)[number])) {
    return err("Valid batting style required", 400);
  }
  if (!nonEmpty(body.bowling_style) || !BOWLING_STYLES.includes(body.bowling_style as (typeof BOWLING_STYLES)[number])) {
    return err("Valid bowling style required", 400);
  }
  const bio = (body.bio ?? "").slice(0, 300);
  const matches_played = toInt(body.matches_played);
  const runs_scored = toInt(body.runs_scored);
  const highest_score = toInt(body.highest_score);
  const wickets_taken = toInt(body.wickets_taken);
  const best_bowling = (body.best_bowling ?? "").trim().slice(0, 20);

  if (nonEmpty(body.name)) {
    await sql`UPDATE users SET name = ${body.name.trim()} WHERE id = ${userId}`;
  }

  const existing = (await sql`
    SELECT id FROM player_profiles WHERE user_id = ${userId} LIMIT 1
  `) as unknown as { id: string }[];

  const wasEdit = existing.length > 0;

  if (wasEdit) {
    await sql`
      UPDATE player_profiles SET
        city = ${body.city},
        state = ${body.state},
        district = ${body.district},
        date_of_birth = ${body.date_of_birth},
        playing_role = ${body.playing_role},
        batting_style = ${body.batting_style},
        bowling_style = ${body.bowling_style},
        matches_played = ${matches_played},
        runs_scored = ${runs_scored},
        wickets_taken = ${wickets_taken},
        highest_score = ${highest_score},
        best_bowling = ${best_bowling},
        bio = ${bio},
        updated_at = NOW()
      WHERE user_id = ${userId}
    `;
  } else {
    await sql`
      INSERT INTO player_profiles (
        user_id, city, state, district, date_of_birth,
        playing_role, batting_style, bowling_style,
        matches_played, runs_scored, wickets_taken, highest_score, best_bowling, bio
      ) VALUES (
        ${userId}, ${body.city}, ${body.state}, ${body.district}, ${body.date_of_birth},
        ${body.playing_role}, ${body.batting_style}, ${body.bowling_style},
        ${matches_played}, ${runs_scored}, ${wickets_taken}, ${highest_score}, ${best_bowling}, ${bio}
      )
    `;
  }

  return NextResponse.json({ success: true, data: { userId, edited: wasEdit } });
}
