import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { sql } from "@/lib/db";

export async function GET() {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  try {
    const rows = (await sql`
      SELECT
        COUNT(*) FILTER (WHERE total_score BETWEEN 90 AND 100)::int AS band_90,
        COUNT(*) FILTER (WHERE total_score BETWEEN 70 AND 89)::int  AS band_70,
        COUNT(*) FILTER (WHERE total_score BETWEEN 50 AND 69)::int  AS band_50,
        COUNT(*) FILTER (WHERE total_score BETWEEN 30 AND 49)::int  AS band_30,
        COUNT(*) FILTER (WHERE total_score BETWEEN 0  AND 29)::int  AS band_0
      FROM athlasx_score
    `) as any[];
    const r = rows[0] ?? {};
    return NextResponse.json([
      { n: "90-100", c: Number(r.band_90 ?? 0), col: "#EAB308" },
      { n: "70-89",  c: Number(r.band_70 ?? 0), col: "#22C55E" },
      { n: "50-69",  c: Number(r.band_50 ?? 0), col: "#3B82F6" },
      { n: "30-49",  c: Number(r.band_30 ?? 0), col: "#F59E0B" },
      { n: "0-29",   c: Number(r.band_0  ?? 0), col: "#EF4444" },
    ]);
  } catch (e) {
    console.error("[admin/score-distribution]", e);
    return NextResponse.json([]);
  }
}
