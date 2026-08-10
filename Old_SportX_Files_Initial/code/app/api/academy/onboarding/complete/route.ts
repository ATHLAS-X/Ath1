import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

/* Final step — flip the academy to Pending Approval + activate the admin
   account so middleware lets them into the dashboard. */

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "academy_admin") {
    return NextResponse.json({ success: false, error: "Academy admin only" }, { status: 403 });
  }
  const userId = (session.user as any).id as string;

  const aRows = (await sql`SELECT id, profile_status FROM academies WHERE user_id = ${userId} LIMIT 1`) as any[];
  if (!aRows[0]) return NextResponse.json({ success: false, error: "No academy profile" }, { status: 400 });

  await sql`
    UPDATE academies
    SET profile_status = 'Pending Approval',
        submitted_at = COALESCE(submitted_at, NOW()),
        onboarding_step = 4,
        onboarding_completed_at = NOW()
    WHERE user_id = ${userId}
  `;
  await sql`
    UPDATE users SET account_status = 'active'
    WHERE id = ${userId} AND COALESCE(account_status, 'pending') = 'pending'
  `;
  return NextResponse.json({ success: true, profile_status: "Pending Approval" });
}
