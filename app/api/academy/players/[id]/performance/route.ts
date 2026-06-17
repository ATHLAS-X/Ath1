import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

const NUM_FIELDS = [
  "matches", "innings", "runs", "batting_average", "strike_rate",
  "highest_score", "fifties", "hundreds",
  "bowling_matches", "wickets", "overs", "economy", "bowling_average",
  "catches", "stumpings", "runouts",
] as const;
const STR_FIELDS = ["best_figures"] as const;

async function guardOwn(adminUserId: string, id: string) {
  const rows = (await sql`
    SELECT pp.user_id FROM player_profiles pp
    JOIN academies a ON a.id = pp.academy_id AND a.user_id = ${adminUserId}
    WHERE pp.id = ${id} LIMIT 1
  `) as any[];
  return rows[0]?.user_id as string | undefined;
}

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const adminUserId = (session.user as any).id as string;
  const playerUserId = await guardOwn(adminUserId, ctx.params.id);
  if (!playerUserId) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

  const rows = (await sql`SELECT * FROM player_performance_summary WHERE user_id = ${playerUserId} LIMIT 1`) as any[];
  return NextResponse.json({ success: true, performance: rows[0] ?? null });
}

export async function PUT(req: Request, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "academy_admin") {
    return NextResponse.json({ success: false, error: "Academy admin only" }, { status: 403 });
  }
  const adminUserId = (session.user as any).id as string;
  const playerUserId = await guardOwn(adminUserId, ctx.params.id);
  if (!playerUserId) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

  let body: any = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const numVals: Record<string, number | null> = {};
  for (const k of NUM_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, k)) {
      const v = body[k];
      numVals[k] = v === "" || v == null ? null : Number(v);
    }
  }
  const strVals: Record<string, string | null> = {};
  for (const k of STR_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, k)) {
      const v = body[k];
      strVals[k] = v === "" || v == null ? null : String(v);
    }
  }

  /* Upsert one row per player. */
  await sql`
    INSERT INTO player_performance_summary (user_id, updated_at, updated_by_user_id)
    VALUES (${playerUserId}, NOW(), ${adminUserId})
    ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW(), updated_by_user_id = ${adminUserId}
  `;

  for (const [col, val] of [...Object.entries(numVals), ...Object.entries(strVals)]) {
    await (sql as unknown as (q: string, p: unknown[]) => Promise<unknown>)(
      `UPDATE player_performance_summary SET ${col} = $1, updated_at = NOW() WHERE user_id = $2`,
      [val, playerUserId],
    );
  }

  return NextResponse.json({ success: true });
}
