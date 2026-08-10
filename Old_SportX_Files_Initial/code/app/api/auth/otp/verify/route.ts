import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

const MAX_ATTEMPTS = 5;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id as string;

  let body: { code?: string; phone?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const code = body.code?.trim();
  if (!code || !/^\d{4,8}$/.test(code)) {
    return NextResponse.json({ success: false, error: "Code is required" }, { status: 400 });
  }

  const rows = (await sql`
    SELECT id, phone, code_hash, attempts, expires_at, consumed_at
    FROM phone_otps
    WHERE user_id = ${userId}
      AND consumed_at IS NULL
      AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1
  `) as unknown as Array<{
    id: string;
    phone: string;
    code_hash: string;
    attempts: number;
    expires_at: Date;
    consumed_at: Date | null;
  }>;

  const otp = rows[0];
  if (!otp) {
    return NextResponse.json({ success: false, error: "No active code — request a new one" }, { status: 400 });
  }
  if (otp.attempts >= MAX_ATTEMPTS) {
    await sql`UPDATE phone_otps SET consumed_at = NOW() WHERE id = ${otp.id}`;
    return NextResponse.json({ success: false, error: "Too many attempts — request a new code" }, { status: 429 });
  }

  const ok = await bcrypt.compare(code, otp.code_hash);
  if (!ok) {
    await sql`UPDATE phone_otps SET attempts = attempts + 1 WHERE id = ${otp.id}`;
    return NextResponse.json({ success: false, error: "Incorrect code" }, { status: 400 });
  }

  await sql`UPDATE phone_otps SET consumed_at = NOW() WHERE id = ${otp.id}`;
  await sql`
    UPDATE users
    SET phone = ${otp.phone}, phone_verified_at = NOW()
    WHERE id = ${userId}
  `;

  return NextResponse.json({ success: true, phone_verified: true });
}
