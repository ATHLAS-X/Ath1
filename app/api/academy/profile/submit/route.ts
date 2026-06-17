import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as any).role !== "academy_admin") {
    return NextResponse.json({ success: false, error: "Academy admins only" }, { status: 403 });
  }
  const userId = (session.user as any).id as string;

  const rows = (await sql`
    SELECT academy_name, city, state, founded_year, contact_email
    FROM academies WHERE user_id = ${userId} LIMIT 1
  `) as unknown as Array<any>;
  const a = rows[0];
  if (!a) return NextResponse.json({ success: false, error: "No profile to submit" }, { status: 400 });

  const missing: string[] = [];
  if (!a.academy_name) missing.push("Academy name");
  if (!a.city || !a.state) missing.push("Location");
  if (!a.founded_year) missing.push("Founded year");
  if (!a.contact_email) missing.push("Contact email");
  if (missing.length > 0) {
    return NextResponse.json(
      { success: false, error: "Profile incomplete", missing },
      { status: 400 },
    );
  }

  await sql`
    UPDATE academies
    SET profile_status = 'Pending Approval',
        verification_status = 'PENDING',
        submitted_at = NOW()
    WHERE user_id = ${userId}
  `;
  return NextResponse.json({ success: true, profile_status: "Pending Approval" });
}
