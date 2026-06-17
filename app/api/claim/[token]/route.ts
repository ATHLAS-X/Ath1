import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

/* GET — public preview of the invite (no auth required so the user can see
   it before signing in). Returns the player draft + academy info. */
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const rows = (await sql`
    SELECT i.id        AS invite_id,
           i.status    AS invite_status,
           i.invited_name,
           i.email,
           i.phone,
           i.claimed_at,
           pp.id       AS player_profile_id,
           pp.first_name, pp.last_name, pp.date_of_birth, pp.gender,
           pp.playing_role, pp.batting_style, pp.bowling_style,
           pp.height_cm, pp.weight_kg, pp.city, pp.state,
           pp.user_id  AS linked_user_id,
           a.academy_name, a.city AS academy_city, a.state AS academy_state
    FROM player_invites i
    LEFT JOIN player_profiles pp ON pp.id = i.player_profile_id
    LEFT JOIN academies a ON a.id = i.academy_id
    WHERE i.token = ${params.token}
    LIMIT 1
  `) as unknown as Array<any>;
  if (!rows[0]) return NextResponse.json({ success: false, error: "Invite not found" }, { status: 404 });
  return NextResponse.json({ success: true, invite: rows[0] });
}

/* POST — actually claim. Must be signed in. Links player_profiles.user_id to
   the current user, flips the invite to Claimed, and bumps the profile to
   the player's normal completion flow. */
export async function POST(_req: Request, { params }: { params: { token: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Sign in to claim this profile" }, { status: 401 });
  }
  if ((session.user as any).role !== "player") {
    return NextResponse.json({ success: false, error: "Only Player accounts can claim a profile" }, { status: 403 });
  }
  const userId = (session.user as any).id as string;

  const invRows = (await sql`
    SELECT id, player_profile_id, status FROM player_invites WHERE token = ${params.token} LIMIT 1
  `) as unknown as Array<{ id: string; player_profile_id: string | null; status: string }>;
  const invite = invRows[0];
  if (!invite) return NextResponse.json({ success: false, error: "Invite not found" }, { status: 404 });
  if (invite.status === "Claimed") {
    return NextResponse.json({ success: false, error: "This invite has already been claimed" }, { status: 409 });
  }
  if (!invite.player_profile_id) {
    return NextResponse.json({ success: false, error: "Invite is missing a linked draft profile" }, { status: 500 });
  }

  /* Refuse if the user already has a different profile attached. */
  const existing = (await sql`
    SELECT id FROM player_profiles WHERE user_id = ${userId} LIMIT 1
  `) as unknown as Array<any>;
  if (existing[0] && existing[0].id !== invite.player_profile_id) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Your account already has a profile. Contact support to merge — we won't auto-overwrite your existing data.",
      },
      { status: 409 },
    );
  }

  await sql`
    UPDATE player_profiles
    SET user_id = ${userId},
        claimed_at = NOW(),
        updated_at = NOW()
    WHERE id = ${invite.player_profile_id}
  `;
  await sql`
    UPDATE player_invites
    SET status = 'Claimed', claimed_at = NOW(), claimed_by_user_id = ${userId}
    WHERE id = ${invite.id}
  `;

  return NextResponse.json({
    success: true,
    redirect: "/onboarding/player",
    message: "Profile claimed — finish the remaining required fields to submit",
  });
}
