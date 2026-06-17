import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { isMinor } from "@/lib/profile-completion";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id as string;

  /* Pull current profile so we can validate completeness + minor consent. */
  const rows = (await sql`
    SELECT first_name, last_name, date_of_birth, gender, state,
           height_cm, weight_kg, playing_role, batting_style, bowling_style,
           wicket_keeper, matches_played
    FROM player_profiles WHERE user_id = ${userId} LIMIT 1
  `) as unknown as Array<any>;
  const p = rows[0];

  if (!p) {
    return NextResponse.json(
      { success: false, error: "No profile to submit — fill it in first" },
      { status: 400 },
    );
  }

  /* Hard requirements per the spec — all 5 required categories must be present.
     Keepers (primary role WK or wicket_keeper flag) don't bowl, so the
     bowling_style field is optional for them. Everyone else still needs it. */
  const missing: string[] = [];
  if (!p.first_name || !p.last_name || !p.date_of_birth || !p.gender || !p.state) {
    missing.push("Basic Profile");
  }
  if (!p.height_cm || !p.weight_kg) missing.push("Height & Weight");
  const isKeeper = p.playing_role === "WK" || p.wicket_keeper === true;
  const cricketMissing = !p.playing_role || !p.batting_style || (!isKeeper && !p.bowling_style);
  if (cricketMissing) missing.push("Cricket Profile");
  if (p.matches_played === null || p.matches_played === undefined) missing.push("Performance Stats");

  const mediaRows = (await sql`
    SELECT COUNT(*)::int AS cnt FROM player_media WHERE user_id = ${userId}
  `) as unknown as Array<{ cnt: number }>;
  if ((mediaRows[0]?.cnt ?? 0) === 0) missing.push("Videos");

  if (missing.length > 0) {
    return NextResponse.json(
      { success: false, error: "Profile incomplete", missing },
      { status: 400 },
    );
  }

  /* Minor consent gate. */
  if (isMinor(p.date_of_birth)) {
    const cRows = (await sql`
      SELECT parent_name, parent_phone,
             profile_visibility_ok, media_upload_ok, scout_contact_ok, data_usage_ok
      FROM player_consents
      WHERE user_id = ${userId}
      ORDER BY signed_at DESC
      LIMIT 1
    `) as unknown as Array<any>;
    const c = cRows[0];
    if (
      !c ||
      !c.parent_name ||
      !c.parent_phone ||
      !c.profile_visibility_ok ||
      !c.media_upload_ok ||
      !c.scout_contact_ok ||
      !c.data_usage_ok
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Player is under 18 — parent details and all four consent checkboxes are required",
          minor: true,
        },
        { status: 400 },
      );
    }
  }

  /* Submit: flip status to Pending Approval, keep visibility Private until
     SportX Admin approves. Verification level stays at 1 (Self Registered)
     until the next ladder rung is earned. */
  await sql`
    UPDATE player_profiles
    SET profile_status = 'Pending Approval',
        visibility = 'Private',
        submitted_at = NOW(),
        updated_at = NOW()
    WHERE user_id = ${userId}
  `;

  /* Activate the user account so /dashboard routing stops looping them back
     to onboarding. They're still "Pending Approval" at the profile level
     (admin must approve before going Live), but routing-wise they belong
     on the dashboard now. */
  await sql`
    UPDATE users SET account_status = 'active'
    WHERE id = ${userId} AND COALESCE(account_status, 'pending') = 'pending'
  `;

  return NextResponse.json({
    success: true,
    profile_status: "Pending Approval",
    visibility: "Private",
    account_status: "active",
  });
}
