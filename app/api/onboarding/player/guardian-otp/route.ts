import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

const raw = (q: string, p: unknown[]) =>
  (sql as unknown as (q: string, p: unknown[]) => Promise<any[]>)(q, p);

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;

  let body: { phone?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const phone = body.phone?.replace(/\s/g, "") ?? "";
  if (!phone) return NextResponse.json({ error: "phone is required" }, { status: 400 });

  await raw(`
    CREATE TABLE IF NOT EXISTS guardian_otps (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      phone TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      attempts INT DEFAULT 0,
      expires_at TIMESTAMPTZ NOT NULL,
      consumed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `, []);

  // Invalidate previous unused OTPs for this user+phone
  await raw(
    `DELETE FROM guardian_otps WHERE user_id = $1 AND phone = $2 AND consumed_at IS NULL`,
    [userId, phone],
  ).catch(() => {});

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await raw(
    `INSERT INTO guardian_otps (user_id, phone, code_hash, expires_at) VALUES ($1,$2,$3,$4)`,
    [userId, phone, code, expiresAt],
  );

  // MVP: no real WhatsApp/SMS integration yet — return dev_otp for testing
  return NextResponse.json({ success: true, data: { dev_otp: code } });
}
