import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { sql } from "@/lib/db";

export async function GET() {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  try {
    /* Active scouts grouped by month for the last 6 months */
    const rows = (await sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') AS month,
        DATE_TRUNC('month', created_at) AS month_start,
        COUNT(*)::int AS scout_count
      FROM users
      WHERE role = 'scout'
        AND created_at >= NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY DATE_TRUNC('month', created_at)
    `) as any[];

    /* Total active scouts */
    const totRows = (await sql`
      SELECT COUNT(*)::int AS total FROM users WHERE role = 'scout'
    `) as any[];
    const total = Number(totRows[0]?.total ?? 0);

    /* New this month */
    const newRows = (await sql`
      SELECT COUNT(*)::int AS cnt FROM users
      WHERE role = 'scout'
        AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())
    `) as any[];
    const newThisMonth = Number(newRows[0]?.cnt ?? 0);

    return NextResponse.json({
      total_active: total,
      monthly_revenue: total * 999,
      new_this_month: newThisMonth,
      cancellations: 0,
      history: rows.map((r: any) => ({ month: r.month, v: Number(r.scout_count) })),
    });
  } catch (e) {
    console.error("[admin/revenue-history]", e);
    return NextResponse.json({ total_active: 0, monthly_revenue: 0, new_this_month: 0, cancellations: 0, history: [] });
  }
}
