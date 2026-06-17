import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { sql } from "@/lib/db";

export async function GET() {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  try {
    const rows = (await sql`
      SELECT
        TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS day,
        COUNT(*) FILTER (WHERE COALESCE(role,'player') = 'player')::int AS players,
        COUNT(*) FILTER (WHERE role = 'scout')::int AS scouts
      FROM users
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY DATE_TRUNC('day', created_at)
    `) as any[];

    /* fill in any missing days so the array always has 30 entries */
    const byDay: Record<string, { players: number; scouts: number }> = {};
    for (const r of rows) byDay[r.day] = { players: Number(r.players), scouts: Number(r.scouts) };

    const out: Array<{ day: string; players: number; scouts: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      out.push({ day: key, ...(byDay[key] ?? { players: 0, scouts: 0 }) });
    }
    return NextResponse.json(out);
  } catch (e) {
    console.error("[admin/activity]", e);
    return NextResponse.json([]);
  }
}
