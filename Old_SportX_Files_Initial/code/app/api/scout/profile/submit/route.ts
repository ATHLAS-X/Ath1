import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

/* Scout submits onboarding for AthlasX admin review.
   Per the V1 spec (Part 1, Step 5): row sits at "Pending Approval" with
   verification_level='L0' until an admin promotes them to L1 (Verified)
   or L2 (Minor-Cleared). Adult profiles are searchable from L0 already. */

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as any).role !== "scout") {
    return NextResponse.json({ success: false, error: "Scout role required" }, { status: 403 });
  }
  const userId = (session.user as any).id as string;

  const rows = (await sql`
    SELECT designation, organization_name, org_type, region, years_experience, proof_url,
           preferred_age_groups, preferred_roles
    FROM scout_profiles WHERE user_id = ${userId} LIMIT 1
  `) as unknown as Array<any>;
  const p = rows[0];
  if (!p) {
    return NextResponse.json(
      { success: false, error: "No scout profile — fill it in first" },
      { status: 400 },
    );
  }

  /* Required fields per the spec — identity + affiliation + at least one
     preference so admin has enough context to review. */
  const missing: string[] = [];
  if (!p.designation?.trim()) missing.push("Designation");
  if (!p.organization_name?.trim()) missing.push("Organization");
  if (!p.org_type?.trim()) missing.push("Organization Type");
  if (!p.region?.trim()) missing.push("Region");
  if (p.years_experience == null) missing.push("Years of Experience");
  if (!p.proof_url?.trim()) missing.push("Affiliation Proof");
  if (!(p.preferred_age_groups?.length) && !(p.preferred_roles?.length)) {
    missing.push("Scouting Preferences");
  }
  if (missing.length > 0) {
    return NextResponse.json(
      { success: false, error: "Profile incomplete", missing },
      { status: 400 },
    );
  }

  await sql`
    UPDATE scout_profiles
    SET profile_status = 'Pending Approval',
        submitted_at = NOW(),
        updated_at = NOW()
    WHERE user_id = ${userId}
  `;

  /* Account stays 'pending' until admin approval (per Part 1 Step 6). The
     player onboarding pattern of auto-activating on submit does NOT apply
     here — scout L0/L1 IS the verification gate. */

  return NextResponse.json({
    success: true,
    profile_status: "Pending Approval",
    verification_level: "L0",
  });
}
