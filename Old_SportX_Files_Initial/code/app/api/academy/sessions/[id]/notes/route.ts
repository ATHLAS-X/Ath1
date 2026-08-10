import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { adminSession, isUuid } from "@/lib/session-access";

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "academy_admin") return NextResponse.json({ success: false, error: "Academy admin only" }, { status: 403 });
  if (!isUuid(ctx.params.id)) return NextResponse.json({ success: false, error: "Invalid session id" }, { status: 400 });
  const own = await adminSession((session.user as any).id, ctx.params.id);
  if (!own) return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 });
  const notes = (await sql`
    SELECT n.id, n.body, n.visibility, n.updated_at, n.created_at, ac.coach_name,
      COALESCE(json_agg(json_build_object('id', pp.id, 'name', TRIM(COALESCE(pp.first_name, '') || ' ' || COALESCE(pp.last_name, '')))) FILTER (WHERE pp.id IS NOT NULL), '[]') AS tagged_players
    FROM session_notes n
    LEFT JOIN academy_coaches ac ON ac.id = n.coach_id
    LEFT JOIN session_note_players snp ON snp.note_id = n.id
    LEFT JOIN player_profiles pp ON pp.id = snp.player_profile_id
    WHERE n.session_id = ${own.id}
      AND (
        n.visibility = 'COACHES'
        OR (n.visibility = 'PLAYERS' AND EXISTS (SELECT 1 FROM session_note_players snp2 WHERE snp2.note_id = n.id))
      )
    GROUP BY n.id, ac.coach_name
    ORDER BY n.created_at DESC
  `) as any[];
  return NextResponse.json({ success: true, notes });
}
