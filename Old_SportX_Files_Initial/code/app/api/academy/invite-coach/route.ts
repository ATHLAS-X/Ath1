import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "academy_admin") return NextResponse.json({ error: "Academy admin only" }, { status: 403 });

  const userId = (session.user as any).id as string;

  let body: { phone?: string; name?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!body.phone) return NextResponse.json({ error: "Phone required" }, { status: 400 });

  const raw = (q: string, p: unknown[]) =>
    (sql as unknown as (q: string, p: unknown[]) => Promise<any[]>)(q, p);

  /* Get academy id */
  const rows = await raw(`SELECT id FROM academies WHERE user_id = $1 LIMIT 1`, [userId]);
  if (!rows[0]) return NextResponse.json({ error: "No academy profile" }, { status: 400 });
  const academyId = rows[0].id as string;

  /* Ensure invite table columns exist */
  try {
    await raw(`ALTER TABLE academy_invites ADD COLUMN IF NOT EXISTS coach_name TEXT`, []);
  } catch {}

  /* Upsert invite record */
  await raw(
    `INSERT INTO academy_invites (academy_id, phone, coach_name, status, created_at)
     VALUES ($1, $2, $3, 'PENDING', NOW())
     ON CONFLICT (academy_id, phone) DO UPDATE SET status = 'PENDING', coach_name = EXCLUDED.coach_name`,
    [academyId, body.phone, body.name ?? null],
  );

  return NextResponse.json({ success: true });
}
