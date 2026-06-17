import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json([]);

  try {
    const rows = (await sql`
      SELECT id, academy_name, city, state
      FROM academies
      WHERE academy_name ILIKE ${"%" + q + "%"}
      ORDER BY academy_name
      LIMIT 10
    `) as unknown as Array<any>;
    return NextResponse.json(rows);
  } catch (e) {
    console.error("[academies/search]", e);
    return NextResponse.json([]);
  }
}
