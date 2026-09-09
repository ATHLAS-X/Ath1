import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/require-auth";
import { academyGate } from "@/lib/academy/gate";
import { getOwnedAcademy } from "@/lib/academy/scope";
import { addPlayerDirectly, listAcademyPlayers } from "@/lib/academy/players";
import type { PlayingRoleEnum, BattingStyle, BowlingStyleEnum } from "@prisma/client";

export const dynamic = "force-dynamic";

const PLAYING_ROLES: PlayingRoleEnum[] = ["Batsman", "Bowler", "All_rounder", "Wicket_keeper_Batsman"];
const BATTING_STYLES: BattingStyle[] = ["Right_handed", "Left_handed"];
const BOWLING_STYLES: BowlingStyleEnum[] = [
  "Right_arm_Fast", "Right_arm_Medium", "Right_arm_Off_spin", "Right_arm_Leg_spin",
  "Left_arm_Fast", "Left_arm_Medium", "Left_arm_Orthodox", "Left_arm_Unorthodox", "None",
];

/**
 * GET  — every active player across this academy's batches (Players surface).
 * POST — Add Players' Manual Entry tab: create one player and assign them to
 *        a batch directly (see src/lib/academy/players.ts for why this is
 *        modeled as an auto-approved join request).
 */
export async function GET(req: NextRequest) {
  const gate = academyGate();
  if (gate) return gate;
  const auth = await requireRole(req, ["academy_admin"]);
  if (auth instanceof NextResponse) return auth;

  const academy = await getOwnedAcademy(auth.user.id);
  if (!academy) return NextResponse.json({ error: "Set up your academy first" }, { status: 400 });

  const players = await listAcademyPlayers(academy.id);
  return NextResponse.json({ players });
}

export async function POST(req: NextRequest) {
  const gate = academyGate();
  if (gate) return gate;
  const auth = await requireRole(req, ["academy_admin"]);
  if (auth instanceof NextResponse) return auth;

  const academy = await getOwnedAcademy(auth.user.id);
  if (!academy) return NextResponse.json({ error: "Set up your academy first" }, { status: 400 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const fullName = String(body?.full_name ?? "").trim();
  const dobRaw = String(body?.dob ?? "").trim();
  const district = String(body?.district ?? "").trim();
  const state = String(body?.state ?? "").trim();
  const batchId = String(body?.batch_id ?? "").trim();

  if (!fullName || !dobRaw || !batchId) {
    return NextResponse.json({ error: "full_name, dob and batch_id are required" }, { status: 400 });
  }
  const dob = new Date(dobRaw);
  if (Number.isNaN(dob.getTime())) {
    return NextResponse.json({ error: "Invalid dob" }, { status: 400 });
  }

  const playingRole = body?.playing_role && PLAYING_ROLES.includes(body.playing_role) ? body.playing_role : null;
  const battingStyle = body?.batting_style && BATTING_STYLES.includes(body.batting_style) ? body.batting_style : null;
  const bowlingStyle = body?.bowling_style && BOWLING_STYLES.includes(body.bowling_style) ? body.bowling_style : null;

  const result = await addPlayerDirectly(
    academy.id,
    batchId,
    {
      full_name: fullName,
      dob,
      district,
      state,
      playing_role: playingRole,
      batting_style: battingStyle,
      bowling_style: bowlingStyle,
      guardian_name: body?.guardian_name ? String(body.guardian_name).trim() : null,
      guardian_phone: body?.guardian_phone ? String(body.guardian_phone).replace(/\D/g, "") : null,
    },
    auth.user.id,
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({ player_id: result.player_id }, { status: 201 });
}
