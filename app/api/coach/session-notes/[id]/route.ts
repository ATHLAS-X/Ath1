import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { coachMembership, isUuid, NOTE_VISIBILITIES } from "@/lib/session-access";

async function ownNote(userId: string, noteId: string) {
  const rows = (await sql`
    SELECT n.id, n.session_id, s.academy_id, s.batch_id, n.coach_id
    FROM session_notes n
    JOIN training_sessions s ON s.id = n.session_id
    JOIN academy_coaches ac ON ac.id = n.coach_id
    WHERE n.id = ${noteId} AND n.created_by_user_id = ${userId}
      AND ac.user_id = ${userId} AND ac.id = s.coach_id AND ac.academy_id = s.academy_id
      AND ac.deleted_at IS NULL AND ac.coach_status = 'ACTIVE'
    LIMIT 1
  `) as any[];
  return rows[0] ?? null;
}

async function validateTags(ids: unknown, note: { academy_id: string; batch_id: string | null }) {
  if (!Array.isArray(ids)) return { error: "tagged_player_profile_ids must be an array" } as const;
  const unique = [...new Set(ids.map((value) => String(value ?? "").trim()))];
  if (unique.some((id) => !isUuid(id))) return { error: "Invalid tagged player id" } as const;
  if (!unique.length) return { ids: unique } as const;
  const rows = (await sql`
    SELECT pp.id FROM player_profiles pp
    WHERE pp.id = ANY(${unique}::uuid[]) AND pp.academy_id = ${note.academy_id}
      AND (${note.batch_id}::uuid IS NULL OR EXISTS (SELECT 1 FROM batch_players bp WHERE bp.batch_id = ${note.batch_id}::uuid AND bp.player_profile_id = pp.id))
  `) as any[];
  return rows.length === unique.length ? { ids: unique } as const : { error: "Tagged players must belong to this session's cohort" } as const;
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "coach" || (session.user as any).account_status !== "active") return NextResponse.json({ success: false, error: "Active coach role required" }, { status: 403 });
  const userId = (session.user as any).id as string;
  if (!isUuid(ctx.params.id) || !await coachMembership(userId)) return NextResponse.json({ success: false, error: "Note not found" }, { status: 404 });
  const note = await ownNote(userId, ctx.params.id);
  if (!note) return NextResponse.json({ success: false, error: "Note not found" }, { status: 404 });
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 }); }
  const text = body.body === undefined ? null : String(body.body).trim();
  const visibility = body.visibility === undefined ? null : String(body.visibility).trim().toUpperCase();
  if (text !== null && (!text || text.length > 10000)) return NextResponse.json({ success: false, error: "body must be 1-10000 characters" }, { status: 400 });
  if (visibility !== null && !NOTE_VISIBILITIES.has(visibility)) return NextResponse.json({ success: false, error: "Invalid note visibility" }, { status: 400 });
  let tags: { ids: string[] } | null = null;
  if (body.tagged_player_profile_ids !== undefined) {
    const result = await validateTags(body.tagged_player_profile_ids, note);
    if ("error" in result) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    tags = result;
  }
  await sql`UPDATE session_notes SET body = COALESCE(${text}, body), visibility = COALESCE(${visibility}, visibility), updated_at = NOW() WHERE id = ${note.id}`;
  if (tags) {
    await sql`DELETE FROM session_note_players WHERE note_id = ${note.id}`;
    for (const playerId of tags.ids) await sql`INSERT INTO session_note_players (note_id, player_profile_id) VALUES (${note.id}, ${playerId})`;
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "coach" || (session.user as any).account_status !== "active") return NextResponse.json({ success: false, error: "Active coach role required" }, { status: 403 });
  const userId = (session.user as any).id as string;
  if (!isUuid(ctx.params.id)) return NextResponse.json({ success: false, error: "Invalid note id" }, { status: 400 });
  const note = await ownNote(userId, ctx.params.id);
  if (!note) return NextResponse.json({ success: false, error: "Note not found" }, { status: 404 });
  await sql`DELETE FROM session_notes WHERE id = ${note.id}`;
  return NextResponse.json({ success: true });
}
