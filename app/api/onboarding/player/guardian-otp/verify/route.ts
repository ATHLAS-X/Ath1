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

  let body: {
    phone?: string;
    otp?: string;
    guardianName?: string;
    guardianRelationship?: string;
    saveConsent?: boolean;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { phone, otp, guardianName, guardianRelationship, saveConsent } = body;
  if (!phone || !otp) return NextResponse.json({ error: "phone and otp are required" }, { status: 400 });

  const cleanPhone = phone.replace(/\s/g, "");

  const rows = await raw(`
    SELECT id, code_hash FROM guardian_otps
    WHERE user_id = $1 AND phone = $2 AND consumed_at IS NULL AND expires_at > NOW()
    ORDER BY created_at DESC LIMIT 1
  `, [userId, cleanPhone]).catch(() => []);

  if (!rows[0]) return NextResponse.json({ error: "OTP expired or not found — request a new one" }, { status: 400 });

  if (rows[0].code_hash !== otp) {
    await raw(`UPDATE guardian_otps SET attempts = attempts + 1 WHERE id = $1`, [rows[0].id]).catch(() => {});
    return NextResponse.json({ error: "Invalid OTP" }, { status: 400 });
  }

  // Mark as consumed only when not a saveConsent re-call (already consumed on inline verify)
  if (!saveConsent) {
    await raw(`UPDATE guardian_otps SET consumed_at = NOW() WHERE id = $1`, [rows[0].id]).catch(() => {});
    return NextResponse.json({ success: true });
  }

  // saveConsent = true: create the guardian_consents record
  if (!guardianName?.trim() || !guardianRelationship) {
    return NextResponse.json({ error: "guardianName and guardianRelationship are required" }, { status: 400 });
  }

  await raw(`
    CREATE TABLE IF NOT EXISTS guardian_consents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      player_id UUID NOT NULL,
      guardian_name TEXT NOT NULL,
      relationship TEXT NOT NULL,
      guardian_phone TEXT NOT NULL,
      phone_verified BOOLEAN DEFAULT TRUE,
      consent_given BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `, []);

  const profileRows = await raw(`SELECT id FROM player_profiles WHERE user_id = $1 LIMIT 1`, [userId]).catch(() => []);
  if (!profileRows[0]) return NextResponse.json({ error: "Player profile not found" }, { status: 404 });

  await raw(`
    INSERT INTO guardian_consents (player_id, guardian_name, relationship, guardian_phone, phone_verified, consent_given)
    VALUES ($1,$2,$3,$4,TRUE,TRUE)
    ON CONFLICT DO NOTHING
  `, [profileRows[0].id, guardianName.trim(), guardianRelationship, cleanPhone]);

  await raw(`UPDATE guardian_otps SET consumed_at = NOW() WHERE id = $1`, [rows[0].id]).catch(() => {});

  return NextResponse.json({ success: true });
}
