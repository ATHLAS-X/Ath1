import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { coachSession, isUuid, NOTE_VISIBILITIES } from "@/lib/session-access";

async function guard(sessionId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { response: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  if ((session.user as any).role !== "coach" || (session.user as any).account_status !== "active") return { response: NextResponse.json({ success: false, error: "Active coach role required" }, { status: 403 }) };
  if (!isUuid(sessionId)) return { response: NextResponse.json({ success: false, error: "Invalid session id" }, { status: 400 }) };
  const own = await coachSession((session.user as any).id, sessionId);
  if (!own) return { response: NextResponse.json({ success: false, error: "Session not found" }, { status: 404 }) };
  return { own, userId: (session.user as any).id as string };
}

async function noteRows(sessionId: string, userId: string) {
  return (await sql`
    SELECT n.id, n.session_id, n.coach_id, n.created_by_user_id, n.body, n.visibility, n.updated_at, n.created_at,
      ac.coach_name,
      COALESCE(json_agg(json_build_object('id', pp.id, 'name', TRIM(COALESCE(pp.first_name, '') || ' ' || COALESCE(pp.last_name, ''))))
        FILTER (WHERE pp.id IS NOT NULL), '[]') AS tagged_players
    FROM session_notes n
    LEFT JOIN academy_coaches ac ON ac.id = n.coach_id
    LEFT JOIN session_note_players snp ON snp.note_id = n.id
    LEFT JOIN player_profiles pp ON pp.id = snp.player_profile_id
    WHERE n.session_id = ${sessionId}
      AND (
        n.visibility = 'COACHES'
        OR (n.visibility = 'PLAYERS' AND EXISTS (SELECT 1 FROM session_note_players snp2 WHERE snp2.note_id = n.id))
        OR (n.visibility = 'PRIVATE' AND n.created_by_user_id = ${userId})
      )
    GROUP BY n.id, ac.coach_name
    ORDER BY n.created_at DESC
  `) as any[];
}

async function validateTags(ids: unknown, session: { batch_id: string | null; academy_id: string }) {
  if (!Array.isArray(ids)) return { error: "tagged_player_profile_ids must be an array" } as const;
  const unique = [...new Set(ids.map((value) => String(value ?? "").trim()))];
  if (unique.some((id) => !isUuid(id))) return { error: "Invalid tagged player id" } as const;
  if (unique.length === 0) return { ids: unique } as const;
  const rows = (await sql`
    SELECT pp.id
    FROM player_profiles pp
    WHERE pp.id = ANY(${unique}::uuid[]) AND pp.academy_id = ${session.academy_id}
      AND (${session.batch_id}::uuid IS NULL OR EXISTS (
        SELECT 1 FROM batch_players bp WHERE bp.batch_id = ${session.batch_id}::uuid AND bp.player_profile_id = pp.id
      ))
  `) as Array<{ id: string }>;
  if (rows.length !== unique.length) return { error: "Tagged players must belong to this session's cohort" } as const;
  return { ids: unique } as const;
}

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const g = await guard(ctx.params.id);
  if ("response" in g) return g.response;
  return NextResponse.json({ success: true, notes: await noteRows(g.own.id, g.userId) });
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const g = await guard(ctx.params.id);
  if ("response" in g) return g.response;
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 }); }
  const noteBody = String(body.body ?? "").trim();
  const visibility = String(body.visibility ?? "COACHES").trim().toUpperCase();
  if (!noteBody || noteBody.length > 10000) return NextResponse.json({ success: false, error: "body is required and must be at most 10000 characters" }, { status: 400 });
  if (!NOTE_VISIBILITIES.has(visibility)) return NextResponse.json({ success: false, error: "Invalid note visibility" }, { status: 400 });
  const tags = await validateTags(body.tagged_player_profile_ids ?? [], g.own);
  if ("error" in tags) return NextResponse.json({ success: false, error: tags.error }, { status: 400 });
  const inserted = (await sql`
    INSERT INTO session_notes (session_id, coach_id, created_by_user_id, body, visibility)
    VALUES (${g.own.id}, ${g.own.coach_id}, ${g.userId}, ${noteBody}, ${visibility})
    RETURNING id, session_id, coach_id, created_by_user_id, body, visibility, updated_at, created_at
  `) as any[];
  for (const playerId of tags.ids) await sql`INSERT INTO session_note_players (note_id, player_profile_id) VALUES (${inserted[0].id}, ${playerId}) ON CONFLICT (note_id, player_profile_id) DO NOTHING`;
  return NextResponse.json({ success: true, note: (await noteRows(g.own.id, g.userId)).find((note) => note.id === inserted[0].id) }, { status: 201 });
}
