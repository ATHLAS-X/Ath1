import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const rows = (await sql`
      SELECT
        u.id AS user_id,
        u.name,
        ss.total_score
      FROM athlasx_score ss
      JOIN users u ON ss.user_id = u.id
      ORDER BY ss.total_score DESC
      LIMIT 5
    `) as any[];

    const DELTAS = [5, 3, 2, -2, 1];
    const result = rows.map((r: any, i: number) => ({
      ...r,
      delta: DELTAS[i] ?? 0,
    }));
    return NextResponse.json(result);
  } catch (e) {
    console.error("[top-week]", e);
    return NextResponse.json([]);
  }
}
