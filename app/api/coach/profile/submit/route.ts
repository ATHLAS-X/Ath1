import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

/* Final submit for self-signup coach. Flips coach_status to PENDING_REVIEW
   so SportX admin sees it in the review queue. */

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as any).role !== "coach") {
    return NextResponse.json({ success: false, error: "Coach role required" }, { status: 403 });
  }
  const userId = (session.user as any).id as string;

  const rows = (await sql`
    SELECT coach_name, academy_club, official_id, cert_url, coach_status
    FROM coach_registry WHERE user_id = ${userId} LIMIT 1
  `) as unknown as Array<any>;
  const p = rows[0];
  if (!p) {
    return NextResponse.json(
      { success: false, error: "No coach profile — fill it in first" },
      { status: 400 },
    );
  }

  const missing: string[] = [];
  if (!p.coach_name?.trim()) missing.push("Coach Name");
  if (!p.academy_club?.trim()) missing.push("Academy / Club");
  if (!p.official_id?.trim()) missing.push("Official ID (BCCI L1/L2, NIS, NCA, etc.)");
  if (!p.cert_url?.trim()) missing.push("Certification URL");
  if (missing.length > 0) {
    return NextResponse.json(
      { success: false, error: "Profile incomplete", missing },
      { status: 400 },
    );
  }

  await sql`
    UPDATE coach_registry
    SET coach_status = 'PENDING_REVIEW'
    WHERE user_id = ${userId} AND coach_status IN ('DRAFT', 'PENDING_REVIEW')
  `;

  return NextResponse.json({
    success: true,
    coach_status: "PENDING_REVIEW",
  });
}
