import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendGuardianOtp } from "@/lib/academy/guardian-otp";
import { rateLimit } from "@/lib/rate-limit";
import { academyGate } from "@/lib/academy/gate";

export const dynamic = "force-dynamic";

/** POST — send a guardian-phone OTP for the minor-consent step of the
 *  public self-registration form ({ phone }). */
export async function POST(req: NextRequest, { params }: { params: { academyId: string } }) {
  const gate = academyGate();
  if (gate) return gate;

  const academy = await db.academy.findUnique({ where: { id: params.academyId }, select: { id: true } });
  if (!academy) return NextResponse.json({ error: "Invite link not found" }, { status: 404 });

  const { phone } = await req.json().catch(() => ({}));
  const digits = typeof phone === "string" ? phone.replace(/\D/g, "") : "";
  if (digits.length !== 10) {
    return NextResponse.json({ error: "phone must be a 10-digit number" }, { status: 400 });
  }

  const limit = rateLimit("academy-join-otp-send", digits, 5, 3600);
  if (!limit.success) {
    return NextResponse.json({ error: "Too many OTP requests. Try again later." }, { status: 429 });
  }

  const { requestId, devCode } = await sendGuardianOtp(digits);
  return NextResponse.json({ requestId, devCode, devNotice: "Dev mode — no SMS gateway connected" });
}
