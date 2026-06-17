import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

const ALLOWED_TARGETS = new Set(["Pending Approval", "Draft", "Live"]);

/* POST { ids: string[], status: string } — bulk profile_status change.
   Only the calling admin's academy players are touched. */

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "academy_admin") {
    return NextResponse.json({ success: false, error: "Academy admin only" }, { status: 403 });
  }
  const adminUserId = (session.user as any).id as string;

  let body: any = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }
  const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
  const status = String(body.status ?? "").trim();
  if (ids.length === 0) return NextResponse.json({ success: false, error: "No ids" }, { status: 400 });
  if (!ALLOWED_TARGETS.has(status)) {
    return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 });
  }

  const result = (await sql`
    UPDATE player_profiles
    SET profile_status = ${status},
        submitted_at = CASE WHEN ${status} = 'Pending Approval' AND submitted_at IS NULL THEN NOW() ELSE submitted_at END,
        updated_at = NOW()
    WHERE id = ANY(${ids})
      AND academy_id IN (SELECT id FROM academies WHERE user_id = ${adminUserId})
    RETURNING id
  `) as any[];

  return NextResponse.json({ success: true, updated: result.length, skipped: ids.length - result.length });
}
