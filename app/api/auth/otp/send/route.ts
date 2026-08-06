import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { sendSms } from "@/lib/sms";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

const PHONE_RE = /^\+?[0-9]{7,15}$/;
const OTP_TTL_SECONDS = 10 * 60;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id as string;

  let body: { phone?: string } = {};
  try {
    body = await req.json();
  } catch {}

  /* Phone comes from request body for first-time verification, else from the DB row. */
  let phone = body.phone?.trim();
  if (!phone) {
    const rows = (await sql`SELECT phone FROM users WHERE id = ${userId} LIMIT 1`) as unknown as {
      phone: string | null;
    }[];
    phone = rows[0]?.phone ?? undefined;
  }
  if (!phone || !PHONE_RE.test(phone)) {
    return NextResponse.json({ success: false, error: "Valid phone number is required" }, { status: 400 });
  }

  const limit = await rateLimit("otp-send", phone, 5, 60 * 60);
  if (!limit.success) return rateLimitResponse(limit);

  /* 6-digit code, stored hashed; consumer compares with bcrypt. */
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const code_hash = await bcrypt.hash(code, 8);
  const expires_at = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

  /* Invalidate any previous unconsumed codes for this (user, phone). */
  await sql`
    UPDATE phone_otps SET consumed_at = NOW()
    WHERE user_id = ${userId} AND phone = ${phone} AND consumed_at IS NULL
  `;

  await sql`
    INSERT INTO phone_otps (user_id, phone, code_hash, expires_at)
    VALUES (${userId}, ${phone}, ${code_hash}, ${expires_at.toISOString()})
  `;

  /* Stash the phone on the user row if it wasn't already set. */
  try {
    await sql`UPDATE users SET phone = ${phone} WHERE id = ${userId} AND phone IS NULL`;
  } catch (e: any) {
    if (e?.code === "23505") {
      return NextResponse.json(
        { success: false, error: "This phone number is already registered to another account" },
        { status: 409 },
      );
    }
    throw e;
  }

  try {
    await sendSms(phone, `Your AthlasX verification code is ${code}. Expires in 10 minutes.`);
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message ?? "SMS delivery is not available right now — please try again later" },
      { status: 503 },
    );
  }

  const payload: Record<string, unknown> = {
    success: true,
    expires_in: OTP_TTL_SECONDS,
  };
  if (process.env.NODE_ENV !== "production") payload.dev_otp = code;

  return NextResponse.json(payload);
}
