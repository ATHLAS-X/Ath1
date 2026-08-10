import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

const raw = (q: string, p: unknown[]) =>
  (sql as unknown as (q: string, p: unknown[]) => Promise<any[]>)(q, p);

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "academy_admin") return NextResponse.json({ error: "Academy admin only" }, { status: 403 });

  const userId = (session.user as any).id as string;

  let body: { name?: string; timings?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!body.name?.trim()) return NextResponse.json({ error: "Batch name required" }, { status: 400 });

  const acadRows = await raw(`SELECT id FROM academies WHERE user_id = $1 LIMIT 1`, [userId]);
  if (!acadRows[0]) return NextResponse.json({ error: "No academy profile" }, { status: 400 });
  const academyId = acadRows[0].id as string;

  /* Ensure batches table exists (best-effort) */
  try {
    await raw(
      `CREATE TABLE IF NOT EXISTS batches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        academy_id UUID NOT NULL,
        name TEXT NOT NULL,
        timings TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      [],
    );
  } catch {}

  const inserted = await raw(
    `INSERT INTO batches (academy_id, name, timings) VALUES ($1, $2, $3) RETURNING id`,
    [academyId, body.name.trim(), body.timings ?? null],
  );

  return NextResponse.json({ success: true, id: inserted[0]?.id });
}
