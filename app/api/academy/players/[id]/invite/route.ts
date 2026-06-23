import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { randomUUID } from "crypto";

/* POST /api/academy/players/:id/invite — generate an invite token, persist
   it, and "send" the email. Real email sending is stubbed (see TODO);
   for now we log the message and return the token to the caller. */

async function guardOwn(adminUserId: string, id: string) {
  const rows = (await sql`
    SELECT pp.id, pp.user_id, pp.first_name, pp.last_name, u.email
    FROM player_profiles pp
    LEFT JOIN academies a ON a.id = pp.academy_id
    LEFT JOIN users u ON u.id = pp.user_id
    WHERE pp.id = ${id} AND a.user_id = ${adminUserId} LIMIT 1
  `) as any[];
  return rows[0] ?? null;
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "academy_admin") {
    return NextResponse.json({ success: false, error: "Academy admin only" }, { status: 403 });
  }
  const adminUserId = (session.user as any).id as string;
  const player = await guardOwn(adminUserId, ctx.params.id);
  if (!player) return NextResponse.json({ success: false, error: "Player not found" }, { status: 404 });

  const token = `inv_${randomUUID().replace(/-/g, "")}`;
  await sql`
    UPDATE player_profiles
    SET invite_token = ${token},
        invite_sent_at = NOW(),
        updated_at = NOW()
    WHERE id = ${ctx.params.id}
  `;

  const playerName = `${player.first_name ?? ""} ${player.last_name ?? ""}`.trim() || "Player";
  const claimUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/claim/${token}`;

  /* TODO replace with real email sender (Resend/SendGrid Edge Function). */
  console.log("[academy.invite] (stub) email:", {
    to: player.email ?? "(no email on file — share the claim link directly)",
    subject: `${playerName}, claim your AthlasX profile`,
    body: `Your academy has set up an AthlasX profile for you. Claim it here: ${claimUrl}`,
  });

  return NextResponse.json({
    success: true,
    player_id: ctx.params.id,
    player_name: playerName,
    token,
    claim_url: claimUrl,
    email_sent_stub: true,
  });
}
