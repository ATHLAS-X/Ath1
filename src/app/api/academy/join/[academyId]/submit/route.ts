import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyGuardianOtp } from "@/lib/academy/guardian-otp";
import { rateLimit } from "@/lib/rate-limit";
import { academyGate } from "@/lib/academy/gate";

export const dynamic = "force-dynamic";

/**
 * POST — public self-registration submit (design/import/AthlasX Player
 * Self-Registration.html). Creates a *pending* AcademyJoinRequest — nothing
 * is added to the roster until the academy admin approves it from
 * /academy/join-requests.
 *
 * AcademyJoinRequest has no columns for guardian name/phone, gender,
 * playing role, batting style or a consent flag — only
 * candidate_name/candidate_phone/candidate_dob exist today, and adding
 * columns for the rest means a schema migration this task doesn't
 * authorize (see src/lib/academy/players.ts's header for the same
 * constraint). Guardian consent is enforced here as a required gate on the
 * request (OTP verified + explicit consent boolean) but is not persisted
 * beyond this request succeeding — the same "collect for fidelity to the
 * mockup, only what the model supports actually reaches the database" rule
 * applied throughout the onboarding restyles.
 */
export async function POST(req: NextRequest, { params }: { params: { academyId: string } }) {
  const gate = academyGate();
  if (gate) return gate;

  const academy = await db.academy.findUnique({ where: { id: params.academyId }, select: { id: true } });
  if (!academy) return NextResponse.json({ error: "Invite link not found" }, { status: 404 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const playerName = String(body?.player_name ?? "").trim();
  const dobRaw = String(body?.dob ?? "").trim();
  if (!playerName || !dobRaw) {
    return NextResponse.json({ error: "Player name and date of birth are required" }, { status: 400 });
  }
  const dob = new Date(dobRaw);
  if (Number.isNaN(dob.getTime())) {
    return NextResponse.json({ error: "Invalid date of birth" }, { status: 400 });
  }

  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  const isMinor = age < 18;

  let guardianPhone = "";
  if (isMinor) {
    const guardianName = String(body?.guardian_name ?? "").trim();
    guardianPhone = typeof body?.guardian_phone === "string" ? body.guardian_phone.replace(/\D/g, "") : "";
    const requestId = String(body?.otp_request_id ?? "");
    const otp = String(body?.otp ?? "");
    const consent = body?.consent === true;

    if (!guardianName || guardianPhone.length !== 10) {
      return NextResponse.json({ error: "Guardian name and a 10-digit guardian phone are required" }, { status: 400 });
    }
    if (!consent) {
      return NextResponse.json({ error: "Guardian consent is required" }, { status: 400 });
    }
    const limit = rateLimit("academy-join-submit", guardianPhone, 10, 3600);
    if (!limit.success) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }
    const otpOk = await verifyGuardianOtp(requestId, guardianPhone, otp);
    if (!otpOk) {
      return NextResponse.json({ error: "Incorrect or expired OTP" }, { status: 400 });
    }
  }

  const request = await db.academyJoinRequest.create({
    data: {
      academy_id: academy.id,
      candidate_name: playerName,
      candidate_dob: dob,
      candidate_phone: guardianPhone || null,
    },
  });

  return NextResponse.json({ request_id: request.id }, { status: 201 });
}
