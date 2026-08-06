import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { sendSms } from "@/lib/sms";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "academy_admin") {
    return NextResponse.json({ success: false, error: "Academy admins only" }, { status: 403 });
  }
  const adminId = (session.user as any).id as string;

  const rows = (await sql`
    SELECT i.id, i.token, i.email, i.phone, i.invited_name, i.status,
           a.academy_name
    FROM player_invites i
    LEFT JOIN academies a ON a.id = i.academy_id
    WHERE i.id = ${params.id} AND i.invited_by_user_id = ${adminId}
    LIMIT 1
  `) as unknown as Array<any>;
  const inv = rows[0];
  if (!inv) return NextResponse.json({ success: false, error: "Invite not found" }, { status: 404 });
  if (inv.status === "Claimed") {
    return NextResponse.json({ success: false, error: "Already claimed — nothing to resend" }, { status: 409 });
  }

  const claimUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/claim/${inv.token}`;
  const body =
    `${inv.academy_name} has created an AthlasX profile for you.\n\n` +
    `Claim it here: ${claimUrl}\n\n` +
    `You'll fill in any missing details and submit for approval.`;

  if (inv.email) await sendEmail({ to: inv.email, subject: `Claim your AthlasX profile — ${inv.academy_name}`, body });
  if (inv.phone) {
    try {
      await sendSms(inv.phone, `AthlasX: ${inv.academy_name} created a profile for you. Claim it at ${claimUrl}`);
    } catch (e: any) {
      return NextResponse.json(
        { success: false, error: e?.message ?? "SMS delivery is not available right now — please try again later" },
        { status: 503 },
      );
    }
  }

  await sql`UPDATE player_invites SET sent_at = NOW(), status = 'Sent' WHERE id = ${inv.id}`;
  return NextResponse.json({ success: true });
}
