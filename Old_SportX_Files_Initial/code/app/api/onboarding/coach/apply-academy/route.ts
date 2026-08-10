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

  let body: { academyId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!body.academyId) return NextResponse.json({ error: "academyId required" }, { status: 400 });

  const profileRows = await raw(`SELECT id FROM coach_profiles WHERE user_id = $1`, [userId]).catch(() => []);
  if (!profileRows[0]) return NextResponse.json({ error: "Coach profile not found" }, { status: 404 });

  await raw(`
    INSERT INTO coach_academy (coach_profile_id, academy_id, status, created_at)
    VALUES ($1,$2,'PENDING',NOW())
    ON CONFLICT (coach_profile_id, academy_id) DO NOTHING
  `, [profileRows[0].id, body.academyId]);

  return NextResponse.json({ success: true });
}
