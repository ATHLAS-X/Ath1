import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

/* GET/PUT a single academy-owned player. PUT accepts a whitelisted subset
   of editable fields (same fields the add-player form exposes). */

const ALLOWED: Record<string, "string" | "number" | "date"> = {
  first_name: "string",
  last_name: "string",
  date_of_birth: "date",
  gender: "string",
  playing_role: "string",
  batting_style: "string",
  bowling_style: "string",
  city: "string",
  state: "string",
  height_cm: "number",
  weight_kg: "number",
};

async function guard(req: Request, id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { res: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  if ((session.user as any).role !== "academy_admin") {
    return { res: NextResponse.json({ success: false, error: "Academy admin only" }, { status: 403 }) };
  }
  const userId = (session.user as any).id as string;
  /* Make sure the player belongs to this admin's academy. */
  const rows = (await sql`
    SELECT pp.id, pp.user_id, pp.academy_id, a.user_id AS academy_admin_user_id
    FROM player_profiles pp
    LEFT JOIN academies a ON a.id = pp.academy_id
    WHERE pp.id = ${id} LIMIT 1
  `) as any[];
  const r = rows[0];
  if (!r) return { res: NextResponse.json({ success: false, error: "Player not found" }, { status: 404 }) };
  if (r.academy_admin_user_id !== userId) {
    return { res: NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }) };
  }
  return { adminUserId: userId, profileId: r.id, playerUserId: r.user_id, academyId: r.academy_id };
}

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const g = await guard(req, ctx.params.id);
  if ("res" in g) return g.res;

  const rows = (await sql`
    SELECT pp.id, pp.user_id, pp.first_name, pp.last_name, pp.date_of_birth, pp.gender,
           pp.playing_role, pp.batting_style, pp.bowling_style,
           pp.city, pp.state, pp.district, pp.country,
           pp.height_cm, pp.weight_kg,
           COALESCE(pp.verification_level, 1) AS verification_level,
           COALESCE(pp.profile_status, 'Draft') AS profile_status,
           pp.visibility, pp.source_channel,
           pp.invite_token IS NOT NULL AS invite_sent,
           pp.invite_sent_at, pp.claimed_at,
           pp.created_at, pp.updated_at,
           u.email
    FROM player_profiles pp
    LEFT JOIN users u ON u.id = pp.user_id
    WHERE pp.id = ${ctx.params.id} LIMIT 1
  `) as any[];

  return NextResponse.json({ success: true, player: rows[0] ?? null });
}

function coerce(v: unknown, type: string): unknown {
  if (v === undefined || v === null || v === "") return null;
  if (type === "number") { const n = Number(v); return Number.isFinite(n) ? n : null; }
  return String(v);
}

export async function PUT(req: Request, ctx: { params: { id: string } }) {
  const g = await guard(req, ctx.params.id);
  if ("res" in g) return g.res;

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 }); }

  const updates: Array<[string, unknown]> = [];
  for (const [col, type] of Object.entries(ALLOWED)) {
    if (Object.prototype.hasOwnProperty.call(body, col)) {
      updates.push([col, coerce(body[col], type)]);
    }
  }
  if (updates.length === 0) return NextResponse.json({ success: true, updated: 0 });

  for (const [col, val] of updates) {
    await (sql as unknown as (q: string, p: unknown[]) => Promise<unknown>)(
      `UPDATE player_profiles SET ${col} = $1, updated_at = NOW() WHERE id = $2`,
      [val, ctx.params.id],
    );
  }

  return NextResponse.json({ success: true, updated: updates.length });
}
