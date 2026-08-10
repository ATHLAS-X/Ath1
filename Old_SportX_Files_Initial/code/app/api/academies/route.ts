import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

const raw = (q: string, p: unknown[]) =>
  (sql as unknown as (q: string, p: unknown[]) => Promise<any[]>)(q, p);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const city  = searchParams.get("city")?.trim() ?? "";
  const state = searchParams.get("state")?.trim() ?? "";

  const conditions: string[] = ["a.profile_status = 'Pending Approval' OR a.profile_status = 'Active'"];
  const params: unknown[] = [];

  if (city) {
    params.push(`%${city}%`);
    conditions.push(`a.city ILIKE $${params.length}`);
  }
  if (state) {
    params.push(state);
    conditions.push(`a.state = $${params.length}`);
  }

  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

  const rows = await raw(`
    SELECT
      a.id, a.academy_name, a.city,
      COALESCE(b.batch_count, 0)  AS batch_count,
      COALESCE(p.player_count, 0) AS player_count
    FROM academies a
    LEFT JOIN (
      SELECT academy_id, COUNT(*) AS batch_count FROM batches GROUP BY academy_id
    ) b ON b.academy_id = a.id
    LEFT JOIN (
      SELECT academy_id, COUNT(*) AS player_count FROM player_profiles WHERE academy_id IS NOT NULL GROUP BY academy_id
    ) p ON p.academy_id = a.id
    ${where}
    ORDER BY a.academy_name
    LIMIT 30
  `, params).catch(() => []);

  return NextResponse.json({ academies: rows });
}
