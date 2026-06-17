import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

/* Partial save — accepts any subset of player profile fields. Whitelisted to
   prevent column injection. */
const ALLOWED: Record<string, string> = {
  first_name: "string",
  last_name: "string",
  date_of_birth: "date",
  gender: "string",
  city: "string",
  state: "string",
  district: "string",
  country: "string",
  height_cm: "number",
  weight_kg: "number",
  dominant_hand: "string",
  playing_role: "string",
  secondary_role: "string",
  batting_style: "string",
  bowling_style: "string",
  wicket_keeper: "boolean",
  school_team: "string",
  club_team: "string",
  district_team: "string",
  state_team: "string",
  academy_id: "uuid",
  bio: "string",
  aspirations: "string",
  strengths: "string",
  improvement_areas: "string",
  matches_played: "number",
  runs_scored: "number",
  wickets_taken: "number",
  highest_score: "number",
  best_bowling: "string",
};

function coerce(v: unknown, type: string): unknown {
  if (v === undefined || v === null || v === "") return null;
  if (type === "number") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  if (type === "boolean") return Boolean(v);
  return String(v);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id as string;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Array<[string, unknown]> = [];
  for (const [k, type] of Object.entries(ALLOWED)) {
    if (Object.prototype.hasOwnProperty.call(body, k)) {
      updates.push([k, coerce(body[k], type)]);
    }
  }
  if (updates.length === 0) {
    return NextResponse.json({ success: true, updated: 0 });
  }

  /* Upsert: create the row if missing, then UPDATE each column. */
  await sql`
    INSERT INTO player_profiles (user_id) VALUES (${userId})
    ON CONFLICT (user_id) DO NOTHING
  `;

  /* Neon's tagged-template `sql` also accepts (queryString, paramsArray)
     for prepared statements. Column name is whitelisted (ALLOWED) — safe to
     interpolate. Values are parameterised. */
  for (const [col, val] of updates) {
    await (sql as unknown as (q: string, p: unknown[]) => Promise<unknown>)(
      `UPDATE player_profiles SET ${col} = $1, updated_at = NOW() WHERE user_id = $2`,
      [val, userId],
    );
  }

  return NextResponse.json({ success: true, updated: updates.length });
}
