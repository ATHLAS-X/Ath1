import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

/* Manual Level-2 (Identity Verified) bump by an academy admin who's
   confirmed the player's identity by phone OTP or ID document.
   Levels 3 and 4 are NOT settable from here — those flow through SportX
   internal review. */

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "academy_admin") {
    return NextResponse.json({ success: false, error: "Academy admin only" }, { status: 403 });
  }
  const adminUserId = (session.user as any).id as string;

  const own = (await sql`
    SELECT pp.id, COALESCE(pp.verification_level, 1) AS level
    FROM player_profiles pp
    JOIN academies a ON a.id = pp.academy_id AND a.user_id = ${adminUserId}
    WHERE pp.id = ${ctx.params.id} LIMIT 1
  `) as any[];
  if (!own[0]) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  /* Don't downgrade — only bump up. */
  if (own[0].level >= 2) {
    return NextResponse.json({ success: true, level: own[0].level, already: true });
  }

  await sql`
    UPDATE player_profiles
    SET verification_level = 2, updated_at = NOW()
    WHERE id = ${ctx.params.id}
  `;
  return NextResponse.json({ success: true, level: 2 });
}
