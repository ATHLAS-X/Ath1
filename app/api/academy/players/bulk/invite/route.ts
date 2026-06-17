import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { randomUUID } from "crypto";

/* POST { ids: string[] } — bulk-invite. Only ids belonging to the calling
   admin's academy are honoured; others are silently skipped. */

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
  if (ids.length === 0) return NextResponse.json({ success: false, error: "No ids" }, { status: 400 });

  /* Find which ids are owned by this admin's academy. */
  const owned = (await sql`
    SELECT pp.id, pp.first_name, pp.last_name, u.email
    FROM player_profiles pp
    JOIN academies a ON a.id = pp.academy_id AND a.user_id = ${adminUserId}
    LEFT JOIN users u ON u.id = pp.user_id
    WHERE pp.id = ANY(${ids})
  `) as any[];

  let sent = 0;
  for (const p of owned) {
    const token = `inv_${randomUUID().replace(/-/g, "")}`;
    await sql`
      UPDATE player_profiles
      SET invite_token = ${token}, invite_sent_at = NOW(), updated_at = NOW()
      WHERE id = ${p.id}
    `;
    console.log("[academy.invite] (stub) email:", {
      to: p.email ?? "(no email)",
      name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Player",
      claim_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/claim/${token}`,
    });
    sent++;
  }

  return NextResponse.json({ success: true, sent, skipped: ids.length - sent });
}
